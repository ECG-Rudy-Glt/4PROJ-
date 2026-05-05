import fs from 'fs/promises';
import prisma from '../../config/database';
import logger from '../../config/logger';
import { FolderService } from '../folderService';
import { StorageService } from '../storageService';
import { PlanService } from '../planService';

jest.mock('fs/promises', () => ({
  unlink: jest.fn(),
}));

jest.mock('archiver', () => jest.fn());

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    folder: {
      findFirst: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
    },
    file: {
      findMany: jest.fn(),
      delete: jest.fn(),
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
  EncryptionService: {},
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
