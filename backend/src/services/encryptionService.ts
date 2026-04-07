import crypto from 'crypto';
import fs from 'fs';
import { Readable } from 'stream';
import { StorageService } from './storageService';
import { deleteFile } from '../utils/fileUtils';

const ALGORITHM = 'aes-256-gcm';

export class EncryptionService {
  private static getKey(): Buffer {
    const secret = process.env.FILE_ENCRYPTION_KEY || 'default-secret-key-32-chars-long!!';
    return crypto.createHash('sha256').update(secret).digest();
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

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv); // nosemgrep: javascript.node-crypto.security.gcm-no-tag-length.gcm-no-tag-length
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
   * Chiffre un fichier local et l'uploade sur S3.
   * - Chiffre dans un fichier .enc temporaire (même format IV+content+AuthTag)
   * - Upload le fichier chiffré vers S3
   * - Supprime les deux fichiers temporaires locaux
   */
  static async encryptFileToS3(localPath: string, s3Key: string): Promise<void> {
    const key = this.getKey();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    const tempEncPath = `${localPath}.enc`;
    const input = fs.createReadStream(localPath);
    const output = fs.createWriteStream(tempEncPath);

    output.write(iv);

    await new Promise<void>((resolve, reject) => {
      input.pipe(cipher).pipe(output);
      output.on('finish', () => {
        const authTag = cipher.getAuthTag();
        fs.appendFileSync(tempEncPath, authTag);
        resolve();
      });
      output.on('error', reject);
    });

    try {
      await StorageService.uploadFromFile(s3Key, tempEncPath);
    } finally {
      // Toujours nettoyer les fichiers temporaires, même en cas d'erreur S3
      await deleteFile(localPath).catch(() => undefined);
      await deleteFile(tempEncPath).catch(() => undefined);
    }
  }

  /**
   * Retourne un stream de déchiffrement depuis une clé S3.
   * Utilise des ranged GETs pour éviter de bufferiser le fichier entier :
   *   - Range 0-15       → IV
   *   - Range N-16 à N-1 → AuthTag
   *   - Range 16 à N-17  → contenu chiffré (streamé)
   */
  static async getDecryptStreamFromS3(s3Key: string): Promise<Readable> {
    const key = this.getKey();
    const objectSize = await StorageService.getObjectSize(s3Key);

    if (objectSize < 33) {
      throw new Error('Objet S3 invalide : trop petit pour être un fichier chiffré.');
    }

    const ivBuffer = await StorageService.getBuffer(s3Key, { start: 0, end: 15 });
    const tagBuffer = await StorageService.getBuffer(s3Key, { start: objectSize - 16, end: objectSize - 1 });

    const contentStream = await StorageService.getStream(s3Key, { start: 16, end: objectSize - 17 });

    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(ivBuffer)); // nosemgrep: javascript.node-crypto.security.gcm-no-tag-length.gcm-no-tag-length
    decipher.setAuthTag(Buffer.from(tagBuffer));

    return contentStream.pipe(decipher);
  }

  /**
   * Déchiffre un objet S3 en Buffer (pour l'extraction de texte, OCR, etc.).
   */
  static async decryptBufferFromS3(s3Key: string): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      try {
        const stream = await this.getDecryptStreamFromS3(s3Key);
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
  static async getDecryptStreamAuto(storagePathOrKey: string): Promise<Readable> {
    if (StorageService.isS3Key(storagePathOrKey)) {
      return this.getDecryptStreamFromS3(storagePathOrKey);
    }
    return this.getDecryptStream(storagePathOrKey);
  }

  /**
   * Helper unifié : déchiffre vers un Buffer depuis une clé S3 OU un chemin local.
   */
  static async decryptToBufferAuto(storagePathOrKey: string): Promise<Buffer> {
    if (StorageService.isS3Key(storagePathOrKey)) {
      return this.decryptBufferFromS3(storagePathOrKey);
    }
    return this.decryptFileToBuffer(storagePathOrKey);
  }
}
