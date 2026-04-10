/**
 * Tests de securite - KekService (architecture KEK/DEK)
 *
 * Couverture :
 *   1. generateDek / generateSalt  - entropie, format
 *   2. deriveKek                   - determinisme, sensibilite au mot de passe et au sel
 *   3. encryptDekWithKek           - round-trip, IV aleatoire, mauvaise KEK, bit flipping
 *   4. wrapDek / unwrapDek         - round-trip JWT, degradation gracieuse, cle serveur absente
 */

import crypto from 'crypto';
import { KekService } from '../kekService';

// --- Setup -------------------------------------------------------------------

const WRAP_SECRET = 'test-dek-wrap-secret-for-jest-!!';

beforeEach(() => {
  process.env.DEK_WRAP_SECRET = WRAP_SECRET;
});

afterEach(() => {
  delete process.env.DEK_WRAP_SECRET;
});

// --- Suite 1 : generateDek ---------------------------------------------------

describe('KekService.generateDek', () => {
  it('retourne exactement 32 bytes', () => {
    expect(KekService.generateDek()).toHaveLength(32);
  });

  it('deux appels successifs produisent des cles differentes (aleatoire)', () => {
    const a = KekService.generateDek();
    const b = KekService.generateDek();
    expect(a.equals(b)).toBe(false);
  });
});

// --- Suite 2 : generateSalt --------------------------------------------------

describe('KekService.generateSalt', () => {
  it('retourne une chaine hexadecimale de 32 caracteres (16 bytes)', () => {
    const salt = KekService.generateSalt();
    expect(typeof salt).toBe('string');
    expect(salt).toHaveLength(32);
    expect(/^[0-9a-f]+$/i.test(salt)).toBe(true);
  });

  it('deux appels successifs produisent des sels differents', () => {
    expect(KekService.generateSalt()).not.toBe(KekService.generateSalt());
  });
});

// --- Suite 3 : deriveKek -----------------------------------------------------

describe('KekService.deriveKek', () => {
  const salt = crypto.randomBytes(16).toString('hex');

  it('est deterministe : meme mot de passe + meme sel -> meme KEK', async () => {
    const kek1 = await KekService.deriveKek('MyPassword123!', salt);
    const kek2 = await KekService.deriveKek('MyPassword123!', salt);
    expect(kek1.equals(kek2)).toBe(true);
  });

  it('retourne exactement 32 bytes', async () => {
    const kek = await KekService.deriveKek('Password1!', salt);
    expect(kek).toHaveLength(32);
  });

  it('mot de passe different -> KEK differente (sensibilite au mot de passe)', async () => {
    const kek1 = await KekService.deriveKek('PasswordA1!', salt);
    const kek2 = await KekService.deriveKek('PasswordB1!', salt);
    expect(kek1.equals(kek2)).toBe(false);
  });

  it('sel different -> KEK differente (sensibilite au sel)', async () => {
    const otherSalt = crypto.randomBytes(16).toString('hex');
    const kek1 = await KekService.deriveKek('SamePassword1!', salt);
    const kek2 = await KekService.deriveKek('SamePassword1!', otherSalt);
    expect(kek1.equals(kek2)).toBe(false);
  });

  it("meme mot de passe, sel different d'un seul bit -> KEK totalement differente (avalanche)", async () => {
    const saltBuf = Buffer.from(salt, 'hex');
    const altSaltBuf = Buffer.from(salt, 'hex');
    altSaltBuf[0] ^= 0x01;

    const kek1 = await KekService.deriveKek('Password1!', saltBuf.toString('hex'));
    const kek2 = await KekService.deriveKek('Password1!', altSaltBuf.toString('hex'));
    expect(kek1.equals(kek2)).toBe(false);
  });
});

// --- Suite 4 : encryptDekWithKek / decryptDekWithKek -------------------------

