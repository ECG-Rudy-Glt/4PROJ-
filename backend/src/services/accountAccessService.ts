import bcrypt from 'bcryptjs';
import prisma from '../config/database';
import { mfaService } from './mfaService';
import { generateToken } from '../utils/jwt';
import { MailService } from './mailService';
import { NotificationService } from './notificationService';
import logger from '../config/logger';
import { AppError } from '../middlewares/errorHandler';

type DelegationPermissionsInput = {
  canRead?: boolean;
  canWrite?: boolean;
  canDelete?: boolean;
  canShare?: boolean;
};

const nowPlusHours = (hours: number) => new Date(Date.now() + hours * 60 * 60 * 1000);

const displayName = (user?: { email?: string | null; firstName?: string | null; lastName?: string | null }) => {
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(' ').trim();
  return fullName || user?.email || 'Utilisateur';
};

export class AccountAccessService {
  private static getSwitchLinkTtlHours() {
    const parsed = parseInt(process.env.ACCOUNT_SWITCH_LINK_HOURS || '12', 10);
    return Math.max(1, Math.min(parsed, 72));
  }

  private static getSwitchReauthMinutes() {
    const parsed = parseInt(process.env.ACCOUNT_SWITCH_REAUTH_MINUTES || '45', 10);
    return Math.max(5, Math.min(parsed, 240));
  }

