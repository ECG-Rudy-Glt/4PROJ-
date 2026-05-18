import prisma from '../../config/database';
import { AccountAccessService } from '../accountAccessService';
import { generateToken } from '../../utils/jwt';
import { MailService } from '../mailService';
import { NotificationService } from '../notificationService';

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    accountSwitchLink: {
      findFirst: jest.fn(),
    },
    delegation: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../../utils/jwt', () => ({
  generateToken: jest.fn(),
}));

jest.mock('../mailService', () => ({
  MailService: {
    sendDelegationGrantedNotification: jest.fn(),
    sendDelegationRevokedNotification: jest.fn(),
  },
}));

jest.mock('../notificationService', () => ({
  NotificationService: {
    create: jest.fn(),
  },
}));

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

const baseTargetUser = {
  id: 'target-user',
  email: 'target@example.com',
  firstName: 'Target',
  lastName: 'User',
  avatar: null,
  role: 'USER',
  accountStatus: 'ACTIVE',
  plan: 'PRO',
  subscriptionStatus: 'ACTIVE',
  vaultEnabled: true,
  currentOrganizationId: null,
  quotaUsed: BigInt(10),
  quotaLimit: BigInt(1000),
  theme: 'light',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  tokenVersion: 7,
};

const createLink = (overrides?: Partial<any>) => ({
  id: 'link-1',
  rootUserId: 'root-user',
  targetUserId: 'target-user',
  label: null,
  expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  lastAuthenticatedAt: new Date(Date.now() - 60 * 1000),
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  revokedAt: null,
  targetUser: baseTargetUser,
  ...overrides,
});