describe('KekService.encryptDekWithKek / decryptDekWithKek', () => {
  let dek: Buffer;
  let kek: Buffer;

  beforeEach(async () => {
    dek = KekService.generateDek();
    kek = await KekService.deriveKek('VaultPassword1!', KekService.generateSalt());
  });

  it("round-trip : le DEK dechiffre est identique a l'original", () => {
    const encrypted = KekService.encryptDekWithKek(dek, kek);
    const decrypted = KekService.decryptDekWithKek(encrypted, kek);
    expect(decrypted.equals(dek)).toBe(true);
  });

  it('deux chiffrements du meme DEK produisent des ciphertexts differents (IV aleatoire)', () => {
    const enc1 = KekService.encryptDekWithKek(dek, kek);
    const enc2 = KekService.encryptDekWithKek(dek, kek);
    expect(enc1).not.toBe(enc2);
  });

  it('mauvaise KEK -> throw (impossible de dechiffrer le DEK)', async () => {
    const wrongKek = await KekService.deriveKek('WrongPassword1!', KekService.generateSalt());
    const encrypted = KekService.encryptDekWithKek(dek, kek);
    expect(() => KekService.decryptDekWithKek(encrypted, wrongKek)).toThrow();
  });

  it('bit flip dans le corps du ciphertext -> throw (AuthTag mismatch)', () => {
    const encrypted = KekService.encryptDekWithKek(dek, kek);
    const data = Buffer.from(encrypted, 'hex');
    data[20] ^= 0xff;
    expect(() => KekService.decryptDekWithKek(data.toString('hex'), kek)).toThrow();
  });

  it('AuthTag falsifie (dernier octet) -> throw', () => {
    const encrypted = KekService.encryptDekWithKek(dek, kek);
    const data = Buffer.from(encrypted, 'hex');
    data[data.length - 1] ^= 0xff;
    expect(() => KekService.decryptDekWithKek(data.toString('hex'), kek)).toThrow();
  });

  it('IV falsifie (premier octet) -> throw', () => {
    const encrypted = KekService.encryptDekWithKek(dek, kek);
    const data = Buffer.from(encrypted, 'hex');
    data[0] ^= 0xff;
    expect(() => KekService.decryptDekWithKek(data.toString('hex'), kek)).toThrow();
  });

  it("DEK chiffre avec une KEK inutilisable avec une KEK issue d'un sel different", async () => {
    const salt1 = KekService.generateSalt();
    const salt2 = KekService.generateSalt();
    const kek1 = await KekService.deriveKek('SamePassword1!', salt1);
    const kek2 = await KekService.deriveKek('SamePassword1!', salt2);

    const encrypted = KekService.encryptDekWithKek(dek, kek1);
    expect(() => KekService.decryptDekWithKek(encrypted, kek2)).toThrow();
  });
});

// --- Suite 5 : wrapDek / unwrapDek -------------------------------------------

describe('KekService.wrapDek / unwrapDek', () => {
  it("round-trip : le DEK de-enveloppe est identique a l'original", () => {
    const dek = KekService.generateDek();
    const wrapped = KekService.wrapDek(dek);
    const unwrapped = KekService.unwrapDek(wrapped);
    expect(unwrapped).not.toBeNull();
    expect(unwrapped!.equals(dek)).toBe(true);
  });

  it('deux wrapDek du meme DEK produisent des tokens differents (IV aleatoire)', () => {
    const dek = KekService.generateDek();
    expect(KekService.wrapDek(dek)).not.toBe(KekService.wrapDek(dek));
  });

  it('wrapDek sans DEK_WRAP_SECRET -> throw avec message clair', () => {
    delete process.env.DEK_WRAP_SECRET;
    expect(() => KekService.wrapDek(KekService.generateDek())).toThrow('[KekService] DEK_WRAP_SECRET');
  });

  it('unwrapDek sans DEK_WRAP_SECRET -> null (degradation gracieuse)', () => {
    delete process.env.DEK_WRAP_SECRET;
    expect(KekService.unwrapDek('some-base64-data')).toBeNull();
  });

  it('bit flip dans le token wrappe -> null (degradation gracieuse)', () => {
    const dek = KekService.generateDek();
    const wrapped = KekService.wrapDek(dek);
    const data = Buffer.from(wrapped, 'base64');
    data[20] ^= 0xff;
    expect(KekService.unwrapDek(data.toString('base64'))).toBeNull();
  });

  it('AuthTag falsifie dans le token -> null', () => {
    const dek = KekService.generateDek();
    const wrapped = KekService.wrapDek(dek);
    const data = Buffer.from(wrapped, 'base64');
    data[data.length - 1] ^= 0xff;
    expect(KekService.unwrapDek(data.toString('base64'))).toBeNull();
  });

  it('mauvais DEK_WRAP_SECRET au moment du unwrap -> null', () => {
    const dek = KekService.generateDek();
    const wrapped = KekService.wrapDek(dek);
    process.env.DEK_WRAP_SECRET = 'completely-different-secret-key!!';
    expect(KekService.unwrapDek(wrapped)).toBeNull();
  });

  it('token vide ou malform -> null (pas de crash)', () => {
    expect(KekService.unwrapDek('')).toBeNull();
    expect(KekService.unwrapDek('not-base64-!!!@@@')).toBeNull();
  });
});
