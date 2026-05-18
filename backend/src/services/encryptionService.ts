import crypto from 'crypto';
import fs from 'fs';
import { PassThrough, Readable, Transform } from 'stream';
import { StorageService } from './storageService';
import { deleteFile } from '../utils/fileUtils';
import { getFileEncryptionSecret } from '../config/secrets';

const ALGORITHM = 'aes-256-gcm';

export class EncryptionService {
  private static getKey(): Buffer {
    const secret = getFileEncryptionSecret();
    return crypto.createHash('sha256').update(secret).digest();
  }

  /** Retourne le DEK fourni ou la clé globale en fallback. */
  private static resolveKey(dek?: Buffer): Buffer {
    return dek ?? this.getKey();
  }

  // ── Méthodes locales (conservées pour la migration) ──────────────────────

  /**
   * Chiffre un fichier local en place.
   * Format : IV (16 bytes) + contenu chiffré + AuthTag (16 bytes)
   */
  static async encryptFile(filePath: string): Promise<void> {
    const key = this.getKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const tempPath = `${filePath}.enc`;
    const input = fs.createReadStream(filePath);
    const output = fs.createWriteStream(tempPath);

    output.write(iv);

    return new Promise((resolve, reject) => {
      input.pipe(cipher).pipe(output);

      output.on('finish', () => {
        const authTag = cipher.getAuthTag();
        fs.appendFileSync(tempPath, authTag);
        fs.unlinkSync(filePath);
        fs.renameSync(tempPath, filePath);
        resolve();
      });

      output.on('error', reject);
    });
  }

  /**
   * Retourne un stream de déchiffrement depuis un fichier local.
   */
  static getDecryptStream(filePath: string): Readable {
    const key = this.getKey();
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;

    const fd = fs.openSync(filePath, 'r');
    const iv = Buffer.alloc(16);
    fs.readSync(fd, iv, 0, 16, 0);

    const tag = Buffer.alloc(16);
    fs.readSync(fd, tag, 0, 16, fileSize - 16);

    fs.closeSync(fd);

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: 16 });
    decipher.setAuthTag(tag);

    const input = fs.createReadStream(filePath, { start: 16, end: fileSize - 17 });
    return input.pipe(decipher);
  }

  /**
   * Déchiffre un fichier local en Buffer.
   */
  static async decryptFileToBuffer(filePath: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      const stream = this.getDecryptStream(filePath);
      stream.on('data', (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }

  // ── Méthodes S3 ──────────────────────────────────────────────────────────

  /**
   * Chiffre un fichier local et l'uploade sur S3 en streaming (sans fichier .enc temporaire).
   * Format streamé vers S3 : IV (16 bytes) + contenu chiffré + AuthTag (16 bytes)
   */
  static async encryptFileToS3(localPath: string, s3Key: string, dek?: Buffer): Promise<void> {
    const key = this.resolveKey(dek);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const input = fs.createReadStream(localPath);

    // Appende l'auth tag GCM à la fin du stream chiffré
    const gcmFinalizer = new Transform({
      transform(chunk, _enc, cb) { this.push(chunk); cb(); },
      flush(cb) { this.push(cipher.getAuthTag()); cb(); },
    });

    // Stream de sortie : IV d'abord, puis données chiffrées + auth tag
    const pass = new PassThrough();
    pass.write(iv);

    // Si une erreur survient dans la pipeline, on détruit pass (ce qui fait échouer l'upload S3)
    [input, cipher, gcmFinalizer].forEach(s => s.on('error', err => pass.destroy(err)));

    input.pipe(cipher).pipe(gcmFinalizer).pipe(pass, { end: true });

    // Taille chiffrée = 16 (IV) + taille originale + 16 (auth tag GCM)
    const originalSize = fs.statSync(localPath).size;
    const encryptedSize = originalSize + 32;

    try {
      await StorageService.upload(s3Key, pass, encryptedSize);
    } finally {
      await deleteFile(localPath).catch(() => undefined);
    }
  }

  /**
   * Retourne un stream de déchiffrement depuis une clé S3.
   * Utilise des ranged GETs pour éviter de bufferiser le fichier entier :
   *   - Range 0-15       → IV
   *   - Range N-16 à N-1 → AuthTag
   *   - Range 16 à N-17  → contenu chiffré (streamé)
   */
  static async getDecryptStreamFromS3(s3Key: string, dek?: Buffer): Promise<Readable> {
    const key = this.resolveKey(dek);
    const objectSize = await StorageService.getObjectSize(s3Key);

    if (objectSize < 32) {
      throw new Error('Objet S3 invalide : trop petit pour être un fichier chiffré.');
    }

    const ivBuffer = await StorageService.getBuffer(s3Key, { start: 0, end: 15 });
    const tagBuffer = await StorageService.getBuffer(s3Key, { start: objectSize - 16, end: objectSize - 1 });

    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivBuffer), { authTagLength: 16 });
    decipher.setAuthTag(Buffer.from(tagBuffer));

    if (objectSize === 32) {
      return Readable.from([]).pipe(decipher);
    }

    const contentStream = await StorageService.getStream(s3Key, { start: 16, end: objectSize - 17 });
    return contentStream.pipe(decipher);
  }

  /**
   * Déchiffre un objet S3 en Buffer (pour l'extraction de texte, OCR, etc.).
   */
  static async decryptBufferFromS3(s3Key: string, dek?: Buffer): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const stream = await this.getDecryptStreamFromS3(s3Key, dek);
        const chunks: Buffer[] = [];
        stream.on('data', (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Helper unifié : déchiffre vers un stream depuis une clé S3 OU un chemin local.
   */
  static async getDecryptStreamAuto(storagePathOrKey: string, dek?: Buffer): Promise<Readable> {
    if (StorageService.isS3Key(storagePathOrKey)) {
      return this.getDecryptStreamFromS3(storagePathOrKey, dek);
    }
    return this.getDecryptStream(storagePathOrKey);
  }

  /**
   * Helper unifié : déchiffre vers un Buffer depuis une clé S3 OU un chemin local.
   */
  static async decryptToBufferAuto(storagePathOrKey: string, dek?: Buffer): Promise<Buffer> {
    if (StorageService.isS3Key(storagePathOrKey)) {
      return this.decryptBufferFromS3(storagePathOrKey, dek);
    }
    return this.decryptFileToBuffer(storagePathOrKey);
  }

  // ── Chiffrement de chaînes de caractères (texte extrait, index) ──────────

  /**
   * Chiffre un texte en mémoire.
   * Format retourné (base64) : IV (16 bytes) + contenu chiffré + AuthTag (16 bytes)
   */
  static encryptText(text: string): string {
    const key = this.getKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, encrypted, authTag]).toString('base64');
  }

  /**
   * Déchiffre un texte précédemment chiffré avec encryptText.
   */
  static decryptText(encryptedBase64: string): string {
    const key = this.getKey();
    const data = Buffer.from(encryptedBase64, 'base64');
    const iv = data.subarray(0, 16);
    const authTag = data.subarray(data.length - 16);
    const content = data.subarray(16, data.length - 16);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: 16 });
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(content), decipher.final()]).toString('utf8');
  }
}
