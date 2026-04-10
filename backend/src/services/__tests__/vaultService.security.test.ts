/**
 * Tests de sécurité — VaultService
 *
 * Couverture :
 *   1. Validation du mot de passe             — force minimale requise
 *   2. Protection brute-force                 — lockout après 5 échecs consécutifs
 *   3. Respect du lockout temporel            — rejet si vaultLockedUntil est dans le futur
 *   4. Timing de session unlock               — expiration correcte de vaultUnlockUntil
 *   5. Isolation vault (assertUnlockedIfVault) — accès refusé si vault verrouillé
 *   6. isVaultUnlocked                        — états bord (pas de date, date passée, future)
 */

import prisma from '../../config/database';
import { VaultService } from '../vaultService';
import { PlanService } from '../planService';
import { mfaService } from '../mfaService';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    folder: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    $transaction: jest.fn(async (fn: any) => fn({
      user: { update: jest.fn() },
      folder: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn() },
    })),
  },
}));

jest.mock('../planService', () => ({
  PlanService: {
    checkFeature: jest.fn(),
  },
}));

jest.mock('../mfaService', () => ({
  mfaService: {
    verifyUserTOTPCode: jest.fn(),
  },
}));

// bcrypt est lent (12 rounds) — on le mock pour garder les tests rapides
jest.mock('bcryptjs', () => ({
  hash: jest.fn().mockResolvedValue('$hashed$'),
  compare: jest.fn(),
}));

import bcrypt from 'bcryptjs';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const mockVaultAvailable = () =>
  (PlanService.checkFeature as jest.Mock).mockResolvedValue(true);

const mockVaultUnavailable = () =>
  (PlanService.checkFeature as jest.Mock).mockResolvedValue(false);

function makeVaultUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-vault',
    mfaEnabled: true,
    vaultEnabled: true,
    vaultPasswordHash: '$hashed$',
    vaultLockedUntil: null,
    vaultFailedAttempts: 0,
    ...overrides,
  };
}

// ─── Suite 1 : validation du mot de passe ────────────────────────────────────

describe('VaultService — validation du mot de passe (force minimale)', () => {
  // On accède à la méthode privée via le prototype pour tester les règles
  // sans passer par toute la chaîne setupVault (MFA, Prisma, etc.)
  const validate = (pwd: string) =>
    (VaultService as any).validatePasswordStrength(pwd);

  it('mot de passe valide → ne throw pas', () => {
    expect(() => validate('SuperSecret1!')).not.toThrow();
    expect(() => validate('Tr0ub4dor&3-correct')).not.toThrow();
  });

  it('moins de 12 caractères → throw', () => {
    expect(() => validate('Short1!')).toThrow('12 caractères');
  });

  it('pas de majuscule → throw', () => {
    expect(() => validate('nocapital123!')).toThrow();
  });

  it('pas de minuscule → throw', () => {
    expect(() => validate('NOLOWER123!')).toThrow();
  });

  it('pas de chiffre → throw', () => {
    expect(() => validate('NoDigitHere!')).toThrow();
  });

  it('pas de caractère spécial → throw', () => {
    expect(() => validate('NoSpecial123456')).toThrow();
  });

  it('mot de passe vide → throw', () => {
    expect(() => validate('')).toThrow();
  });
});

// ─── Suite 2 : protection brute-force ────────────────────────────────────────

describe('VaultService — protection brute-force (lockout)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVaultAvailable();
    (mfaService.verifyUserTOTPCode as jest.Mock).mockResolvedValue(false);
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    (prisma.user.update as jest.Mock).mockResolvedValue({});
  });

  it('après 5 échecs consécutifs, vaultLockedUntil est défini dans la mise à jour DB', async () => {
    // Simule un utilisateur à 4 tentatives échouées (le 5e doit déclencher le lock)
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(
      makeVaultUser({ vaultFailedAttempts: 4 }),
    );

    await expect(
      VaultService.unlockVault('user-vault', 'wrongpwd', '000000'),
    ).rejects.toThrow('invalides');

    const updateCall = (prisma.user.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data.vaultLockedUntil).toBeInstanceOf(Date);
    // Le lockout doit être dans le futur (15 minutes)
    expect(updateCall.data.vaultLockedUntil.getTime()).toBeGreaterThan(Date.now());
  });

  it('avant le seuil (4 échecs), vaultLockedUntil reste null', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(
      makeVaultUser({ vaultFailedAttempts: 3 }),
    );

    await expect(
      VaultService.unlockVault('user-vault', 'wrongpwd', '000000'),
    ).rejects.toThrow('invalides');

    const updateCall = (prisma.user.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data.vaultLockedUntil).toBeNull();
  });

  it("deverrouillage reussi reinitialise le compteur d'echecs a 0", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(
      makeVaultUser({ vaultFailedAttempts: 3 }),
    );
    // Simule status après unlock
    (prisma.user.findUnique as jest.Mock).mockResolvedValueOnce(
      makeVaultUser({ vaultUnlockUntil: new Date(Date.now() + 60_000) }),
    );
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (mfaService.verifyUserTOTPCode as jest.Mock).mockResolvedValue(true);
    (PlanService.checkFeature as jest.Mock).mockResolvedValue(true);

    await VaultService.unlockVault('user-vault', 'GoodPassword1!', '123456');

    const updateCall = (prisma.user.update as jest.Mock).mock.calls[0][0];
    expect(updateCall.data.vaultFailedAttempts).toBe(0);
  });
});

// ─── Suite 3 : respect du lockout temporel ───────────────────────────────────

