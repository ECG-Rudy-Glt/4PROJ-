import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { mfaService } from './mfaService';
import { PlanService } from './planService';

const DEFAULT_UNLOCK_MINUTES = 10;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
const VAULT_ROOT_NAME = 'Coffre-fort';

export class VaultService {
  private static async assertVaultFeatureAvailable(userId: string) {
    const available = await PlanService.checkFeature(userId, 'vault');
    if (!available) {
      throw new Error('Le coffre-fort est disponible à partir du plan PRO');
    }
  }

  private static getUnlockDurationMs() {
    const minutes = parseInt(process.env.VAULT_UNLOCK_MINUTES || `${DEFAULT_UNLOCK_MINUTES}`, 10);
    return Math.max(1, minutes) * 60 * 1000;
  }

  private static validatePasswordStrength(password: string) {
    if (!password || password.length < 12) {
      throw new Error('Le mot de passe du coffre-fort doit contenir au moins 12 caractères');
    }

    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasDigit = /\d/.test(password);
    const hasSpecial = /[^A-Za-z0-9]/.test(password);

    if (!hasUpper || !hasLower || !hasDigit || !hasSpecial) {
      throw new Error('Le mot de passe du coffre-fort doit contenir majuscule, minuscule, chiffre et caractère spécial');
    }
  }

