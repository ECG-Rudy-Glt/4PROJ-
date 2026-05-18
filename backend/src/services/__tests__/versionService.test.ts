import fs from 'fs';
import { Readable } from 'stream';
import prisma from '../../config/database';
import logger from '../../config/logger';
import { VersionService } from '../versionService';
import { PlanService } from '../planService';
import { StorageService } from '../storageService';
import { EncryptionService } from '../encryptionService';
import { FileIndexService } from '../fileIndexService';
import { ShareKeyService } from '../shareKeyService';

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
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    sharedFile: {
      findFirst: jest.fn(),
    },
    folder: {
      findUnique: jest.fn(),
    },
    sharedFolder: {
      findFirst: jest.fn(),
    },
    fileVersion: {
      count: jest.fn(),
      findFirst: jest.fn(),
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
    getDecryptStreamAuto: jest.fn(),
  },
}));

jest.mock('../fileIndexService', () => ({
  FileIndexService: {
    indexFileAsync: jest.fn(),
  },
}));

jest.mock('../shareKeyService', () => ({
  ShareKeyService: {
    unwrapOwnerDek: jest.fn(),
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

const versionToRestore = {
  id: 'version-restore',
  fileId: 'file-1',
  name: 'restored.docx',
  size: BigInt(40),
  storagePath: 'versions/file-1/1-old.docx',
  mimeType: 'application/docx',
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
    (EncryptionService.getDecryptStreamAuto as jest.Mock).mockResolvedValue(Readable.from(['ok']));
    (StorageService.deleteStorageFile as jest.Mock).mockResolvedValue(undefined);
    (prisma.sharedFile.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.folder.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.sharedFolder.findFirst as jest.Mock).mockResolvedValue(null);
    (ShareKeyService.unwrapOwnerDek as jest.Mock).mockReturnValue(Buffer.from('owner-dek'));
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
    (prisma.file.findUnique as jest.Mock).mockResolvedValue({ id: 'file-1', versions: [] });
    (prisma.file.update as jest.Mock).mockResolvedValue({});
    (prisma.fileVersion.create as jest.Mock).mockResolvedValue(createdVersion);
    (prisma.fileVersion.delete as jest.Mock).mockResolvedValue({});
    (prisma.fileVersion.findFirst as jest.Mock).mockResolvedValue({ versionNumber: 3 });
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
    (EncryptionService.getDecryptStreamAuto as jest.Mock).mockResolvedValue(Readable.from(['ok']));
    (StorageService.isS3Key as jest.Mock).mockImplementation((storagePath: string) => storagePath.startsWith('files/') || storagePath.startsWith('versions/'));
    (StorageService.copy as jest.Mock).mockResolvedValue(undefined);
    (StorageService.deleteStorageFile as jest.Mock).mockResolvedValue(undefined);
    (prisma.sharedFile.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.folder.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.sharedFolder.findFirst as jest.Mock).mockResolvedValue(null);
    (ShareKeyService.unwrapOwnerDek as jest.Mock).mockReturnValue(Buffer.from('owner-dek'));
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

  it('encrypts shared replacements with the owner DEK from the accepted share', async () => {
    const actorDek = Buffer.from('shared-user-dek');
    const ownerDek = Buffer.from('owner-dek');
    (prisma.sharedFile.findFirst as jest.Mock).mockResolvedValue({
      ownerWrappedDek: 'owner-wrapped-dek',
    });
    (ShareKeyService.unwrapOwnerDek as jest.Mock).mockReturnValue(ownerDek);

    await VersionService.createVersion(
      'file-1',
      'shared-user',
      '/tmp/new.docx',
      'new.docx',
      25,
      'application/docx',
      actorDek
    );

    expect(ShareKeyService.unwrapOwnerDek).toHaveBeenCalledWith('owner-wrapped-dek');
    expect(EncryptionService.encryptFileToS3).toHaveBeenCalledWith(
      '/tmp/new.docx',
      'versions/file-1/3-new.docx',
      ownerDek
    );
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

  it('checks restore quota before copying the target version', async () => {
    (prisma.fileVersion.findUnique as jest.Mock).mockResolvedValue(versionToRestore);

    await VersionService.restoreVersion('version-restore', 'file-1', 'owner-1');

    expect(PlanService.checkQuota).toHaveBeenCalledWith('owner-1', BigInt(40));
    expect(EncryptionService.getDecryptStreamAuto).toHaveBeenCalledWith('versions/file-1/1-old.docx', undefined);
    expect(StorageService.copy).toHaveBeenCalledWith(
      'versions/file-1/1-old.docx',
      expect.stringMatching(/^versions\/file-1\/restored-\d+-1-old\.docx$/)
    );
    expect((PlanService.checkQuota as jest.Mock).mock.invocationCallOrder[0])
      .toBeLessThan((StorageService.copy as jest.Mock).mock.invocationCallOrder[0]);
  });

  it('refuses restore quota without copying or writing database rows', async () => {
    (prisma.fileVersion.findUnique as jest.Mock).mockResolvedValue(versionToRestore);
    (PlanService.checkQuota as jest.Mock).mockResolvedValue(false);

    await expect(VersionService.restoreVersion('version-restore', 'file-1', 'owner-1'))
      .rejects.toThrow('Quota exceeded');

    expect(StorageService.copy).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.fileVersion.create).not.toHaveBeenCalled();
    expect(prisma.file.update).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses restore for encrypted owners when no DEK is unlocked', async () => {
    (prisma.file.findFirst as jest.Mock).mockResolvedValue({
      ...currentFile,
      user: { encryptedDek: 'encrypted-dek' },
    });
    (prisma.fileVersion.findUnique as jest.Mock).mockResolvedValue(versionToRestore);

    await expect(VersionService.restoreVersion('version-restore', 'file-1', 'owner-1'))
      .rejects.toThrow('DEK_UNLOCK_REQUIRED');

    expect(EncryptionService.getDecryptStreamAuto).not.toHaveBeenCalled();
    expect(StorageService.copy).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses restore when the target version cannot be decrypted', async () => {
    (prisma.fileVersion.findUnique as jest.Mock).mockResolvedValue(versionToRestore);
    (EncryptionService.getDecryptStreamAuto as jest.Mock).mockResolvedValue(new Readable({
      read() {
        this.destroy(new Error('bad auth tag'));
      },
    }));

    await expect(VersionService.restoreVersion('version-restore', 'file-1', 'owner-1'))
      .rejects.toThrow('Version illisible ou corrompue');

    expect(logger.warn).toHaveBeenCalledWith(
      {
        err: expect.any(Error),
        storagePath: 'versions/file-1/1-old.docx',
      },
      'Refusing to restore unreadable file version'
    );
    expect(StorageService.copy).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('restores S3 versions with a logical backup of the current file and quota increment', async () => {
    (prisma.fileVersion.findUnique as jest.Mock).mockResolvedValue(versionToRestore);

    await VersionService.restoreVersion('version-restore', 'file-1', 'owner-1');

    const restoredPath = (StorageService.copy as jest.Mock).mock.calls[0][1];
    expect(StorageService.copy).toHaveBeenCalledWith('versions/file-1/1-old.docx', restoredPath);
    expect(StorageService.copy).not.toHaveBeenCalledWith('files/owner-1/current.enc', expect.any(String));
    expect(prisma.fileVersion.create).toHaveBeenCalledWith({
      data: {
        fileId: 'file-1',
        versionNumber: 4,
        name: 'old.docx',
        size: BigInt(50),
        storagePath: 'files/owner-1/current.enc',
        mimeType: 'application/docx',
        createdById: 'owner-1',
      },
    });
    expect(prisma.file.update).toHaveBeenCalledWith({
      where: { id: 'file-1' },
      data: {
        name: 'restored.docx',
        size: BigInt(40),
        storagePath: restoredPath,
        mimeType: 'application/docx',
      },
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'owner-1' },
      data: {
        quotaUsed: {
          increment: BigInt(40),
        },
      },
    });
    expect(prisma.fileVersion.delete).not.toHaveBeenCalled();
    expect(FileIndexService.indexFileAsync).toHaveBeenCalledWith('file-1', 'owner-1');
  });

  it('removes restoredPath if the restore database transaction fails after copy', async () => {
    const dbError = new Error('DB failed');
    (prisma.fileVersion.findUnique as jest.Mock).mockResolvedValue(versionToRestore);
    (prisma.$transaction as jest.Mock).mockRejectedValue(dbError);

    await expect(VersionService.restoreVersion('version-restore', 'file-1', 'owner-1'))
      .rejects.toThrow('DB failed');

    const restoredPath = (StorageService.copy as jest.Mock).mock.calls[0][1];
    expect(StorageService.deleteStorageFile).toHaveBeenCalledWith(restoredPath);
  });

  it('protects the restored target version during preventive cleanup', async () => {
    (PlanService.getNumericLimit as jest.Mock).mockResolvedValue(2);
    (prisma.fileVersion.findUnique as jest.Mock).mockResolvedValue(versionToRestore);
    (prisma.fileVersion.findMany as jest.Mock).mockResolvedValue([
      { id: 'version-newer', storagePath: 'versions/file-1/3-newer.docx', size: BigInt(30) },
      versionToRestore,
      { id: 'version-older', storagePath: 'versions/file-1/0-older.docx', size: BigInt(20) },
    ]);
    (prisma.fileVersion.count as jest.Mock).mockResolvedValue(1);

    await VersionService.restoreVersion('version-restore', 'file-1', 'owner-1');

    expect(StorageService.deleteStorageFile).toHaveBeenCalledWith('versions/file-1/3-newer.docx');
    expect(StorageService.deleteStorageFile).toHaveBeenCalledWith('versions/file-1/0-older.docx');
    expect(StorageService.deleteStorageFile).not.toHaveBeenCalledWith('versions/file-1/1-old.docx');
    expect(prisma.fileVersion.delete).toHaveBeenCalledWith({ where: { id: 'version-newer' } });
    expect(prisma.fileVersion.delete).toHaveBeenCalledWith({ where: { id: 'version-older' } });
    expect(StorageService.copy).toHaveBeenCalledWith(
      'versions/file-1/1-old.docx',
      expect.stringMatching(/^versions\/file-1\/restored-\d+-1-old\.docx$/)
    );
  });

  it('refuses restore before copy when maxVersions cannot keep target and backup', async () => {
    (PlanService.getNumericLimit as jest.Mock).mockResolvedValue(1);
    (prisma.fileVersion.findUnique as jest.Mock).mockResolvedValue(versionToRestore);

    await expect(VersionService.restoreVersion('version-restore', 'file-1', 'owner-1'))
      .rejects.toThrow('La limite de versions ne permet pas de conserver la version restaurée et la sauvegarde courante');

    expect(StorageService.copy).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses restore when the target version already references the current file storagePath', async () => {
    (prisma.fileVersion.findUnique as jest.Mock).mockResolvedValue({
      ...versionToRestore,
      storagePath: 'files/owner-1/current.enc',
    });

    await expect(VersionService.restoreVersion('version-restore', 'file-1', 'owner-1'))
      .rejects.toThrow('Impossible de restaurer une version qui référence le fichier courant');

    expect(PlanService.checkQuota).not.toHaveBeenCalled();
    expect(StorageService.copy).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
