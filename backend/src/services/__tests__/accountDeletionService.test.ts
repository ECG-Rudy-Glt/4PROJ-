import bcrypt from 'bcryptjs';
import prisma from '../../config/database';
import { AccountDeletionService } from '../accountDeletionService';
import { BillingService } from '../billingService';
import { mfaService } from '../mfaService';
import { StorageService } from '../storageService';
import { BrainService } from '../brainService';

const tx = {
  sharedFile: { deleteMany: jest.fn() },
  sharedFolder: { deleteMany: jest.fn() },
  sharedLink: { deleteMany: jest.fn() },
  comment: { deleteMany: jest.fn() },
  file: { deleteMany: jest.fn() },
  folder: { deleteMany: jest.fn() },
  tag: { deleteMany: jest.fn() },
  accountSwitchLink: { deleteMany: jest.fn() },
  delegation: { deleteMany: jest.fn() },
  trustedDevice: { deleteMany: jest.fn() },
  refreshToken: { deleteMany: jest.fn() },
  passwordResetToken: { deleteMany: jest.fn() },
  pushSubscription: { deleteMany: jest.fn() },
  expoPushToken: { deleteMany: jest.fn() },
  notification: { deleteMany: jest.fn() },
  conversation: { deleteMany: jest.fn() },
  auditLog: { deleteMany: jest.fn() },
  organization: { deleteMany: jest.fn() },
  organizationMember: { deleteMany: jest.fn() },
  user: { update: jest.fn() },
};

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      count: jest.fn(),
    },
    organizationMember: {
      findMany: jest.fn(),
    },
    file: {
      findMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
}));

jest.mock('../billingService', () => ({
  BillingService: {
    cancelCustomerSubscriptions: jest.fn(),
  },
}));

jest.mock('../mfaService', () => ({
  mfaService: {
    verifyUserTOTPCode: jest.fn(),
    verifyBackupCode: jest.fn(),
  },
}));

jest.mock('../storageService', () => ({
  StorageService: {
    deleteStorageFile: jest.fn(),
  },
}));

jest.mock('../brainService', () => ({
  BrainService: {
    deleteFile: jest.fn(),
  },
}));

jest.mock('../planService', () => ({
  PlanService: {
    getStorageLimit: jest.fn().mockReturnValue(BigInt(32212254720)),
  },
}));