  static async getStatus(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        plan: true,
        mfaEnabled: true,
        vaultEnabled: true,
        vaultUnlockUntil: true,
        vaultLockedUntil: true,
        vaultFailedAttempts: true,
        vaultLastUnlockedAt: true,
      },
    });

    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }

    const now = new Date();
    const unlocked = !!user.vaultEnabled && !!user.vaultUnlockUntil && user.vaultUnlockUntil > now;

    return {
      available: await PlanService.checkFeature(userId, 'vault'),
      plan: user.plan,
      enabled: user.vaultEnabled,
      mfaEnabled: user.mfaEnabled,
      unlocked,
      unlockUntil: user.vaultUnlockUntil,
      lockedUntil: user.vaultLockedUntil,
      failedAttempts: user.vaultFailedAttempts,
      lastUnlockedAt: user.vaultLastUnlockedAt,
    };
  }

  static async setupVault(userId: string, password: string, totpCode: string) {
    await this.assertVaultFeatureAvailable(userId);
    this.validatePasswordStrength(password);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        mfaEnabled: true,
        vaultEnabled: true,
      },
    });

    if (!user) {
      throw new Error('Utilisateur non trouvé');
    }
    if (!user.mfaEnabled) {
      throw new Error('Le MFA doit être activé avant le coffre-fort');
    }
    if (user.vaultEnabled) {
      throw new Error('Le coffre-fort est déjà activé');
    }

    const totpValid = await mfaService.verifyUserTOTPCode(userId, totpCode);
    if (!totpValid) {
      throw new Error('Code MFA invalide');
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const unlockUntil = new Date(Date.now() + this.getUnlockDurationMs());

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          vaultEnabled: true,
          vaultPasswordHash: passwordHash,
          vaultUnlockUntil: unlockUntil,
          vaultLockedUntil: null,
          vaultFailedAttempts: 0,
          vaultLastUnlockedAt: new Date(),
        },
      });

      const existingVaultFolder = await tx.folder.findFirst({
        where: {
          userId,
          name: VAULT_ROOT_NAME,
          parentId: null,
          isVault: true,
        },
      });

      if (!existingVaultFolder) {
        await tx.folder.create({
          data: {
            userId,
            name: VAULT_ROOT_NAME,
            path: `/${VAULT_ROOT_NAME}`,
            parentId: null,
            isVault: true,
          },
        });
      }
    });

    return await this.getStatus(userId);
  }

  static async unlockVault(userId: string, password: string, totpCode: string) {
    await this.assertVaultFeatureAvailable(userId);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        mfaEnabled: true,
        vaultEnabled: true,
        vaultPasswordHash: true,
        vaultLockedUntil: true,
        vaultFailedAttempts: true,
      },
    });

    if (!user || !user.vaultEnabled || !user.vaultPasswordHash) {
      throw new Error('Coffre-fort non configuré');
    }
    if (!user.mfaEnabled) {
      throw new Error('Le MFA doit rester activé pour déverrouiller le coffre-fort');
    }

    const now = new Date();
    if (user.vaultLockedUntil && user.vaultLockedUntil > now) {
      throw new Error(`Coffre-fort temporairement verrouillé jusqu'à ${user.vaultLockedUntil.toISOString()}`);
    }

    const passwordValid = await bcrypt.compare(password, user.vaultPasswordHash);
    const totpValid = await mfaService.verifyUserTOTPCode(userId, totpCode);

    if (!passwordValid || !totpValid) {
      const failedAttempts = user.vaultFailedAttempts + 1;
      const shouldLock = failedAttempts >= MAX_FAILED_ATTEMPTS;
      await prisma.user.update({
        where: { id: userId },
        data: {
          vaultFailedAttempts: failedAttempts,
          vaultLockedUntil: shouldLock ? new Date(Date.now() + LOCK_MINUTES * 60 * 1000) : null,
          vaultUnlockUntil: null,
        },
      });
      throw new Error('Identifiants coffre-fort invalides');
    }

    const unlockUntil = new Date(Date.now() + this.getUnlockDurationMs());
    await prisma.user.update({
      where: { id: userId },
      data: {
        vaultUnlockUntil: unlockUntil,
        vaultLockedUntil: null,
        vaultFailedAttempts: 0,
        vaultLastUnlockedAt: now,
      },
    });

    return await this.getStatus(userId);
  }

  static async lockVault(userId: string) {
    await this.assertVaultFeatureAvailable(userId);
    await prisma.user.update({
      where: { id: userId },
      data: {
        vaultUnlockUntil: null,
      },
    });

    return await this.getStatus(userId);
  }

  static async rotateVaultPassword(userId: string, oldPassword: string, newPassword: string, totpCode: string) {
    await this.assertVaultFeatureAvailable(userId);
    this.validatePasswordStrength(newPassword);

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        vaultEnabled: true,
        vaultPasswordHash: true,
      },
    });

    if (!user || !user.vaultEnabled || !user.vaultPasswordHash) {
      throw new Error('Coffre-fort non configuré');
    }

    const oldPasswordValid = await bcrypt.compare(oldPassword, user.vaultPasswordHash);
    if (!oldPasswordValid) {
      throw new Error('Mot de passe coffre-fort actuel invalide');
    }

    const totpValid = await mfaService.verifyUserTOTPCode(userId, totpCode);
    if (!totpValid) {
      throw new Error('Code MFA invalide');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: {
        vaultPasswordHash: passwordHash,
        vaultUnlockUntil: new Date(Date.now() + this.getUnlockDurationMs()),
        vaultFailedAttempts: 0,
        vaultLockedUntil: null,
      },
    });

    return await this.getStatus(userId);
  }

  static async isVaultUnlocked(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        vaultEnabled: true,
        vaultUnlockUntil: true,
      },
    });

    if (!user || !user.vaultEnabled) {
      return true;
    }

    return !!user.vaultUnlockUntil && user.vaultUnlockUntil > new Date();
  }

  static async assertUnlockedIfVault(userId: string, isVault: boolean) {
    if (!isVault) return;
    await this.assertVaultFeatureAvailable(userId);
    const unlocked = await this.isVaultUnlocked(userId);
    if (!unlocked) {
      throw new Error('Coffre-fort verrouillé. Déverrouillez-le pour accéder à ce contenu.');
    }
  }

  static async isVaultFolder(userId: string, folderId?: string | null): Promise<boolean> {
    if (!folderId) return false;
    const folder = await prisma.folder.findFirst({
      where: {
        id: folderId,
        userId,
      },
      select: {
        isVault: true,
      },
    });
    return folder?.isVault || false;
  }

  static async getVaultRootFolder(userId: string) {
    return await prisma.folder.findFirst({
      where: {
        userId,
        parentId: null,
        isVault: true,
      },
      select: {
        id: true,
        name: true,
        path: true,
        isVault: true,
      },
    });
  }
}