  private static mapUserForClient(user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    avatar: string | null;
    role: 'USER' | 'ADMIN';
    accountStatus: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
    plan: 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE';
    subscriptionStatus: 'ACTIVE' | 'PAST_DUE' | 'CANCELED' | 'INCOMPLETE' | 'TRIALING';
    vaultEnabled: boolean;
    currentOrganizationId: string | null;
    quotaUsed: bigint;
    quotaLimit: bigint;
    theme: string;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      avatar: user.avatar,
      role: user.role,
      accountStatus: user.accountStatus,
      plan: user.plan,
      subscriptionStatus: user.subscriptionStatus,
      vaultEnabled: user.vaultEnabled,
      currentOrganizationId: user.currentOrganizationId,
      quotaUsed: Number(user.quotaUsed),
      quotaLimit: Number(user.quotaLimit),
      theme: user.theme,
      createdAt: user.createdAt,
    };
  }

  private static normalizeDelegationPermissions(input?: DelegationPermissionsInput) {
    const normalized = {
      canRead: input?.canRead ?? true,
      canWrite: input?.canWrite ?? false,
      canDelete: input?.canDelete ?? false,
      canShare: input?.canShare ?? false,
    };

    if (!normalized.canRead && (normalized.canWrite || normalized.canDelete || normalized.canShare)) {
      normalized.canRead = true;
    }

    return normalized;
  }

  static async listSwitchLinks(rootUserId: string) {
    const now = new Date();
    const links = await prisma.accountSwitchLink.findMany({
      where: {
        rootUserId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      include: {
        targetUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
            role: true,
            accountStatus: true,
            plan: true,
            subscriptionStatus: true,
            vaultEnabled: true,
            currentOrganizationId: true,
            quotaUsed: true,
            quotaLimit: true,
            theme: true,
            createdAt: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return links.map((link) => ({
      id: link.id,
      label: link.label,
      expiresAt: link.expiresAt,
      lastAuthenticatedAt: link.lastAuthenticatedAt,
      createdAt: link.createdAt,
      targetUser: this.mapUserForClient(link.targetUser),
    }));
  }

  static async linkAccount(
    rootUserId: string,
    payload: {
      email: string;
      password: string;
      mfaCode?: string;
      backupCode?: string;
      label?: string;
    }
  ) {
    const target = await prisma.user.findUnique({
      where: { email: payload.email.toLowerCase() },
      select: {
        id: true,
        email: true,
        password: true,
        firstName: true,
        lastName: true,
        avatar: true,
        role: true,
        accountStatus: true,
        plan: true,
        subscriptionStatus: true,
        vaultEnabled: true,
        currentOrganizationId: true,
        quotaUsed: true,
        quotaLimit: true,
        theme: true,
        createdAt: true,
        tokenVersion: true,
        mfaEnabled: true,
      },
    });

    if (!target || !target.password) {
      throw new AppError(401, 'Identifiants invalides');
    }
    if (target.accountStatus !== 'ACTIVE') {
      throw new AppError(403, 'Le compte cible est inactif ou suspendu');
    }
    if (target.id === rootUserId) {
      throw new AppError(400, 'Impossible de lier votre propre compte');
    }

    const passwordValid = await bcrypt.compare(payload.password, target.password);
    if (!passwordValid) {
      throw new AppError(401, 'Identifiants invalides');
    }

    if (target.mfaEnabled) {
      if (payload.mfaCode) {
        const mfaValid = await mfaService.verifyUserTOTPCode(target.id, payload.mfaCode);
        if (!mfaValid) {
          throw new AppError(401, 'Code MFA invalide');
        }
      } else if (payload.backupCode) {
        const backupValid = await mfaService.verifyBackupCode(target.id, payload.backupCode);
        if (!backupValid) {
          throw new AppError(401, 'Code de récupération invalide');
        }
      } else {
        throw new AppError(400, 'Un code MFA ou un code de récupération est requis pour ce compte');
      }
    }

    const now = new Date();
    const expiresAt = nowPlusHours(this.getSwitchLinkTtlHours());

    const existing = await prisma.accountSwitchLink.findFirst({
      where: {
        rootUserId,
        targetUserId: target.id,
        revokedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const link = existing
      ? await prisma.accountSwitchLink.update({
        where: { id: existing.id },
        data: {
          label: payload.label || existing.label,
          expiresAt,
          lastAuthenticatedAt: now,
          revokedAt: null,
        },
      })
      : await prisma.accountSwitchLink.create({
        data: {
          rootUserId,
          targetUserId: target.id,
          label: payload.label,
          expiresAt,
          lastAuthenticatedAt: now,
        },
      });

    return {
      id: link.id,
      label: link.label,
      expiresAt: link.expiresAt,
      lastAuthenticatedAt: link.lastAuthenticatedAt,
      targetUser: this.mapUserForClient(target),
    };
  }

  static async revokeSwitchLink(rootUserId: string, linkId: string) {
    const link = await prisma.accountSwitchLink.findFirst({
      where: {
        id: linkId,
        rootUserId,
        revokedAt: null,
      },
    });

    if (!link) {
      throw new Error('Lien de switch introuvable');
    }

    return prisma.accountSwitchLink.update({
      where: { id: link.id },
      data: { revokedAt: new Date() },
    });
  }

  static async createSwitchToken(rootUserId: string, linkId: string, switchSessionId: string) {
    const link = await prisma.accountSwitchLink.findFirst({
      where: {
        id: linkId,
        rootUserId,
        revokedAt: null,
      },
      include: {
        targetUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
            role: true,
            accountStatus: true,
            plan: true,
            subscriptionStatus: true,
            vaultEnabled: true,
            currentOrganizationId: true,
            quotaUsed: true,
            quotaLimit: true,
            theme: true,
            createdAt: true,
            tokenVersion: true,
          },
        },
      },
    });

    if (!link) {
      throw new AppError(404, 'Lien de switch introuvable');
    }

    const now = new Date();
    if (link.expiresAt <= now) {
      throw new AppError(400, 'Ce lien de switch a expiré, veuillez relier le compte');
    }

    const reauthMaxAgeMs = this.getSwitchReauthMinutes() * 60 * 1000;
    if (now.getTime() - link.lastAuthenticatedAt.getTime() > reauthMaxAgeMs) {
      return { reauthRequired: true as const };
    }

    if (link.targetUser.accountStatus !== 'ACTIVE') {
      throw new AppError(403, 'Le compte cible est inactif ou suspendu');
    }

    const token = generateToken(
      link.targetUser.id,
      link.targetUser.email,
      link.targetUser.tokenVersion,
      {
        switchRootUserId: rootUserId,
        switchSessionId,
      }
    );

    return {
      reauthRequired: false as const,
      token,
      user: this.mapUserForClient(link.targetUser),
    };
  }

  static async createRootToken(rootUserId: string) {
    const rootUser = await prisma.user.findUnique({
      where: { id: rootUserId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatar: true,
        role: true,
        accountStatus: true,
        plan: true,
        subscriptionStatus: true,
        vaultEnabled: true,
        currentOrganizationId: true,
        quotaUsed: true,
        quotaLimit: true,
        theme: true,
        createdAt: true,
        tokenVersion: true,
      },
    });

    if (!rootUser) {
      throw new AppError(404, 'Compte racine introuvable');
    }
    if (rootUser.accountStatus !== 'ACTIVE') {
      throw new AppError(403, 'Le compte racine est inactif ou suspendu');
    }

    const token = generateToken(rootUser.id, rootUser.email, rootUser.tokenVersion);
    return { token, user: this.mapUserForClient(rootUser) };
  }

  static async grantDelegation(
    ownerUserId: string,
    payload: {
      delegateEmail: string;
      permissions?: DelegationPermissionsInput;
      expiresAt?: string | null;
    }
  ) {
    const [delegate, owner] = await Promise.all([
      prisma.user.findUnique({
        where: { email: payload.delegateEmail.toLowerCase() },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          accountStatus: true,
          language: true,
        },
      }),
      prisma.user.findUnique({
        where: { id: ownerUserId },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
        },
      }),
    ]);

    if (!delegate) {
      throw new AppError(404, 'Aucun compte trouvé pour cet email');
    }
    if (!owner) {
      throw new AppError(404, 'Compte propriétaire introuvable');
    }
    if (delegate.accountStatus !== 'ACTIVE') {
      throw new AppError(403, 'Le compte délégataire est inactif ou suspendu');
    }
    if (delegate.id === ownerUserId) {
      throw new AppError(400, 'Vous ne pouvez pas vous déléguer à vous-même');
    }

    const now = new Date();
    const expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      throw new AppError(400, 'Date d\'expiration invalide');
    }
    if (expiresAt && expiresAt <= now) {
      throw new AppError(400, 'La date d\'expiration doit être dans le futur');
    }

    const permissions = this.normalizeDelegationPermissions(payload.permissions);
    const existing = await prisma.delegation.findFirst({
      where: {
        ownerUserId,
        delegateUserId: delegate.id,
        revokedAt: null,
      },
      orderBy: { updatedAt: 'desc' },
    });

    const delegation = existing
      ? await prisma.delegation.update({
        where: { id: existing.id },
        data: {
          status: 'ACTIVE',
          revokedAt: null,
          startsAt: now,
          expiresAt,
          ...permissions,
        },
      })
      : await prisma.delegation.create({
        data: {
          ownerUserId,
          delegateUserId: delegate.id,
          startsAt: now,
          expiresAt,
          ...permissions,
        },
      });

    NotificationService.create(
      delegate.id,
      'SHARE',
      'Délégation accordée',
      `${displayName(owner)} vous a accordé une délégation de compte`,
      {
        delegationId: delegation.id,
        ownerUserId,
        permissions,
        expiresAt,
      }
    ).catch((error) => logger.error({ err: error }, 'Failed to create delegation notification'));

    try {
      await MailService.sendDelegationGrantedNotification(
        delegate.email,
        displayName(delegate),
        displayName(owner),
        permissions,
        expiresAt,
        delegate.language
      );
    } catch (error) {
      logger.error({ err: error }, 'Failed to send delegation granted email');
    }

    return {
      id: delegation.id,
      ownerUserId: delegation.ownerUserId,
      delegateUserId: delegation.delegateUserId,
      status: delegation.status,
      canRead: delegation.canRead,
      canWrite: delegation.canWrite,
      canDelete: delegation.canDelete,
      canShare: delegation.canShare,
      startsAt: delegation.startsAt,
      expiresAt: delegation.expiresAt,
      delegate,
    };
  }

  static async listDelegations(userId: string) {
    const now = new Date();
    const activeWhere = {
      status: 'ACTIVE' as const,
      revokedAt: null,
      startsAt: { lte: now },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    };

    const [given, received] = await Promise.all([
      prisma.delegation.findMany({
        where: { ownerUserId: userId, ...activeWhere },
        include: {
          delegateUser: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              accountStatus: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.delegation.findMany({
        where: { delegateUserId: userId, ...activeWhere },
        include: {
          ownerUser: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              accountStatus: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    return { given, received };
  }

  static async revokeDelegation(ownerUserId: string, delegationId: string) {
    const delegation = await prisma.delegation.findFirst({
      where: {
        id: delegationId,
        ownerUserId,
        revokedAt: null,
      },
      include: {
        delegateUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            language: true,
          },
        },
        ownerUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });
    if (!delegation) {
      throw new AppError(404, 'Délégation introuvable ou déjà révoquée');
    }

    const revoked = await prisma.delegation.update({
      where: { id: delegation.id },
      data: {
        status: 'REVOKED',
        revokedAt: new Date(),
      },
    });

    NotificationService.create(
      delegation.delegateUser.id,
      'SHARE',
      'Délégation révoquée',
      `${displayName(delegation.ownerUser)} a révoqué votre délégation de compte`,
      {
        delegationId: delegation.id,
        ownerUserId,
      }
    ).catch((error) => logger.error({ err: error }, 'Failed to create delegation revoked notification'));

    try {
      await MailService.sendDelegationRevokedNotification(
        delegation.delegateUser.email,
        displayName(delegation.delegateUser),
        displayName(delegation.ownerUser),
        delegation.delegateUser.language
      );
    } catch (error) {
      logger.error({ err: error }, 'Failed to send delegation revoked email');
    }

    return revoked;
  }

  static async assumeDelegation(
    delegateUserId: string,
    delegationId: string,
    switchSessionId: string
  ) {
    const now = new Date();
    const delegation = await prisma.delegation.findFirst({
      where: {
        id: delegationId,
        delegateUserId,
        status: 'ACTIVE',
        revokedAt: null,
        startsAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      include: {
        ownerUser: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            avatar: true,
            role: true,
            accountStatus: true,
            plan: true,
            subscriptionStatus: true,
            vaultEnabled: true,
            currentOrganizationId: true,
            quotaUsed: true,
            quotaLimit: true,
            theme: true,
            createdAt: true,
            tokenVersion: true,
          },
        },
      },
    });

    if (!delegation) {
      throw new AppError(404, 'Délégation invalide, expirée ou révoquée');
    }
    if (delegation.ownerUser.accountStatus !== 'ACTIVE') {
      throw new AppError(403, 'Le compte propriétaire de la délégation est inactif ou suspendu');
    }

    const token = generateToken(
      delegation.ownerUser.id,
      delegation.ownerUser.email,
      delegation.ownerUser.tokenVersion,
      {
        switchRootUserId: delegateUserId,
        switchSessionId,
        delegatedByUserId: delegateUserId,
        delegationId: delegation.id,
      }
    );

    return {
      token,
      user: this.mapUserForClient(delegation.ownerUser),
      delegation: {
        id: delegation.id,
        canRead: delegation.canRead,
        canWrite: delegation.canWrite,
        canDelete: delegation.canDelete,
        canShare: delegation.canShare,
        expiresAt: delegation.expiresAt,
      },
    };
  }
}

