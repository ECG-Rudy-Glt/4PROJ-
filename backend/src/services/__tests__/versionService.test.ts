import fs from 'fs';
import prisma from '../../config/database';
import logger from '../../config/logger';
import { VersionService } from '../versionService';
import { PlanService } from '../planService';
import { StorageService } from '../storageService';
import { EncryptionService } from '../encryptionService';
import { FileIndexService } from '../fileIndexService';

jest.mock('fs', () => ({
  existsSync: jest.fn(),
  copyFileSync: jest.fn(),
}));

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    file: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    fileVersion: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      update: jest.fn(),
    },
  },
}));

jest.mock('../storageService', () => ({
  StorageService: {
    isS3Key: jest.fn(),
    copy: jest.fn(),
    deleteStorageFile: jest.fn(),
  },
}));

jest.mock('../planService', () => ({
  PlanService: {
    assertLimit: jest.fn(),
    getNumericLimit: jest.fn(),
    checkQuota: jest.fn(),
  },
}));

jest.mock('../encryptionService', () => ({
  EncryptionService: {
    encryptFileToS3: jest.fn(),
  },
}));

jest.mock('../fileIndexService', () => ({
  FileIndexService: {
    indexFileAsync: jest.fn(),
  },
}));

jest.mock('../vaultService', () => ({
  VaultService: {
    assertUnlockedIfVault: jest.fn(),
  },
}));

jest.mock('../../config/logger', () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const currentFile = {
  id: 'file-1',
  userId: 'owner-1',
  name: 'old.docx',
  size: BigInt(50),
  storagePath: 'files/owner-1/current.enc',
  mimeType: 'application/docx',
  isVault: false,
  versions: [{ versionNumber: 2 }],
};

const createdVersion = {
  id: 'version-3',
  fileId: 'file-1',
  versionNumber: 3,
  storagePath: currentFile.storagePath,
  size: currentFile.size,
};

describe('VersionService share acceptance checks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma));
    (prisma.file.update as jest.Mock).mockResolvedValue({});
    (prisma.fileVersion.create as jest.Mock).mockResolvedValue(createdVersion);
    (prisma.fileVersion.delete as jest.Mock).mockResolvedValue({});
    (prisma.user.update as jest.Mock).mockResolvedValue({});
    (prisma.fileVersion.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.fileVersion.count as jest.Mock).mockResolvedValue(0);
    (PlanService.getNumericLimit as jest.Mock).mockResolvedValue(null);
    (PlanService.checkQuota as jest.Mock).mockResolvedValue(true);
    (EncryptionService.encryptFileToS3 as jest.Mock).mockResolvedValue(undefined);
    (StorageService.deleteStorageFile as jest.Mock).mockResolvedValue(undefined);
  });

  it('refuses version creation through pending shares', async () => {
    (prisma.file.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      VersionService.createVersion('file-1', 'shared-user', '/tmp/new.docx', 'new.docx', 10, 'application/docx')
    ).rejects.toThrow('Fichier introuvable');
    expect(prisma.file.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'file-1',
        isDeleted: false,
        OR: [
          { userId: 'shared-user' },
          {
            sharedWith: {
              some: {
                sharedWithId: 'shared-user',
                accepted: true,
                canWrite: true,
              },
            },
          },
          {
            folder: {
              sharedWith: {
                some: {
                  sharedWithId: 'shared-user',
                  accepted: true,
                  canWrite: true,
                },
              },
            },
          },
        ],
      },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });
    expect(PlanService.assertLimit).not.toHaveBeenCalled();
  });

  it('refuses version listing through pending shares', async () => {
    (prisma.file.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(VersionService.getFileVersions('file-1', 'shared-user')).rejects.toThrow('Fichier introuvable');
    expect(prisma.file.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'file-1',
        isDeleted: false,
        OR: [
          { userId: 'shared-user' },
          {
            folder: {
              sharedWith: {
                some: {
                  sharedWithId: 'shared-user',
                  accepted: true,
                  canRead: true,
                },
              },
            },
          },
          {
            sharedWith: {
              some: {
                sharedWithId: 'shared-user',
                accepted: true,
                canRead: true,
              },
            },
          },
        ],
      },
    });
  });
});

