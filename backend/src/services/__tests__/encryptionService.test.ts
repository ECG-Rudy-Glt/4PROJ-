/**
 * Tests de securite - EncryptionService (AES-256-GCM)
 *
 * Couverture :
 *   1. encryptText / decryptText - round-trip, IV aleatoire, bit flipping, mauvaise cle
 *   2. Fichiers locaux           - round-trip binaire, bit flipping corps + AuthTag
 *   3. Simulation S3             - dechiffrement valide, bit flipping, objet trop petit
 */

import crypto from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

// Cle deterministe pour les tests - doit etre definie AVANT l'import du service
process.env.FILE_ENCRYPTION_KEY = 'test-file-encryption-key-32chars';

// StorageService instancie un client S3 au chargement du module (requireEnv appelle S3_ENDPOINT).
// On utilise une factory explicite pour eviter tout chargement du module reel.
jest.mock('../storageService', () => ({
  StorageService: {
    getObjectSize: jest.fn(),
    getBuffer: jest.fn(),
    getStream: jest.fn(),
    isS3Key: jest.fn((p: string) =>
      p.startsWith('files/') || p.startsWith('versions/') || p.startsWith('thumbnails/'),
    ),
    upload: jest.fn(),
    uploadFromFile: jest.fn(),
    delete: jest.fn(),
    copy: jest.fn(),
    deleteStorageFile: jest.fn(),
  },
}));

import { EncryptionService } from '../encryptionService';
import { StorageService } from '../storageService';

// --- Helpers -----------------------------------------------------------------

/** Construit un blob chiffre AES-256-GCM en memoire (format identique au service). */
function buildEncryptedBlob(plaintext: Buffer): Buffer {
  const key = crypto.createHash('sha256').update(process.env.FILE_ENCRYPTION_KEY!).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, authTag]);
}

/** Configure les mocks StorageService pour simuler un objet S3. */
function mockS3Object(blob: Buffer) {
  (StorageService.getObjectSize as jest.Mock).mockResolvedValue(blob.length);
  (StorageService.getBuffer as jest.Mock).mockImplementation(
    (_key: string, range?: { start: number; end: number }) =>
      Promise.resolve(range ? blob.subarray(range.start, range.end + 1) : blob),
  );
  (StorageService.getStream as jest.Mock).mockImplementation(
    (_key: string, range?: { start: number; end: number }) => {
      const { Readable } = require('stream');
      return Promise.resolve(Readable.from([range ? blob.subarray(range.start, range.end + 1) : blob]));
    },
  );
}

/** Consomme un Readable stream et retourne le Buffer complet. */
async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
  }
  return Buffer.concat(chunks);
}

// --- Suite 1 : encryptText / decryptText -------------------------------------

