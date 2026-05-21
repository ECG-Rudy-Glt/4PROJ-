import fs from 'fs/promises';
import archiver from 'archiver';
import prisma from '../../config/database';
import logger from '../../config/logger';
import { FolderService } from '../folderService';
import { StorageService } from '../storageService';
import { PlanService } from '../planService';
import { EncryptionService } from '../encryptionService';
import { ShareKeyService } from '../shareKeyService';

jest.mock('fs/promises', () => ({
  unlink: jest.fn(),
}));

jest.mock('archiver', () => jest.fn());

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    folder: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    file: {
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    sharedFolder: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../storageService', () => ({
  StorageService: {
    deleteStorageFile: jest.fn(),
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

jest.mock('../vaultService', () => ({
  VaultService: {
    assertUnlockedIfVault: jest.fn(),
  },
}));

jest.mock('../planService', () => ({
  PlanService: {
    updateQuotaUsed: jest.fn(),
  },
}));

jest.mock('../encryptionService', () => ({
  EncryptionService: {
    getDecryptStreamAuto: jest.fn(),
  },
}));

jest.mock('../shareKeyService', () => ({
  ShareKeyService: {
    unwrapOwnerDek: jest.fn(),
  },
}));

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

const folder = {
  id: 'folder-1',
  userId: 'owner-1',
  name: 'Documents',
  path: '/Documents',
  isDeleted: false,
  isVault: false,
};

describe('FolderService.createFolder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('ignores deleted folders when checking duplicate names', async () => {
    const created = {
      id: 'folder-new',
      userId: 'user-1',
      name: 'Documents',
      parentId: null,
      path: '/Documents',
      isDeleted: false,
      isVault: false,
    };
    (prisma.folder.findFirst as jest.Mock).mockResolvedValueOnce(null);
    (prisma.folder.create as jest.Mock).mockResolvedValueOnce(created);

    await expect(FolderService.createFolder('user-1', 'Documents')).resolves.toBe(created);
    expect(prisma.folder.findFirst).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        name: 'Documents',
        parentId: null,
        isDeleted: false,
      },
    });
  });
});

