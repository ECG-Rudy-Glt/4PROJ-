import crypto from 'crypto';
import { getDekWrapSecret } from '../config/secrets';

const ALGORITHM = 'aes-256-gcm';
const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_DIGEST = 'sha512';
const KEY_LEN = 32;

/**
 * KekService — Gestion du chiffrement à deux niveaux (KEK/DEK).
 *
 * Flux :
 *   Register : generateSalt() + generateDek() → deriveKek(password, salt) → encryptDekWithKek(dek, kek)
 *              → stocker kekSalt + encryptedDek en DB
 *   Login    : deriveKek(password, kekSalt) → decryptDekWithKek(encryptedDek, kek) → wrapDek(dek)
 *              → inclure wrappedDek dans le JWT
 *   Request  : unwrapDek(wrappedDek) → utiliser le DEK pour chiffrer/déchiffrer les fichiers
 *   Change PW: deriveKek(newPW, kekSalt) → re-encryptDekWithKek(dek, newKek) → mettre à jour encryptedDek en DB
 */
export class KekService {
  /**
   * Dérive une KEK (Key Encryption Key) depuis le mot de passe utilisateur.
   * PBKDF2-SHA512 — 100 000 itérations, sel de 16 bytes.
   */
  static async deriveKek(password: string, saltHex: string): Promise<Buffer> {
    const salt = Buffer.from(saltHex, 'hex');
    return new Promise((resolve, reject) => {
      crypto.pbkdf2(password, salt, PBKDF2_ITERATIONS, KEY_LEN, PBKDF2_DIGEST, (err, key) => {
        if (err) reject(err);
        else resolve(key);
      });
    });
  }

  /** Génère un DEK (Data Encryption Key) aléatoire de 32 bytes. */
  static generateDek(): Buffer {
    return crypto.randomBytes(KEY_LEN);
  }

  /** Génère un sel PBKDF2 aléatoire (16 bytes → hex string). */
  static generateSalt(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  /**
   * Chiffre un DEK avec une KEK (AES-256-GCM).
   * Format retourné (hex) : IV(16) + ciphertext(32) + AuthTag(16)
   */
  static encryptDekWithKek(dek: Buffer, kek: Buffer): string {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, kek, iv);
    const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, encrypted, authTag]).toString('hex');
  }

  /**
   * Déchiffre un DEK chiffré avec une KEK.
   */
  static decryptDekWithKek(encryptedDekHex: string, kek: Buffer): Buffer {
    const data = Buffer.from(encryptedDekHex, 'hex');
    const iv = data.subarray(0, 16);
    const authTag = data.subarray(data.length - 16);
    const ciphertext = data.subarray(16, data.length - 16);
    const decipher = crypto.createDecipheriv(ALGORITHM, kek, iv, { authTagLength: 16 });
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  }

  /**
   * Enveloppe (wrap) un DEK avec la clé serveur DEK_WRAP_SECRET pour
   * l'inclure de façon sûre dans le payload JWT.
   * Format retourné (base64) : IV(16) + ciphertext(32) + AuthTag(16)
   */
  static wrapDek(dek: Buffer): string {
    const secret = getDekWrapSecret();
    const wrapKey = crypto.createHash('sha256').update(secret).digest();
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, wrapKey, iv);
    const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, encrypted, authTag]).toString('base64');
  }

  /**
   * Désenveloppe (unwrap) un DEK wrappé avec wrapDek().
   * Retourne null si le wrapped DEK est invalide ou ne correspond pas à la clé serveur.
   */
  static unwrapDek(wrappedBase64: string): Buffer | null {
    try {
      const secret = getDekWrapSecret();
      const wrapKey = crypto.createHash('sha256').update(secret).digest();
      const data = Buffer.from(wrappedBase64, 'base64');
      const iv = data.subarray(0, 16);
      const authTag = data.subarray(data.length - 16);
      const ciphertext = data.subarray(16, data.length - 16);
      const decipher = crypto.createDecipheriv(ALGORITHM, wrapKey, iv, { authTagLength: 16 });
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch {
      return null;
    }
  }
}
