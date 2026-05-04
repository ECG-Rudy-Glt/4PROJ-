import prisma from '../../config/database';
import { FileQueryService } from '../fileQueryService';
import { VaultService } from '../vaultService';

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    file: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    sharedFolder: {
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../vaultService', () => ({
  VaultService: {
    isVaultUnlocked: jest.fn(),
    isVaultFolder: jest.fn(),
    assertUnlockedIfVault: jest.fn(),
  },
}));

describe('FileQueryService share acceptance checks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (VaultService.isVaultUnlocked as jest.Mock).mockResolvedValue(false);
    (VaultService.isVaultFolder as jest.Mock).mockResolvedValue(false);
    (VaultService.assertUnlockedIfVault as jest.Mock).mockResolvedValue(undefined);
  });

  it('keeps owner file access unchanged', async () => {
    const ownerFile = { id: 'file-1', userId: 'owner-1', isVault: false };
    (prisma.file.findFirst as jest.Mock).mockResolvedValue(ownerFile);

    await expect(FileQueryService.getFile('file-1', 'owner-1')).resolves.toBe(ownerFile);
    expect(prisma.file.findFirst).toHaveBeenCalledWith({
      where: { id: 'file-1', userId: 'owner-1', isDeleted: false },
      include: expect.any(Object),
    });
  });

  it('does not list files from pending folder shares', async () => {
    (prisma.sharedFolder.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.file.findMany as jest.Mock).mockResolvedValue([]);

    await expect(FileQueryService.listFiles('shared-user', 'folder-1')).resolves.toEqual([]);
    expect(prisma.sharedFolder.findFirst).toHaveBeenCalledWith({
      where: {
        folderId: 'folder-1',
        sharedWithId: 'shared-user',
        accepted: true,
        canRead: true,
      },
    });
    expect(prisma.file.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'shared-user',
          folderId: 'folder-1',
        }),
      })
    );
  });

  it('lists files from accepted folder shares with read permission', async () => {
    (prisma.sharedFolder.findFirst as jest.Mock).mockResolvedValue({
      canRead: true,
      canWrite: false,
      canDelete: false,
      canShare: false,
    });
    (prisma.file.findMany as jest.Mock).mockResolvedValue([{ id: 'file-1', name: 'doc.pdf' }]);

    const files = await FileQueryService.listFiles('shared-user', 'folder-1');

    expect(files).toEqual([
      expect.objectContaining({
        id: 'file-1',
        _sharedFolderPermissions: {
          canRead: true,
          canWrite: false,
          canDelete: false,
          canShare: false,
        },
      }),
    ]);
    expect(prisma.file.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          folderId: 'folder-1',
          isDeleted: false,
        }),
        include: expect.objectContaining({
          sharedWith: {
            where: {
              sharedWithId: 'shared-user',
              accepted: true,
            },
          },
        }),
      })
    );
  });
});
