import prisma from '../../config/database';
import { VersionService } from '../versionService';
import { PlanService } from '../planService';

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    file: {
      findFirst: jest.fn(),
    },
    fileVersion: {
      count: jest.fn(),
      findMany: jest.fn(),
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

describe('VersionService share acceptance checks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
