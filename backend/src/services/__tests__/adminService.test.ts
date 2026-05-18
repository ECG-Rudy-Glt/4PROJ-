import prisma from '../../config/database';
import { AdminService } from '../adminService';
import { AuditService } from '../auditService';
import { MailService } from '../mailService';
import { NotificationService } from '../notificationService';

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    refreshToken: {
      updateMany: jest.fn(),
    },
  },
}));

jest.mock('../auditService', () => ({
  AuditService: {
    createLog: jest.fn(),
  },
}));

jest.mock('../mailService', () => ({
  MailService: {
    sendAccountStatusNotification: jest.fn(),
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

const existingUser = {
  id: 'target-user',
  email: 'target@example.com',
  firstName: 'Target',
  lastName: 'User',
  accountStatus: 'ACTIVE',
  language: 'fr',
};

const updatedUser = {
  id: 'target-user',
  email: 'target@example.com',
  firstName: 'Target',
  lastName: 'User',
  role: 'USER',
  accountStatus: 'SUSPENDED',
  plan: 'FREE',
  subscriptionStatus: 'ACTIVE',
  quotaUsed: BigInt(10),
  quotaLimit: BigInt(100),
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  lastActiveAt: new Date('2026-01-02T00:00:00.000Z'),
};

describe('AdminService.updateUserStatus', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AuditService.createLog as jest.Mock).mockResolvedValue(undefined);
    (NotificationService.create as jest.Mock).mockResolvedValue(undefined);
    (MailService.sendAccountStatusNotification as jest.Mock).mockResolvedValue(true);
    (prisma.refreshToken.updateMany as jest.Mock).mockResolvedValue({ count: 2 });
  });

  it('suspends a user, increments token version, revokes refresh tokens, audits and notifies', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(existingUser);
    (prisma.user.update as jest.Mock).mockResolvedValue(updatedUser);

    const result = await AdminService.updateUserStatus('admin-user', 'target-user', 'SUSPENDED', 'Abus');

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'target-user' },
        data: {
          accountStatus: 'SUSPENDED',
          tokenVersion: { increment: 1 },
        },
      })
    );
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { userId: 'target-user', revoked: false },
      data: { revoked: true },
    });
    expect(AuditService.createLog).toHaveBeenCalledWith('admin-user', 'ADMIN_ACCOUNT_STATUS_CHANGE', {
      targetUserId: 'target-user',
      previousStatus: 'ACTIVE',
      newStatus: 'SUSPENDED',
      reason: 'Abus',
      revokedSessions: true,
    });
    expect(NotificationService.create).toHaveBeenCalledWith(
      'target-user',
      'SHARE',
      'Compte suspendu',
      expect.any(String),
      { status: 'SUSPENDED', reason: 'Abus' }
    );
    expect(MailService.sendAccountStatusNotification).toHaveBeenCalledWith(
      'target@example.com',
      'Target User',
      'SUSPENDED',
      'Abus',
      'fr'
    );
    expect(result.quotaUsed).toBe(10);
    expect(result.quotaLimit).toBe(100);
  });

  it('refuses admin self-suspension', async () => {
    await expect(
      AdminService.updateUserStatus('admin-user', 'admin-user', 'SUSPENDED')
    ).rejects.toThrow('Un administrateur ne peut pas suspendre son propre compte');

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('reactivates a user without re-enabling old refresh tokens', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      ...existingUser,
      accountStatus: 'SUSPENDED',
    });
    (prisma.user.update as jest.Mock).mockResolvedValue({
      ...updatedUser,
      accountStatus: 'ACTIVE',
    });

    await AdminService.updateUserStatus('admin-user', 'target-user', 'ACTIVE');

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { accountStatus: 'ACTIVE' },
      })
    );
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    expect(MailService.sendAccountStatusNotification).toHaveBeenCalledWith(
      'target@example.com',
      'Target User',
      'ACTIVE',
      undefined,
      'fr'
    );
  });
});

describe('AdminService.updateUserRole', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (AuditService.createLog as jest.Mock).mockResolvedValue(undefined);
  });

  it('promotes a user to admin and audits the change', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'target-user',
      role: 'USER',
    });
    (prisma.user.update as jest.Mock).mockResolvedValue({
      ...updatedUser,
      role: 'ADMIN',
      accountStatus: 'ACTIVE',
    });

    const result = await AdminService.updateUserRole('admin-user', 'target-user', 'ADMIN');

    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'target-user' },
        data: { role: 'ADMIN' },
      })
    );
    expect(AuditService.createLog).toHaveBeenCalledWith('admin-user', 'ADMIN_ROLE_CHANGE', {
      targetUserId: 'target-user',
      previousRole: 'USER',
      newRole: 'ADMIN',
    });
    expect(result.role).toBe('ADMIN');
  });

  it('refuses admin self role changes', async () => {
    await expect(
      AdminService.updateUserRole('admin-user', 'admin-user', 'USER')
    ).rejects.toThrow('Un administrateur ne peut pas modifier son propre rôle');

    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses removing the last admin', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'target-user',
      role: 'ADMIN',
    });
    (prisma.user.count as jest.Mock).mockResolvedValue(1);

    await expect(
      AdminService.updateUserRole('admin-user', 'target-user', 'USER')
    ).rejects.toThrow('Impossible de retirer le dernier administrateur');

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
