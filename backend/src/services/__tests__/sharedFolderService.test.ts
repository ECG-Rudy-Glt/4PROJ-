import prisma from '../../config/database';
import { SharedFolderService } from '../sharedFolderService';
import { MailService } from '../mailService';
import { SharedLinkService } from '../sharedLinkService';
import { PlanService } from '../planService';
import { VAULT_SHARE_FORBIDDEN_CODE } from '../../constants/shareErrors';

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    sharedFolder: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
    folder: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock('../mailService', () => ({
  MailService: {
    sendShareNotification: jest.fn(),
  },
}));

jest.mock('../auditService', () => ({
  AuditService: {
    createLog: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../sharedLinkService', () => ({
  SharedLinkService: {
    assertShareLimit: jest.fn(),
  },
}));

jest.mock('../planService', () => ({
  PlanService: {
    assertFeature: jest.fn(),
  },
}));

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

describe('SharedFolderService.shareFolder', () => {
  const ownerFolder = {
    id: 'folder-1',
    userId: 'owner-user',
    name: 'Documents',
    isVault: false,
    isDeleted: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.folder.findFirst as jest.Mock).mockResolvedValue(ownerFolder);
    (prisma.sharedFolder.findFirst as jest.Mock).mockResolvedValue(null);
    (SharedLinkService.assertShareLimit as jest.Mock).mockResolvedValue(undefined);
    (PlanService.assertFeature as jest.Mock).mockResolvedValue(undefined);
  });

  it('refuses vault folders with a clear 403 before creating a share or sending email', async () => {
    (prisma.folder.findFirst as jest.Mock).mockResolvedValue({ ...ownerFolder, isVault: true });

    await expect(
      SharedFolderService.shareFolder('owner-user', 'folder-1', 'target-user', { canRead: true })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: VAULT_SHARE_FORBIDDEN_CODE,
    });

    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.sharedFolder.create).not.toHaveBeenCalled();
    expect(MailService.sendShareNotification).not.toHaveBeenCalled();
  });

  it('stores a hash and never exposes passwordHash for protected direct folder shares', async () => {
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce({
        id: 'target-user',
        email: 'target@example.com',
        accountStatus: 'ACTIVE',
        language: 'fr',
      })
      .mockResolvedValueOnce({
        id: 'owner-user',
        email: 'owner@example.com',
        firstName: 'Owner',
        lastName: 'User',
      });
    (prisma.sharedFolder.create as jest.Mock).mockImplementation(({ data }) => Promise.resolve({
      id: 'share-folder-1',
      ...data,
      folder: ownerFolder,
      sharedBy: { id: 'owner-user', email: 'owner@example.com' },
      sharedWith: { id: 'target-user', email: 'target@example.com' },
    }));

    const result = await SharedFolderService.shareFolder(
      'owner-user',
      'folder-1',
      'target-user',
      { canRead: true },
      undefined,
      'secret-password'
    );

    expect(PlanService.assertFeature).toHaveBeenCalledWith('owner-user', 'sharePassword');
    expect(prisma.sharedFolder.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        passwordHash: expect.any(String),
      }),
    }));
    const createArg = (prisma.sharedFolder.create as jest.Mock).mock.calls[0][0];
    expect(createArg.data.passwordHash).not.toBe('secret-password');
    expect((result as any).passwordHash).toBeUndefined();
    expect((result as any).passwordProtected).toBe(true);
    expect(MailService.sendShareNotification).toHaveBeenCalled();
  });
});

describe('SharedFolderService.removeSharedFolder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('allows the recipient to remove a received folder share', async () => {
    (prisma.sharedFolder.findFirst as jest.Mock).mockResolvedValue({
      id: 'share-folder-1',
      sharedById: 'owner-user',
      sharedWithId: 'recipient-user',
    });
    (prisma.sharedFolder.delete as jest.Mock).mockResolvedValue({ id: 'share-folder-1' });

    await expect(
      SharedFolderService.removeSharedFolder('share-folder-1', 'recipient-user')
    ).resolves.toEqual({ message: 'Shared folder removed successfully' });

    expect(prisma.sharedFolder.findFirst).toHaveBeenCalledWith({
      where: { id: 'share-folder-1', folder: { is: { isDeleted: false } } },
    });
    expect(prisma.sharedFolder.delete).toHaveBeenCalledWith({ where: { id: 'share-folder-1' } });
  });

  it('refuses unrelated users when removing a folder share', async () => {
    (prisma.sharedFolder.findFirst as jest.Mock).mockResolvedValue({
      id: 'share-folder-1',
      sharedById: 'owner-user',
      sharedWithId: 'recipient-user',
    });

    await expect(
      SharedFolderService.removeSharedFolder('share-folder-1', 'other-user')
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'SHARE_ACCESS_DENIED',
    });

    expect(prisma.sharedFolder.delete).not.toHaveBeenCalled();
  });
});