describe('FolderService.deleteFolder permanent storage cleanup', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.folder.findFirst as jest.Mock).mockResolvedValue(folder);
    (prisma.folder.delete as jest.Mock).mockResolvedValue(folder);
    (prisma.file.delete as jest.Mock).mockResolvedValue({});
    (PlanService.updateQuotaUsed as jest.Mock).mockResolvedValue(undefined);
    (StorageService.deleteStorageFile as jest.Mock).mockResolvedValue(undefined);
  });

  it('deletes S3 files and thumbnails through StorageService during permanent folder deletion', async () => {
    (prisma.file.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'file-1',
        storagePath: 'files/owner-1/file.enc',
        thumbnailPath: 'thumbnails/owner-1/file.webp',
        size: BigInt(42),
        userId: 'owner-1',
        versions: [],
      },
    ]);

    await FolderService.deleteFolder('folder-1', 'owner-1', true);

    expect(StorageService.deleteStorageFile).toHaveBeenCalledWith('files/owner-1/file.enc');
    expect(StorageService.deleteStorageFile).toHaveBeenCalledWith('thumbnails/owner-1/file.webp');
    expect(fs.unlink).not.toHaveBeenCalled();
    expect(prisma.file.delete).toHaveBeenCalledWith({ where: { id: 'file-1' } });
    expect(PlanService.updateQuotaUsed).toHaveBeenCalledWith('owner-1', -BigInt(42));
    expect(prisma.folder.delete).toHaveBeenCalledWith({ where: { id: 'folder-1' } });
  });

  it('routes legacy local paths through StorageService fallback too', async () => {
    (prisma.file.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'file-local',
        storagePath: '/data/uploads/file.enc',
        thumbnailPath: null,
        size: BigInt(10),
        userId: 'owner-1',
        versions: [],
      },
    ]);

    await FolderService.deleteFolder('folder-1', 'owner-1', true);

    expect(StorageService.deleteStorageFile).toHaveBeenCalledWith('/data/uploads/file.enc');
    expect(fs.unlink).not.toHaveBeenCalled();
    expect(prisma.file.delete).toHaveBeenCalledWith({ where: { id: 'file-local' } });
    expect(PlanService.updateQuotaUsed).toHaveBeenCalledWith('owner-1', -BigInt(10));
  });

  it('logs storage deletion failures and keeps purging database records and quota', async () => {
    const deletionError = new Error('S3 unavailable');
    (StorageService.deleteStorageFile as jest.Mock).mockRejectedValueOnce(deletionError);
    (prisma.file.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'file-1',
        storagePath: 'files/owner-1/file.enc',
        thumbnailPath: null,
        size: BigInt(24),
        userId: 'owner-1',
        versions: [],
      },
    ]);

    await FolderService.deleteFolder('folder-1', 'owner-1', true);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error deleting storage object files/owner-1/file.enc for file file-1:')
    );
    expect(prisma.file.delete).toHaveBeenCalledWith({ where: { id: 'file-1' } });
    expect(PlanService.updateQuotaUsed).toHaveBeenCalledWith('owner-1', -BigInt(24));
    expect(prisma.folder.delete).toHaveBeenCalledWith({ where: { id: 'folder-1' } });
  });

  it('deletes version storage and decrements quota for each version during permanent folder deletion', async () => {
    (prisma.file.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'file-versioned',
        storagePath: 'files/owner-1/current.enc',
        thumbnailPath: null,
        size: BigInt(100),
        userId: 'owner-1',
        versions: [
          {
            id: 'version-1',
            storagePath: 'files/owner-1/version-1.enc',
            size: BigInt(40),
          },
          {
            id: 'version-2',
            storagePath: 'files/owner-1/version-2.enc',
            size: BigInt(60),
          },
        ],
      },
    ]);

    await FolderService.deleteFolder('folder-1', 'owner-1', true);

    expect(StorageService.deleteStorageFile).toHaveBeenCalledWith('files/owner-1/current.enc');
    expect(StorageService.deleteStorageFile).toHaveBeenCalledWith('files/owner-1/version-1.enc');
    expect(StorageService.deleteStorageFile).toHaveBeenCalledWith('files/owner-1/version-2.enc');
    expect(PlanService.updateQuotaUsed).toHaveBeenCalledWith('owner-1', -BigInt(100));
    expect(PlanService.updateQuotaUsed).toHaveBeenCalledWith('owner-1', -BigInt(40));
    expect(PlanService.updateQuotaUsed).toHaveBeenCalledWith('owner-1', -BigInt(60));
    expect(prisma.file.delete).toHaveBeenCalledWith({ where: { id: 'file-versioned' } });
  });

  it('logs version storage deletion failures and keeps purging database records and quota', async () => {
    const deletionError = new Error('S3 version unavailable');
    (StorageService.deleteStorageFile as jest.Mock)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(deletionError);
    (prisma.file.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'file-versioned',
        storagePath: 'files/owner-1/current.enc',
        thumbnailPath: null,
        size: BigInt(100),
        userId: 'owner-1',
        versions: [
          {
            id: 'version-1',
            storagePath: 'files/owner-1/version-1.enc',
            size: BigInt(40),
          },
        ],
      },
    ]);

    await FolderService.deleteFolder('folder-1', 'owner-1', true);

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Error deleting storage object files/owner-1/version-1.enc for file file-versioned:')
    );
    expect(PlanService.updateQuotaUsed).toHaveBeenCalledWith('owner-1', -BigInt(100));
    expect(PlanService.updateQuotaUsed).toHaveBeenCalledWith('owner-1', -BigInt(40));
    expect(prisma.file.delete).toHaveBeenCalledWith({ where: { id: 'file-versioned' } });
    expect(prisma.folder.delete).toHaveBeenCalledWith({ where: { id: 'folder-1' } });
  });

  it('does not delete the same physical storage path twice when current file and version paths overlap', async () => {
    (prisma.file.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'file-duplicate-path',
        storagePath: 'files/owner-1/shared.enc',
        thumbnailPath: 'files/owner-1/shared.enc',
        size: BigInt(100),
        userId: 'owner-1',
        versions: [
          {
            id: 'version-duplicate-path',
            storagePath: 'files/owner-1/shared.enc',
            size: BigInt(40),
          },
        ],
      },
    ]);

    await FolderService.deleteFolder('folder-1', 'owner-1', true);

    expect(StorageService.deleteStorageFile).toHaveBeenCalledTimes(1);
    expect(StorageService.deleteStorageFile).toHaveBeenCalledWith('files/owner-1/shared.enc');
    expect(PlanService.updateQuotaUsed).toHaveBeenCalledWith('owner-1', -BigInt(100));
    expect(PlanService.updateQuotaUsed).toHaveBeenCalledWith('owner-1', -BigInt(40));
    expect(prisma.file.delete).toHaveBeenCalledWith({ where: { id: 'file-duplicate-path' } });
  });
});