describe('VersionService quota and storage ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (prisma.$transaction as jest.Mock).mockImplementation(async (callback) => callback(prisma));
    (prisma.file.findFirst as jest.Mock).mockResolvedValue(currentFile);
    (prisma.file.update as jest.Mock).mockResolvedValue({});
    (prisma.fileVersion.create as jest.Mock).mockResolvedValue(createdVersion);
    (prisma.fileVersion.delete as jest.Mock).mockResolvedValue({});
    (prisma.fileVersion.findUnique as jest.Mock).mockResolvedValue({
      id: 'version-1',
      fileId: 'file-1',
      storagePath: 'versions/file-1/1-old.docx',
      size: BigInt(40),
    });
    (prisma.fileVersion.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.fileVersion.count as jest.Mock).mockResolvedValue(0);
    (prisma.user.update as jest.Mock).mockResolvedValue({});
    (PlanService.getNumericLimit as jest.Mock).mockResolvedValue(null);
    (PlanService.checkQuota as jest.Mock).mockResolvedValue(true);
    (EncryptionService.encryptFileToS3 as jest.Mock).mockResolvedValue(undefined);
    (StorageService.deleteStorageFile as jest.Mock).mockResolvedValue(undefined);
  });

  it('checks quota before uploading a new version object to S3', async () => {
    await VersionService.createVersion('file-1', 'owner-1', '/tmp/new.docx', 'new.docx', 25, 'application/docx');

    expect(PlanService.checkQuota).toHaveBeenCalledWith('owner-1', 25);
    expect(EncryptionService.encryptFileToS3).toHaveBeenCalledWith(
      '/tmp/new.docx',
      'versions/file-1/3-new.docx',
      undefined
    );
    expect((PlanService.checkQuota as jest.Mock).mock.invocationCallOrder[0])
      .toBeLessThan((EncryptionService.encryptFileToS3 as jest.Mock).mock.invocationCallOrder[0]);
  });

  it('refuses quota without uploading or writing database rows', async () => {
    (PlanService.checkQuota as jest.Mock).mockResolvedValue(false);

    await expect(
      VersionService.createVersion('file-1', 'owner-1', '/tmp/new.docx', 'new.docx', 25, 'application/docx')
    ).rejects.toThrow('Quota exceeded');

    expect(EncryptionService.encryptFileToS3).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.fileVersion.create).not.toHaveBeenCalled();
    expect(prisma.file.update).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('increments quotaUsed by the new physical object size in the version transaction', async () => {
    await VersionService.createVersion('file-1', 'owner-1', '/tmp/new.docx', 'new.docx', 25, 'application/docx');

    expect(prisma.fileVersion.create).toHaveBeenCalledWith({
      data: {
        fileId: 'file-1',
        versionNumber: 3,
        name: 'old.docx',
        size: BigInt(50),
        storagePath: 'files/owner-1/current.enc',
        mimeType: 'application/docx',
        createdById: 'owner-1',
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
    expect(prisma.file.update).toHaveBeenCalledWith({
      where: { id: 'file-1' },
      data: {
        name: 'new.docx',
        size: BigInt(25),
        storagePath: 'versions/file-1/3-new.docx',
        mimeType: 'application/docx',
      },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'owner-1' },
      data: {
        quotaUsed: {
          increment: BigInt(25),
        },
      },
    });
    expect(FileIndexService.indexFileAsync).toHaveBeenCalledWith('file-1', 'owner-1');
  });

  it('removes the newly uploaded S3 object if the database transaction fails', async () => {
    const dbError = new Error('DB failed');
    (prisma.$transaction as jest.Mock).mockRejectedValue(dbError);

    await expect(
      VersionService.createVersion('file-1', 'owner-1', '/tmp/new.docx', 'new.docx', 25, 'application/docx')
    ).rejects.toThrow('DB failed');

    expect(EncryptionService.encryptFileToS3).toHaveBeenCalledWith(
      '/tmp/new.docx',
      'versions/file-1/3-new.docx',
      undefined
    );
    expect(StorageService.deleteStorageFile).toHaveBeenCalledWith('versions/file-1/3-new.docx');
  });

  it('cleans old versions before enforcing maxVersions for createVersion', async () => {
    (PlanService.getNumericLimit as jest.Mock).mockResolvedValue(2);
    (prisma.fileVersion.findMany as jest.Mock).mockResolvedValue([
      { id: 'version-3', storagePath: 'versions/file-1/3-old.docx', size: BigInt(30) },
      { id: 'version-2', storagePath: 'versions/file-1/2-old.docx', size: BigInt(20) },
      { id: 'version-1', storagePath: 'versions/file-1/1-old.docx', size: BigInt(10) },
    ]);
    (prisma.fileVersion.count as jest.Mock).mockResolvedValue(1);

    await VersionService.createVersion('file-1', 'owner-1', '/tmp/new.docx', 'new.docx', 25, 'application/docx');

    expect(StorageService.deleteStorageFile).toHaveBeenCalledWith('versions/file-1/2-old.docx');
    expect(StorageService.deleteStorageFile).toHaveBeenCalledWith('versions/file-1/1-old.docx');
    expect(prisma.fileVersion.delete).toHaveBeenCalledWith({ where: { id: 'version-2' } });
    expect(prisma.fileVersion.delete).toHaveBeenCalledWith({ where: { id: 'version-1' } });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'owner-1' },
      data: { quotaUsed: { decrement: BigInt(20) } },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'owner-1' },
      data: { quotaUsed: { decrement: BigInt(10) } },
    });
    expect(EncryptionService.encryptFileToS3).toHaveBeenCalled();
  });

  it('deletes a version object, database row, and decrements quotaUsed', async () => {
    await VersionService.deleteVersion('version-1', 'file-1', 'owner-1');

    expect(StorageService.deleteStorageFile).toHaveBeenCalledWith('versions/file-1/1-old.docx');
    expect(prisma.fileVersion.delete).toHaveBeenCalledWith({ where: { id: 'version-1' } });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'owner-1' },
      data: {
        quotaUsed: {
          decrement: BigInt(40),
        },
      },
    });
  });

  it('refuses to delete a version whose storagePath is the current file storagePath', async () => {
    (PlanService.getNumericLimit as jest.Mock).mockResolvedValue(1);
    (prisma.fileVersion.findMany as jest.Mock).mockResolvedValue([
      { id: 'version-current', storagePath: 'files/owner-1/current.enc', size: BigInt(50) },
    ]);
    (prisma.fileVersion.count as jest.Mock).mockResolvedValue(1);

    await expect(
      VersionService.createVersion('file-1', 'owner-1', '/tmp/new.docx', 'new.docx', 25, 'application/docx')
    ).rejects.toThrow('Impossible de supprimer une version qui référence le fichier courant');

    expect(logger.warn).toHaveBeenCalledWith(
      {
        fileId: 'file-1',
        versionId: 'version-current',
        storagePath: 'files/owner-1/current.enc',
      },
      'Refusing to delete version storage used by current file'
    );
    expect(StorageService.deleteStorageFile).not.toHaveBeenCalled();
    expect(EncryptionService.encryptFileToS3).not.toHaveBeenCalled();
  });
});
