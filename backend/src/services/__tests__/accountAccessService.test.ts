import prisma from '../../config/database';
import { AccountAccessService } from '../accountAccessService';
import { generateToken } from '../../utils/jwt';

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    accountSwitchLink: {
      findFirst: jest.fn(),
    },
    delegation: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../../utils/jwt', () => ({
  generateToken: jest.fn(),
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
});
