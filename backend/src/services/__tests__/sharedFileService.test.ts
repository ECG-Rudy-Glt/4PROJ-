import prisma from '../../config/database';
import { SharedFileService } from '../sharedFileService';
import { MailService } from '../mailService';
import { SharedLinkService } from '../sharedLinkService';
import { PlanService } from '../planService';

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    sharedFile: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findUnique: jest.fn(),
    },
    file: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    folder: {
      findUnique: jest.fn(),
    },
    sharedFolder: {
      findFirst: jest.fn(),
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

jest.mock('../socketService', () => ({
  SocketService: {
    emitToUser: jest.fn(),
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

const sharedFile = {
  id: 'share-file-1',
  canRead: true,
  canWrite: false,
  canDelete: false,
  canShare: false,
  file: {
    id: 'file-1',
    folderId: null,
    isVault: false,
  },
};

describe('SharedFileService.getSharedFileAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('refuses pending direct file shares', async () => {
    (prisma.sharedFile.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.file.findUnique as jest.Mock).mockResolvedValue({
      id: 'file-1',
      folderId: null,
      isVault: false,
    });

    await expect(SharedFileService.getSharedFileAccess('file-1', 'shared-user')).rejects.toThrow(
      'File not shared with you or you do not have read access'
    );
    expect(prisma.sharedFile.findFirst).toHaveBeenCalledWith({
      where: {
        fileId: 'file-1',
        sharedWithId: 'shared-user',
        accepted: true,
        canRead: true,
      },
      include: { file: true },
    });
  });

  it('allows accepted direct file shares with read permission', async () => {
    (prisma.sharedFile.findFirst as jest.Mock).mockResolvedValue(sharedFile);

    await expect(SharedFileService.getSharedFileAccess('file-1', 'shared-user')).resolves.toBe(sharedFile);
    expect(prisma.file.findUnique).not.toHaveBeenCalled();
  });

  it('refuses pending folder shares for file access', async () => {
    (prisma.sharedFile.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.file.findUnique as jest.Mock).mockResolvedValue({
      id: 'file-1',
      folderId: 'folder-1',
      isVault: false,
    });
    (prisma.folder.findUnique as jest.Mock).mockResolvedValue({ id: 'folder-1', parentId: null });
    (prisma.sharedFolder.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(SharedFileService.getSharedFileAccess('file-1', 'shared-user')).rejects.toThrow(
      'File not shared with you or you do not have read access'
    );
    expect(prisma.sharedFolder.findFirst).toHaveBeenCalledWith({
      where: {
        folderId: 'folder-1',
        sharedWithId: 'shared-user',
        accepted: true,
        canRead: true,
      },
    });
  });

  it('allows accepted folder shares for file access when permission is sufficient', async () => {
    (prisma.sharedFile.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.file.findUnique as jest.Mock).mockResolvedValue({
      id: 'file-1',
      folderId: 'folder-1',
      isVault: false,
    });
    (prisma.folder.findUnique as jest.Mock).mockResolvedValue({ id: 'folder-1', parentId: null });
    (prisma.sharedFolder.findFirst as jest.Mock).mockResolvedValue({
      canRead: true,
      canWrite: false,
      canDelete: false,
      canShare: false,
    });

    await expect(SharedFileService.getSharedFileAccess('file-1', 'shared-user')).resolves.toMatchObject({
      file: { id: 'file-1' },
      canRead: true,
    });
  });

  it('refuses users that are not concerned by the share', async () => {
    (prisma.sharedFile.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.file.findUnique as jest.Mock).mockResolvedValue({
      id: 'file-1',
      folderId: 'folder-1',
      isVault: false,
    });
    (prisma.folder.findUnique as jest.Mock).mockResolvedValue({ id: 'folder-1', parentId: null });
    (prisma.sharedFolder.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(SharedFileService.getSharedFileAccess('file-1', 'other-user')).rejects.toThrow(
      'File not shared with you or you do not have read access'
    );
  });
});

describe('SharedFileService.shareFile', () => {
  const ownerFile = {
    id: 'file-1',
    userId: 'owner-user',
    name: 'contract.pdf',
    isVault: false,
    isDeleted: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.file.findFirst as jest.Mock).mockResolvedValue(ownerFile);
    (prisma.sharedFile.findFirst as jest.Mock).mockResolvedValue(null);
    (SharedLinkService.assertShareLimit as jest.Mock).mockResolvedValue(undefined);
    (PlanService.assertFeature as jest.Mock).mockResolvedValue(undefined);
  });

  it('refuses self-share before creating a share or sending email', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'owner-user',
      email: 'owner@example.com',
      accountStatus: 'ACTIVE',
      language: 'fr',
    });

    await expect(
      SharedFileService.shareFile('owner-user', 'file-1', 'owner-user', { canRead: true })
    ).rejects.toThrow('Impossible de partager un fichier avec vous-même');

    expect(prisma.sharedFile.create).not.toHaveBeenCalled();
    expect(MailService.sendShareNotification).not.toHaveBeenCalled();
  });

  it('refuses suspended target users before creating a share or sending email', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'target-user',
      email: 'target@example.com',
      accountStatus: 'SUSPENDED',
      language: 'fr',
    });

    await expect(
      SharedFileService.shareFile('owner-user', 'file-1', 'target-user', { canRead: true })
    ).rejects.toThrow('Le compte destinataire est inactif ou suspendu');

    expect(prisma.sharedFile.create).not.toHaveBeenCalled();
    expect(MailService.sendShareNotification).not.toHaveBeenCalled();
  });

  it('does not send a duplicate email when an existing share blocks creation', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      id: 'target-user',
      email: 'target@example.com',
      accountStatus: 'ACTIVE',
      language: 'fr',
    });
    (prisma.sharedFile.findFirst as jest.Mock).mockResolvedValue({ id: 'existing-share' });

    await expect(
      SharedFileService.shareFile('owner-user', 'file-1', 'target-user', { canRead: true })
    ).rejects.toThrow('File already shared with this user');

    expect(prisma.sharedFile.create).not.toHaveBeenCalled();
    expect(MailService.sendShareNotification).not.toHaveBeenCalled();
  });

  it('stores a hash and never exposes passwordHash for protected direct file shares', async () => {
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
    (prisma.sharedFile.create as jest.Mock).mockImplementation(({ data }) => Promise.resolve({
      id: 'share-file-1',
      ...data,
      file: ownerFile,
      sharedBy: { id: 'owner-user', email: 'owner@example.com' },
      sharedWith: { id: 'target-user', email: 'target@example.com' },
    }));

    const result = await SharedFileService.shareFile(
      'owner-user',
      'file-1',
      'target-user',
      { canRead: true },
      undefined,
      'secret-password'
    );

    expect(PlanService.assertFeature).toHaveBeenCalledWith('owner-user', 'sharePassword');
    expect(prisma.sharedFile.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        passwordHash: expect.any(String),
      }),
    }));
    const createArg = (prisma.sharedFile.create as jest.Mock).mock.calls[0][0];
    expect(createArg.data.passwordHash).not.toBe('secret-password');
    expect((result as any).passwordHash).toBeUndefined();
    expect((result as any).passwordProtected).toBe(true);
  });
});