describe('AccountAccessService', () => {
  const originalReauthMinutes = process.env.ACCOUNT_SWITCH_REAUTH_MINUTES;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ACCOUNT_SWITCH_REAUTH_MINUTES = '5';
    (NotificationService.create as jest.Mock).mockResolvedValue(undefined);
    (MailService.sendDelegationGrantedNotification as jest.Mock).mockResolvedValue(true);
    (MailService.sendDelegationRevokedNotification as jest.Mock).mockResolvedValue(true);
  });

  afterAll(() => {
    process.env.ACCOUNT_SWITCH_REAUTH_MINUTES = originalReauthMinutes;
  });

  describe('createSwitchToken', () => {
    it('should throw when switch link does not exist', async () => {
      (prisma.accountSwitchLink.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        AccountAccessService.createSwitchToken('root-user', 'missing-link', 'switch-session-1')
      ).rejects.toThrow('Lien de switch introuvable');
    });

    it('should require re-authentication when last auth is too old', async () => {
      (prisma.accountSwitchLink.findFirst as jest.Mock).mockResolvedValue(
        createLink({
          lastAuthenticatedAt: new Date(Date.now() - 10 * 60 * 1000),
        })
      );

      const result = await AccountAccessService.createSwitchToken(
        'root-user',
        'link-1',
        'switch-session-1'
      );

      expect(result).toEqual({ reauthRequired: true });
      expect(generateToken).not.toHaveBeenCalled();
    });

    it('should return switch token when link is valid and recent', async () => {
      (prisma.accountSwitchLink.findFirst as jest.Mock).mockResolvedValue(createLink());
      (generateToken as jest.Mock).mockReturnValue('switch-token');

      const result = await AccountAccessService.createSwitchToken(
        'root-user',
        'link-1',
        'switch-session-42'
      );

      expect(generateToken).toHaveBeenCalledWith(
        'target-user',
        'target@example.com',
        7,
        {
          switchRootUserId: 'root-user',
          switchSessionId: 'switch-session-42',
        }
      );
      expect(result).toEqual(
        expect.objectContaining({
          reauthRequired: false,
          token: 'switch-token',
          user: expect.objectContaining({
            id: 'target-user',
            email: 'target@example.com',
          }),
        })
      );
    });
  });

  describe('assumeDelegation', () => {
    it('should reject expired or revoked delegations', async () => {
      (prisma.delegation.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        AccountAccessService.assumeDelegation('delegate-user', 'delegation-1', 'switch-session-1')
      ).rejects.toThrow('Délégation invalide ou expirée');
    });

    it('should return delegation token when delegation is valid', async () => {
      (prisma.delegation.findFirst as jest.Mock).mockResolvedValue({
        id: 'delegation-1',
        canRead: true,
        canWrite: true,
        canDelete: false,
        canShare: false,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
        ownerUser: {
          ...baseTargetUser,
          id: 'owner-user',
          email: 'owner@example.com',
          tokenVersion: 12,
        },
      });
      (generateToken as jest.Mock).mockReturnValue('delegation-token');

      const result = await AccountAccessService.assumeDelegation(
        'delegate-user',
        'delegation-1',
        'switch-session-7'
      );

      expect(generateToken).toHaveBeenCalledWith(
        'owner-user',
        'owner@example.com',
        12,
        {
          switchRootUserId: 'delegate-user',
          switchSessionId: 'switch-session-7',
          delegatedByUserId: 'delegate-user',
          delegationId: 'delegation-1',
        }
      );
      expect(result).toEqual(
        expect.objectContaining({
          token: 'delegation-token',
          user: expect.objectContaining({
            id: 'owner-user',
            email: 'owner@example.com',
          }),
          delegation: expect.objectContaining({
            id: 'delegation-1',
            canRead: true,
            canWrite: true,
          }),
        })
      );
    });
  });

  describe('grantDelegation', () => {
    const owner = {
      id: 'owner-user',
      email: 'owner@example.com',
      firstName: 'Owner',
      lastName: 'User',
    };
    const delegate = {
      id: 'delegate-user',
      email: 'delegate@example.com',
      firstName: 'Delegate',
      lastName: 'User',
      accountStatus: 'ACTIVE',
      language: 'fr',
    };

    beforeEach(() => {
      (prisma.user.findUnique as jest.Mock).mockImplementation(({ where }: any) => {
        if (where.email) return Promise.resolve(delegate);
        if (where.id) return Promise.resolve(owner);
        return Promise.resolve(null);
      });
      (prisma.delegation.findFirst as jest.Mock).mockResolvedValue(null);
      (prisma.delegation.create as jest.Mock).mockResolvedValue({
        id: 'delegation-1',
        ownerUserId: 'owner-user',
        delegateUserId: 'delegate-user',
        status: 'ACTIVE',
        canRead: true,
        canWrite: false,
        canDelete: false,
        canShare: false,
        startsAt: new Date('2026-01-01T00:00:00.000Z'),
        expiresAt: null,
      });
    });

    it('refuses self-delegation', async () => {
      (prisma.user.findUnique as jest.Mock).mockImplementation(({ where }: any) => {
        if (where.email) return Promise.resolve({ ...delegate, id: 'owner-user' });
        if (where.id) return Promise.resolve(owner);
        return Promise.resolve(null);
      });

      await expect(
        AccountAccessService.grantDelegation('owner-user', { delegateEmail: 'delegate@example.com' })
      ).rejects.toThrow('Impossible de se déléguer soi-même');

      expect(prisma.delegation.create).not.toHaveBeenCalled();
      expect(MailService.sendDelegationGrantedNotification).not.toHaveBeenCalled();
    });

    it('refuses suspended delegate accounts', async () => {
      (prisma.user.findUnique as jest.Mock).mockImplementation(({ where }: any) => {
        if (where.email) return Promise.resolve({ ...delegate, accountStatus: 'SUSPENDED' });
        if (where.id) return Promise.resolve(owner);
        return Promise.resolve(null);
      });

      await expect(
        AccountAccessService.grantDelegation('owner-user', { delegateEmail: 'delegate@example.com' })
      ).rejects.toThrow('Le compte délégataire est inactif ou suspendu');

      expect(prisma.delegation.create).not.toHaveBeenCalled();
      expect(MailService.sendDelegationGrantedNotification).not.toHaveBeenCalled();
    });

    it('creates active delegation and notifies the delegate', async () => {
      const result = await AccountAccessService.grantDelegation('owner-user', {
        delegateEmail: 'delegate@example.com',
        permissions: { canWrite: true },
      });

      expect(prisma.delegation.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ownerUserId: 'owner-user',
          delegateUserId: 'delegate-user',
          canRead: true,
          canWrite: true,
        }),
      });
      expect(NotificationService.create).toHaveBeenCalledWith(
        'delegate-user',
        'SHARE',
        'Délégation accordée',
        expect.any(String),
        expect.objectContaining({ delegationId: 'delegation-1', ownerUserId: 'owner-user' })
      );
      expect(MailService.sendDelegationGrantedNotification).toHaveBeenCalledWith(
        'delegate@example.com',
        'Delegate User',
        'Owner User',
        expect.objectContaining({ canRead: true, canWrite: true }),
        null,
        'fr'
      );
      expect(result.delegateUserId).toBe('delegate-user');
    });
  });

  describe('revokeDelegation', () => {
    it('revokes active delegation and notifies the delegate', async () => {
      (prisma.delegation.findFirst as jest.Mock).mockResolvedValue({
        id: 'delegation-1',
        ownerUserId: 'owner-user',
        delegateUserId: 'delegate-user',
        delegateUser: {
          id: 'delegate-user',
          email: 'delegate@example.com',
          firstName: 'Delegate',
          lastName: 'User',
          language: 'fr',
        },
        ownerUser: {
          id: 'owner-user',
          email: 'owner@example.com',
          firstName: 'Owner',
          lastName: 'User',
        },
      });
      (prisma.delegation.update as jest.Mock).mockResolvedValue({
        id: 'delegation-1',
        ownerUserId: 'owner-user',
        delegateUserId: 'delegate-user',
        status: 'REVOKED',
      });

      const result = await AccountAccessService.revokeDelegation('owner-user', 'delegation-1');

      expect(prisma.delegation.update).toHaveBeenCalledWith({
        where: { id: 'delegation-1' },
        data: {
          status: 'REVOKED',
          revokedAt: expect.any(Date),
        },
      });
      expect(NotificationService.create).toHaveBeenCalledWith(
        'delegate-user',
        'SHARE',
        'Délégation révoquée',
        expect.any(String),
        { delegationId: 'delegation-1', ownerUserId: 'owner-user' }
      );
      expect(MailService.sendDelegationRevokedNotification).toHaveBeenCalledWith(
        'delegate@example.com',
        'Delegate User',
        'Owner User',
        'fr'
      );
      expect(result.status).toBe('REVOKED');
    });
  });
});