describe('VaultService — lockout temporel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockVaultAvailable();
  });

  it("vault verrouille jusqu'a dans le futur - throw avec message precis", async () => {
    const lockedUntil = new Date(Date.now() + 10 * 60 * 1000); // +10 min
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(
      makeVaultUser({ vaultLockedUntil: lockedUntil }),
    );

    await expect(
      VaultService.unlockVault('user-vault', 'AnyPassword1!', '000000'),
    ).rejects.toThrow('verrouillé');
  });

  it('lockout expiré (date dans le passé) → la tentative est autorisée (throw pour mauvais identifiants)', async () => {
    const expiredLock = new Date(Date.now() - 1000); // passé
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(
      makeVaultUser({ vaultLockedUntil: expiredLock }),
    );
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);
    (mfaService.verifyUserTOTPCode as jest.Mock).mockResolvedValue(false);
    (prisma.user.update as jest.Mock).mockResolvedValue({});

    // Doit throw pour mauvais credentials, pas pour lockout
    await expect(
      VaultService.unlockVault('user-vault', 'WrongPwd1!', '000000'),
    ).rejects.toThrow('invalides');
  });
});

// ─── Suite 4 : timing de la session unlock ───────────────────────────────────

describe('VaultService — durée de session unlock', () => {
  it('vaultUnlockUntil est défini à now + VAULT_UNLOCK_MINUTES (défaut 10 min)', async () => {
    jest.clearAllMocks();
    delete process.env.VAULT_UNLOCK_MINUTES;
    mockVaultAvailable();

    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(makeVaultUser({ vaultFailedAttempts: 0 }))
      .mockResolvedValueOnce(makeVaultUser({ vaultUnlockUntil: new Date(Date.now() + 600_000) }));
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (mfaService.verifyUserTOTPCode as jest.Mock).mockResolvedValue(true);
    (prisma.user.update as jest.Mock).mockResolvedValue({});
    (PlanService.checkFeature as jest.Mock).mockResolvedValue(true);

    const before = Date.now();
    await VaultService.unlockVault('user-vault', 'GoodPassword1!', '123456');
    const after = Date.now();

    const updateCall = (prisma.user.update as jest.Mock).mock.calls[0][0];
    const unlockUntil: Date = updateCall.data.vaultUnlockUntil;

    expect(unlockUntil).toBeInstanceOf(Date);
    // Doit être dans la fenêtre [now+9min, now+11min] pour tolérer les timings de test
    expect(unlockUntil.getTime()).toBeGreaterThan(before + 9 * 60 * 1000);
    expect(unlockUntil.getTime()).toBeLessThan(after + 11 * 60 * 1000);
  });
});

// ─── Suite 5 : isolation vault (assertUnlockedIfVault) ───────────────────────

describe('VaultService.assertUnlockedIfVault — isolation des fichiers vault', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fichier hors vault (isVault=false) → toujours autorisé, même sans plan PRO', async () => {
    mockVaultUnavailable();
    await expect(VaultService.assertUnlockedIfVault('user-free', false)).resolves.toBeUndefined();
  });

  it('fichier vault, plan FREE → throw (fonctionnalité non disponible)', async () => {
    mockVaultUnavailable();
    await expect(VaultService.assertUnlockedIfVault('user-free', true)).rejects.toThrow(
      'plan PRO',
    );
  });

  it('fichier vault, plan PRO, vault verrouillé → throw', async () => {
    mockVaultAvailable();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      vaultEnabled: true,
      vaultUnlockUntil: new Date(Date.now() - 1000), // expiré
    });

    await expect(VaultService.assertUnlockedIfVault('user-pro', true)).rejects.toThrow(
      'verrouillé',
    );
  });

  it('fichier vault, plan PRO, vault déverrouillé → autorisé', async () => {
    mockVaultAvailable();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      vaultEnabled: true,
      vaultUnlockUntil: new Date(Date.now() + 60_000), // futur
    });

    await expect(VaultService.assertUnlockedIfVault('user-pro', true)).resolves.toBeUndefined();
  });

  it('utilisateur sans vault activé → traité comme déverrouillé (vault non utilisé)', async () => {
    mockVaultAvailable();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      vaultEnabled: false,
      vaultUnlockUntil: null,
    });

    await expect(VaultService.assertUnlockedIfVault('user-no-vault', true)).resolves.toBeUndefined();
  });
});

// ─── Suite 6 : isVaultUnlocked — états bord ──────────────────────────────────

describe('VaultService.isVaultUnlocked', () => {
  beforeEach(() => jest.clearAllMocks());

  it('vault activé, vaultUnlockUntil absent → false (session jamais ouverte)', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      vaultEnabled: true,
      vaultUnlockUntil: null,
    });
    expect(await VaultService.isVaultUnlocked('u1')).toBe(false);
  });

  it('vault activé, vaultUnlockUntil dans le passé → false (session expirée)', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      vaultEnabled: true,
      vaultUnlockUntil: new Date(Date.now() - 1),
    });
    expect(await VaultService.isVaultUnlocked('u1')).toBe(false);
  });

  it('vault activé, vaultUnlockUntil dans le futur → true', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      vaultEnabled: true,
      vaultUnlockUntil: new Date(Date.now() + 60_000),
    });
    expect(await VaultService.isVaultUnlocked('u1')).toBe(true);
  });

  it('vault non activé → true (accès libre pour les utilisateurs sans vault)', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      vaultEnabled: false,
      vaultUnlockUntil: null,
    });
    expect(await VaultService.isVaultUnlocked('u1')).toBe(true);
  });

  it('utilisateur introuvable → false (sécurité par défaut)', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
    expect(await VaultService.isVaultUnlocked('unknown')).toBe(false);
  });
});