describe('FolderService.streamFolderAsZip shared access', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (archiver as unknown as jest.Mock).mockReturnValue({
      on: jest.fn(),
      pipe: jest.fn(),
      append: jest.fn(),
      finalize: jest.fn().mockResolvedValue(undefined),
    });
    (prisma.folder.findFirst as jest.Mock).mockResolvedValue({
      id: 'folder-1',
      userId: 'owner-1',
      name: 'Documents',
      isDeleted: false,
      isVault: false,
    });
    (prisma.folder.findUnique as jest.Mock).mockResolvedValue({
      id: 'folder-1',
      parentId: null,
      isDeleted: false,
      isVault: false,
    });
    (prisma.sharedFolder.findFirst as jest.Mock).mockResolvedValue({
      id: 'share-1',
      folderId: 'folder-1',
      sharedWithId: 'shared-user',
      accepted: true,
      canRead: true,
      canWrite: false,
      canDelete: false,
      canShare: false,
      ownerWrappedDek: 'wrapped-owner-dek',
    });
    (prisma.file.findMany as jest.Mock).mockResolvedValue([
      { name: 'doc.txt', storagePath: 'files/owner-1/doc.enc' },
    ]);
    (prisma.folder.findMany as jest.Mock).mockResolvedValue([]);
    (ShareKeyService.unwrapOwnerDek as jest.Mock).mockReturnValue(Buffer.from('owner-dek'));
    (EncryptionService.getDecryptStreamAuto as jest.Mock).mockResolvedValue({ on: jest.fn(), pipe: jest.fn() });
  });

  it('zips accepted shared folders using the owner storage scope and wrapped owner DEK', async () => {
    const res: any = { headersSent: false, status: jest.fn().mockReturnThis(), json: jest.fn(), destroy: jest.fn() };

    await FolderService.streamFolderAsZip('folder-1', 'shared-user', res);

    expect(prisma.sharedFolder.findFirst).toHaveBeenCalledWith({
      where: {
        folderId: 'folder-1',
        sharedWithId: 'shared-user',
        accepted: true,
        canRead: true,
      },
    });
    expect(prisma.file.findMany).toHaveBeenCalledWith({
      where: { folderId: 'folder-1', userId: 'owner-1', isDeleted: false },
      select: { name: true, storagePath: true },
    });
    expect(ShareKeyService.unwrapOwnerDek).toHaveBeenCalledWith('wrapped-owner-dek');
    expect(EncryptionService.getDecryptStreamAuto).toHaveBeenCalledWith(
      'files/owner-1/doc.enc',
      Buffer.from('owner-dek')
    );
  });
});