describe('EncryptionService.encryptText / decryptText', () => {
  it("round-trip : le texte dechiffre est identique a l'original", () => {
    const original = 'Donnees confidentielles utf-8 & speciaux';
    expect(EncryptionService.decryptText(EncryptionService.encryptText(original))).toBe(original);
  });

  it("meme texte chiffre deux fois -> ciphertexts differents (IV aleatoire)", () => {
    const text = 'meme texte';
    expect(EncryptionService.encryptText(text)).not.toBe(EncryptionService.encryptText(text));
  });

  it("bit flip dans le corps du ciphertext -> throw (AuthTag mismatch)", () => {
    const blob = Buffer.from(EncryptionService.encryptText('payload secret'), 'base64');
    blob[20] ^= 0xff;
    expect(() => EncryptionService.decryptText(blob.toString('base64'))).toThrow();
  });

  it("AuthTag falsifie (dernier octet) -> throw", () => {
    const blob = Buffer.from(EncryptionService.encryptText('payload secret'), 'base64');
    blob[blob.length - 1] ^= 0xff;
    expect(() => EncryptionService.decryptText(blob.toString('base64'))).toThrow();
  });

  it("IV falsifie (premier octet) -> throw", () => {
    const blob = Buffer.from(EncryptionService.encryptText('payload secret'), 'base64');
    blob[0] ^= 0xff;
    expect(() => EncryptionService.decryptText(blob.toString('base64'))).toThrow();
  });

  it("mauvaise FILE_ENCRYPTION_KEY -> throw", () => {
    const encrypted = EncryptionService.encryptText('secret');
    const saved = process.env.FILE_ENCRYPTION_KEY;
    process.env.FILE_ENCRYPTION_KEY = 'completely-wrong-key-32-chars!!!';
    try {
      expect(() => EncryptionService.decryptText(encrypted)).toThrow();
    } finally {
      process.env.FILE_ENCRYPTION_KEY = saved;
    }
  });

  it("donnees tronquees (< 32 bytes) -> throw", () => {
    const tooShort = Buffer.alloc(10).toString('base64');
    expect(() => EncryptionService.decryptText(tooShort)).toThrow();
  });

  it("fuite S3 : bytes bruts sans la cle sont indechiffrables", () => {
    const encrypted = EncryptionService.encryptText('donnees ultra-secretes');
    const rawBlob = Buffer.from(encrypted, 'base64');
    const saved = process.env.FILE_ENCRYPTION_KEY;
    process.env.FILE_ENCRYPTION_KEY = 'attacker-has-no-idea-what-key!!!';
    try {
      expect(() => EncryptionService.decryptText(rawBlob.toString('base64'))).toThrow();
    } finally {
      process.env.FILE_ENCRYPTION_KEY = saved;
    }
  });
});

// --- Suite 2 : fichiers locaux -----------------------------------------------

describe("EncryptionService - fichiers locaux (encrypt + decrypt)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'enc-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("round-trip texte : contenu preserve apres chiffrement + dechiffrement", async () => {
    const filePath = path.join(tmpDir, 'text.txt');
    const content = 'Contenu avec accents et caracteres speciaux';
    fs.writeFileSync(filePath, content, 'utf8');

    await EncryptionService.encryptFile(filePath);
    const decrypted = await EncryptionService.decryptFileToBuffer(filePath);

    expect(decrypted.toString('utf8')).toBe(content);
  });

  it("round-trip binaire : contenu preserve byte pour byte", async () => {
    const filePath = path.join(tmpDir, 'binary.bin');
    const binary = crypto.randomBytes(2048);
    fs.writeFileSync(filePath, binary);

    await EncryptionService.encryptFile(filePath);
    const decrypted = await EncryptionService.decryptFileToBuffer(filePath);

    expect(decrypted).toEqual(binary);
  });

  it("bit flip dans le corps du fichier chiffre -> throw (AuthTag mismatch)", async () => {
    const filePath = path.join(tmpDir, 'tampered-body.bin');
    fs.writeFileSync(filePath, 'donnees secretes pour le test');

    await EncryptionService.encryptFile(filePath);

    const enc = fs.readFileSync(filePath);
    enc[20] ^= 0xff;
    fs.writeFileSync(filePath, enc);

    await expect(EncryptionService.decryptFileToBuffer(filePath)).rejects.toThrow();
  });

  it("bit flip dans l'AuthTag (dernier octet) -> throw", async () => {
    const filePath = path.join(tmpDir, 'tampered-tag.bin');
    fs.writeFileSync(filePath, 'donnees secretes pour auth tag test');

    await EncryptionService.encryptFile(filePath);

    const enc = fs.readFileSync(filePath);
    enc[enc.length - 1] ^= 0xff;
    fs.writeFileSync(filePath, enc);

    await expect(EncryptionService.decryptFileToBuffer(filePath)).rejects.toThrow();
  });

  it("bit flip dans l'IV (premier octet) -> throw", async () => {
    const filePath = path.join(tmpDir, 'tampered-iv.bin');
    fs.writeFileSync(filePath, 'donnees secretes pour le test IV');

    await EncryptionService.encryptFile(filePath);

    const enc = fs.readFileSync(filePath);
    enc[0] ^= 0xff;
    fs.writeFileSync(filePath, enc);

    await expect(EncryptionService.decryptFileToBuffer(filePath)).rejects.toThrow();
  });

  it("mauvaise cle -> impossible de dechiffrer le fichier", async () => {
    const filePath = path.join(tmpDir, 'wrong-key.bin');
    fs.writeFileSync(filePath, 'fichier ultra-secret');

    await EncryptionService.encryptFile(filePath);

    const saved = process.env.FILE_ENCRYPTION_KEY;
    process.env.FILE_ENCRYPTION_KEY = 'wrong-key-completely-different!!!';
    try {
      await expect(EncryptionService.decryptFileToBuffer(filePath)).rejects.toThrow();
    } finally {
      process.env.FILE_ENCRYPTION_KEY = saved;
    }
  });
});

