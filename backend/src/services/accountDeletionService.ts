import bcrypt from 'bcryptjs';
import path from 'path';
import { AccountStatus, OrganizationMemberRole, Plan, Role, SubscriptionStatus } from '@prisma/client';
import prisma from '../config/database';
import logger from '../config/logger';
import { AppError } from '../middlewares/errorHandler';
import { mfaService } from './mfaService';
import { BillingService } from './billingService';
import { StorageService } from './storageService';
import { PlanService } from './planService';
import { BrainService } from './brainService';

export interface DeleteAccountInput {
  confirmationEmail: string;
  currentPassword?: string;
  mfaCode?: string;
}

type OwnedFileForDeletion = {
  id: string;
  storagePath: string;
  thumbnailPath: string | null;
  versions: Array<{ storagePath: string }>;
};

type UserForDeletion = {
  id: string;
  email: string;
  password: string | null;
  role: Role;
  mfaEnabled: boolean;
  stripeCustomerId: string | null;
  avatar: string | null;
};

export class AccountDeletionService {
  private static normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private static anonymizedEmail(userId: string): string {
    return `deleted-${userId}@deleted.supfile.local`;
  }

  private static getAvatarStoragePath(avatar?: string | null): string | null {
    if (!avatar || !avatar.startsWith('/uploads/avatars/')) {
      return null;
    }

    const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';
    return path.join(uploadDir, 'avatars', path.basename(avatar));
  }

  private static collectStoragePaths(files: OwnedFileForDeletion[], avatar?: string | null): string[] {
    const storagePaths = new Set<string>();

    for (const file of files) {
      storagePaths.add(file.storagePath);
      if (file.thumbnailPath) storagePaths.add(file.thumbnailPath);
      for (const version of file.versions) {
        storagePaths.add(version.storagePath);
      }
    }

    const avatarPath = this.getAvatarStoragePath(avatar);
    if (avatarPath) storagePaths.add(avatarPath);

    return [...storagePaths].filter(Boolean);
  }

  private static async deleteStorageBestEffort(paths: string[]): Promise<void> {
    for (const storagePath of paths) {
      try {
        await StorageService.deleteStorageFile(storagePath);
      } catch (error) {
        logger.error({ err: error, storagePath }, '[AccountDeletion] Failed to delete storage object');
      }
    }
  }

  private static async deleteFileEmbeddingsBestEffort(files: OwnedFileForDeletion[]): Promise<void> {
    for (const file of files) {
      try {
        await BrainService.deleteFile(file.id);
      } catch (error) {
        logger.error({ err: error, fileId: file.id }, '[AccountDeletion] Failed to delete file embeddings');
      }
    }
  }

  private static async assertCredentials(user: UserForDeletion, input: DeleteAccountInput): Promise<void> {
    if (this.normalizeEmail(input.confirmationEmail || '') !== this.normalizeEmail(user.email)) {
      throw new AppError(400, "L'adresse e-mail de confirmation ne correspond pas.", 'ACCOUNT_DELETE_EMAIL_MISMATCH');
    }

    if (user.password) {
      if (!input.currentPassword) {
        throw new AppError(400, 'Mot de passe actuel requis.', 'ACCOUNT_DELETE_PASSWORD_REQUIRED');
      }

      const passwordValid = await bcrypt.compare(input.currentPassword, user.password);
      if (!passwordValid) {
        throw new AppError(400, 'Mot de passe actuel invalide.', 'ACCOUNT_DELETE_PASSWORD_INVALID');
      }
    }

    if (user.mfaEnabled) {
      if (!input.mfaCode) {
        throw new AppError(400, 'Code MFA requis.', 'ACCOUNT_DELETE_MFA_REQUIRED');
      }

      const mfaCode = input.mfaCode.trim();
      const totpValid = await mfaService.verifyUserTOTPCode(user.id, mfaCode);
      const backupValid = totpValid ? false : await mfaService.verifyBackupCode(user.id, mfaCode);
      if (!totpValid && !backupValid) {
        throw new AppError(400, 'Code MFA invalide.', 'ACCOUNT_DELETE_MFA_INVALID');
      }
    }
  }

  private static async assertAdminCanDelete(user: UserForDeletion): Promise<void> {
    if (user.role !== Role.ADMIN) return;

    const activeAdminCount = await prisma.user.count({
      where: {
        role: Role.ADMIN,
        accountStatus: AccountStatus.ACTIVE,
      },
    });

    if (activeAdminCount <= 1) {
      throw new AppError(409, 'Impossible de supprimer le dernier administrateur actif.', 'LAST_ADMIN_DELETE_BLOCKED');
    }
  }