jest.mock('../../config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}));

const baseUser = {
  id: 'user-1',
  email: 'user@example.com',
  password: 'hashed-password',
  role: 'USER',
  mfaEnabled: false,
  stripeCustomerId: null,
  avatar: null,
};

describe('AccountDeletionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    Object.values(tx).forEach((model) => {
      Object.values(model).forEach((fn) => (fn as jest.Mock).mockResolvedValue({ count: 1 }));
    });

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(baseUser);
    (prisma.user.count as jest.Mock).mockResolvedValue(2);
    (prisma.organizationMember.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.file.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(tx));
    (bcrypt.compare as jest.Mock).mockResolvedValue(true);
    (mfaService.verifyUserTOTPCode as jest.Mock).mockResolvedValue(true);
    (mfaService.verifyBackupCode as jest.Mock).mockResolvedValue(false);
    (BillingService.cancelCustomerSubscriptions as jest.Mock).mockResolvedValue({ canceled: 1 });
    (StorageService.deleteStorageFile as jest.Mock).mockResolvedValue(undefined);
    (BrainService.deleteFile as jest.Mock).mockResolvedValue(undefined);
  });

  it('refuses an invalid confirmation email', async () => {
    await expect(AccountDeletionService.deleteAccount('user-1', {
      confirmationEmail: 'wrong@example.com',
      currentPassword: 'password',
    })).rejects.toMatchObject({
      statusCode: 400,
      code: 'ACCOUNT_DELETE_EMAIL_MISMATCH',
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires the current password for local accounts', async () => {
    await expect(AccountDeletionService.deleteAccount('user-1', {
      confirmationEmail: 'user@example.com',
    })).rejects.toMatchObject({
      statusCode: 400,
      code: 'ACCOUNT_DELETE_PASSWORD_REQUIRED',
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses an invalid current password', async () => {
    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    await expect(AccountDeletionService.deleteAccount('user-1', {
      confirmationEmail: 'user@example.com',
      currentPassword: 'bad-password',
    })).rejects.toMatchObject({
      statusCode: 400,
      code: 'ACCOUNT_DELETE_PASSWORD_INVALID',
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('requires MFA when MFA is enabled', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...baseUser, mfaEnabled: true });

    await expect(AccountDeletionService.deleteAccount('user-1', {
      confirmationEmail: 'user@example.com',
      currentPassword: 'password',
    })).rejects.toMatchObject({
      statusCode: 400,
      code: 'ACCOUNT_DELETE_MFA_REQUIRED',
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses an invalid MFA code', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...baseUser, mfaEnabled: true });
    (mfaService.verifyUserTOTPCode as jest.Mock).mockResolvedValue(false);
    (mfaService.verifyBackupCode as jest.Mock).mockResolvedValue(false);

    await expect(AccountDeletionService.deleteAccount('user-1', {
      confirmationEmail: 'user@example.com',
      currentPassword: 'password',
      mfaCode: '000000',
    })).rejects.toMatchObject({
      statusCode: 400,
      code: 'ACCOUNT_DELETE_MFA_INVALID',
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('accepts a backup code, cancels Stripe first, cleans records and anonymizes the user', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...baseUser,
      mfaEnabled: true,
      stripeCustomerId: 'cus_test_123',
    });
    (mfaService.verifyUserTOTPCode as jest.Mock).mockResolvedValue(false);
    (mfaService.verifyBackupCode as jest.Mock).mockResolvedValue(true);
    (prisma.file.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'file-1',
        storagePath: 'files/user-1/current.enc',
        thumbnailPath: 'files/user-1/thumb.enc',
        versions: [{ storagePath: 'versions/file-1/v1.enc' }],
      },
    ]);

    await expect(AccountDeletionService.deleteAccount('user-1', {
      confirmationEmail: 'user@example.com',
      currentPassword: 'password',
      mfaCode: 'BACKUP1',
    })).resolves.toEqual({ message: 'Compte supprimé avec succès' });

    expect(BillingService.cancelCustomerSubscriptions).toHaveBeenCalledWith('cus_test_123');
    expect((BillingService.cancelCustomerSubscriptions as jest.Mock).mock.invocationCallOrder[0])
      .toBeLessThan((prisma.$transaction as jest.Mock).mock.invocationCallOrder[0]);
    expect(tx.sharedFile.deleteMany).toHaveBeenCalledWith({
      where: { OR: [{ sharedById: 'user-1' }, { sharedWithId: 'user-1' }] },
    });
    expect(tx.file.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(tx.refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: expect.objectContaining({
        email: 'deleted-user-1@deleted.supfile.local',
        password: null,
        accountStatus: 'INACTIVE',
        provider: 'deleted',
        plan: 'FREE',
        subscriptionStatus: 'CANCELED',
        stripeCustomerId: null,
        quotaUsed: BigInt(0),
        mfaEnabled: false,
        mfaSecret: null,
        encryptedDek: null,
        tokenVersion: { increment: 1 },
      }),
    });
    expect(StorageService.deleteStorageFile).toHaveBeenCalledWith('files/user-1/current.enc');
    expect(StorageService.deleteStorageFile).toHaveBeenCalledWith('files/user-1/thumb.enc');
    expect(StorageService.deleteStorageFile).toHaveBeenCalledWith('versions/file-1/v1.enc');
    expect(BrainService.deleteFile).toHaveBeenCalledWith('file-1');
  });

  it('does not mutate the account when Stripe cancellation fails', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...baseUser,
      stripeCustomerId: 'cus_test_123',
    });
    (BillingService.cancelCustomerSubscriptions as jest.Mock).mockRejectedValue(new Error('Stripe down'));

    await expect(AccountDeletionService.deleteAccount('user-1', {
      confirmationEmail: 'user@example.com',
      currentPassword: 'password',
    })).rejects.toThrow('Stripe down');

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(StorageService.deleteStorageFile).not.toHaveBeenCalled();
  });

  it('blocks deletion of the last active admin', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({ ...baseUser, role: 'ADMIN' });
    (prisma.user.count as jest.Mock).mockResolvedValue(1);

    await expect(AccountDeletionService.deleteAccount('user-1', {
      confirmationEmail: 'user@example.com',
      currentPassword: 'password',
    })).rejects.toMatchObject({
      statusCode: 409,
      code: 'LAST_ADMIN_DELETE_BLOCKED',
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('blocks deletion when the user is the sole owner of an organization with other members', async () => {
    (prisma.organizationMember.findMany as jest.Mock).mockResolvedValue([
      {
        organizationId: 'org-1',
        role: 'OWNER',
        organization: {
          id: 'org-1',
          name: 'SupFile Org',
          _count: { members: 3 },
          members: [{ id: 'member-owner', userId: 'user-1' }],
        },
      },
    ]);

    await expect(AccountDeletionService.deleteAccount('user-1', {
      confirmationEmail: 'user@example.com',
      currentPassword: 'password',
    })).rejects.toMatchObject({
      statusCode: 409,
      code: 'ORGANIZATION_OWNER_DELETE_BLOCKED',
    });

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