// --- Suite 3 : simulation S3 (getDecryptStreamFromS3) -----------------------

describe("EncryptionService - simulation acces S3 (fuite bucket)", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("dechiffrement correct depuis des bytes S3 valides", async () => {
    const plaintext = Buffer.from('contenu du fichier stocke sur S3');
    const blob = buildEncryptedBlob(plaintext);
    mockS3Object(blob);

    const stream = await EncryptionService.getDecryptStreamFromS3('files/valid-key');
    const result = await streamToBuffer(stream);

    expect(result.toString('utf8')).toBe('contenu du fichier stocke sur S3');
  });

  it("bit flip dans le corps S3 -> throw (AuthTag mismatch - integrite AES-GCM)", async () => {
    const blob = buildEncryptedBlob(Buffer.from('fichier secret'));
    const tampered = Buffer.from(blob);
    tampered[17] ^= 0xff;
    mockS3Object(tampered);

    const stream = await EncryptionService.getDecryptStreamFromS3('files/tampered');
    await expect(streamToBuffer(stream)).rejects.toThrow();
  });

  it("AuthTag falsifie dans S3 -> throw", async () => {
    const blob = buildEncryptedBlob(Buffer.from('fichier secret'));
    const tampered = Buffer.from(blob);
    tampered[tampered.length - 1] ^= 0xff;
    mockS3Object(tampered);

    const stream = await EncryptionService.getDecryptStreamFromS3('files/tampered-tag');
    await expect(streamToBuffer(stream)).rejects.toThrow();
  });

  it("objet S3 trop petit pour etre un fichier valide (< 32 bytes) -> throw immediat", async () => {
    (StorageService.getObjectSize as jest.Mock).mockResolvedValue(10);

    await expect(
      EncryptionService.getDecryptStreamFromS3('files/too-small'),
    ).rejects.toThrow('Objet S3 invalide');
  });

  it("fuite S3 : bytes bruts sans la cle sont indechiffrables", async () => {
    const plaintext = Buffer.from('donnees ultra-confidentielles');
    const blob = buildEncryptedBlob(plaintext);
    mockS3Object(blob);

    const saved = process.env.FILE_ENCRYPTION_KEY;
    process.env.FILE_ENCRYPTION_KEY = 'attacker-guessed-wrong-key-32!!!';
    try {
      const stream = await EncryptionService.getDecryptStreamFromS3('files/leaked-key');
      await expect(streamToBuffer(stream)).rejects.toThrow();
    } finally {
      process.env.FILE_ENCRYPTION_KEY = saved;
    }
  });

  it("getDecryptStreamAuto deleguee vers S3 pour une cle S3", async () => {
    const plaintext = Buffer.from('auto-routing vers S3');
    const blob = buildEncryptedBlob(plaintext);
    mockS3Object(blob);

    const stream = await EncryptionService.getDecryptStreamAuto('files/auto-s3-key');
    const result = await streamToBuffer(stream);
    expect(result.toString('utf8')).toBe('auto-routing vers S3');
  });
});