  private static async getOrganizationDeletionState(userId: string) {
    const memberships = await prisma.organizationMember.findMany({
      where: { userId },
      select: {
        organizationId: true,
        role: true,
        organization: {
          select: {
            id: true,
            name: true,
            _count: { select: { members: true } },
            members: {
              where: { role: OrganizationMemberRole.OWNER },
              select: { id: true, userId: true },
              take: 2,
            },
          },
        },
      },
    });

    const blockedOrganization = memberships.find((membership) => (
      membership.role === OrganizationMemberRole.OWNER
      && membership.organization._count.members > 1
      && membership.organization.members.length <= 1
    ));

    if (blockedOrganization) {
      throw new AppError(
        409,
        `Transférez la propriété de l'organisation "${blockedOrganization.organization.name}" avant de supprimer votre compte.`,
        'ORGANIZATION_OWNER_DELETE_BLOCKED'
      );
    }

    return {
      singleMemberOrganizationIds: memberships
        .filter((membership) => membership.organization._count.members === 1)
        .map((membership) => membership.organizationId),
    };
  }

  private static async loadOwnedFiles(userId: string): Promise<OwnedFileForDeletion[]> {
    return prisma.file.findMany({
      where: { userId },
      select: {
        id: true,
        storagePath: true,
        thumbnailPath: true,
        versions: {
          select: { storagePath: true },
        },
      },
    });
  }

  static async deleteAccount(userId: string, input: DeleteAccountInput) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        password: true,
        role: true,
        mfaEnabled: true,
        stripeCustomerId: true,
        avatar: true,
      },
    });

    if (!user) {
      throw new AppError(404, 'Utilisateur introuvable.');
    }

    await this.assertCredentials(user, input);
    await this.assertAdminCanDelete(user);
    const organizationState = await this.getOrganizationDeletionState(user.id);

    if (user.stripeCustomerId) {
      await BillingService.cancelCustomerSubscriptions(user.stripeCustomerId);
    }

    const ownedFiles = await this.loadOwnedFiles(user.id);
    const storagePaths = this.collectStoragePaths(ownedFiles, user.avatar);
    const freeQuotaLimit = PlanService.getStorageLimit(Plan.FREE);

    await prisma.$transaction(async (tx) => {
      await tx.sharedFile.deleteMany({
        where: { OR: [{ sharedById: user.id }, { sharedWithId: user.id }] },
      });
      await tx.sharedFolder.deleteMany({
        where: { OR: [{ sharedById: user.id }, { sharedWithId: user.id }] },
      });
      await tx.sharedLink.deleteMany({ where: { userId: user.id } });

      await tx.comment.deleteMany({ where: { userId: user.id } });
      await tx.file.deleteMany({ where: { userId: user.id } });
      await tx.folder.deleteMany({ where: { userId: user.id } });
      await tx.tag.deleteMany({ where: { userId: user.id } });

      await tx.accountSwitchLink.deleteMany({
        where: { OR: [{ rootUserId: user.id }, { targetUserId: user.id }] },
      });
      await tx.delegation.deleteMany({
        where: { OR: [{ ownerUserId: user.id }, { delegateUserId: user.id }] },
      });

      await tx.trustedDevice.deleteMany({ where: { userId: user.id } });
      await tx.refreshToken.deleteMany({ where: { userId: user.id } });
      await tx.passwordResetToken.deleteMany({ where: { userId: user.id } });
      await tx.pushSubscription.deleteMany({ where: { userId: user.id } });
      await tx.expoPushToken.deleteMany({ where: { userId: user.id } });
      await tx.notification.deleteMany({ where: { userId: user.id } });
      await tx.conversation.deleteMany({ where: { userId: user.id } });
      await tx.auditLog.deleteMany({ where: { userId: user.id } });

      if (organizationState.singleMemberOrganizationIds.length > 0) {
        await tx.organization.deleteMany({
          where: { id: { in: organizationState.singleMemberOrganizationIds } },
        });
      }
      await tx.organizationMember.deleteMany({ where: { userId: user.id } });

      await tx.user.update({
        where: { id: user.id },
        data: {
          email: this.anonymizedEmail(user.id),
          password: null,
          firstName: null,
          lastName: null,
          avatar: null,
          role: Role.USER,
          accountStatus: AccountStatus.INACTIVE,
          provider: 'deleted',
          providerId: null,
          quotaUsed: BigInt(0),
          quotaLimit: freeQuotaLimit,
          theme: 'light',
          language: 'fr',
          plan: Plan.FREE,
          subscriptionStatus: SubscriptionStatus.CANCELED,
          stripeCustomerId: null,
          vaultEnabled: false,
          vaultPasswordHash: null,
          vaultUnlockUntil: null,
          vaultLockedUntil: null,
          vaultFailedAttempts: 0,
          vaultLastUnlockedAt: null,
          mfaEnabled: false,
          mfaSecret: null,
          mfaBackupCodes: [],
          mfaSetupAt: null,
          kekSalt: null,
          encryptedDek: null,
          tokenVersion: { increment: 1 },
          currentOrganizationId: null,
        },
      });
    });

    await this.deleteStorageBestEffort(storagePaths);
    await this.deleteFileEmbeddingsBestEffort(ownedFiles);

    logger.info({ userId: user.id }, '[AccountDeletion] Account deleted and anonymized');
    return { message: 'Compte supprimé avec succès' };
  }
}
