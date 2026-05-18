import prisma from '../../config/database';
import { checkFilePermission, checkSharedFolderPermission } from '../permissions';

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    file: {
      findUnique: jest.fn(),
    },
    folder: {
      findUnique: jest.fn(),
    },
    sharedFile: {
      findFirst: jest.fn(),
    },
    sharedFolder: {
      findFirst: jest.fn(),
    },
  },
}));

describe('permissions accepted shares', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('keeps owner access unchanged', async () => {
    (prisma.file.findUnique as jest.Mock).mockResolvedValue({
      id: 'file-1',
      userId: 'owner-1',
      folderId: null,
    });

    await expect(checkFilePermission('owner-1', 'file-1', 'read')).resolves.toBe(true);
    expect(prisma.sharedFile.findFirst).not.toHaveBeenCalled();
    expect(prisma.sharedFolder.findFirst).not.toHaveBeenCalled();
  });

  it('refuses pending direct file shares', async () => {
    (prisma.file.findUnique as jest.Mock).mockResolvedValue({
      id: 'file-1',
      userId: 'owner-1',
      folderId: null,
    });
    (prisma.sharedFile.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(checkFilePermission('shared-user', 'file-1', 'read')).resolves.toBe(false);
    expect(prisma.sharedFile.findFirst).toHaveBeenCalledWith({
      where: {
        fileId: 'file-1',
        sharedWithId: 'shared-user',
        accepted: true,
        canRead: true,
        file: { is: { isDeleted: false } },
      },
    });
  });

  it('allows accepted direct file shares with read permission', async () => {
    (prisma.file.findUnique as jest.Mock).mockResolvedValue({
      id: 'file-1',
      userId: 'owner-1',
      folderId: null,
    });
    (prisma.sharedFile.findFirst as jest.Mock).mockResolvedValue({
      id: 'share-1',
      canRead: true,
      accepted: true,
    });

    await expect(checkFilePermission('shared-user', 'file-1', 'read')).resolves.toBe(true);
  });

  it('allows accepted folder shares with read permission', async () => {
    (prisma.file.findUnique as jest.Mock).mockResolvedValue({
      id: 'file-1',
      userId: 'owner-1',
      folderId: 'folder-1',
    });
    (prisma.sharedFile.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.folder.findUnique as jest.Mock).mockResolvedValue({ id: 'folder-1', parentId: null });
    (prisma.sharedFolder.findFirst as jest.Mock).mockResolvedValue({
      id: 'folder-share-1',
      canRead: true,
      accepted: true,
    });

    await expect(checkFilePermission('shared-user', 'file-1', 'read')).resolves.toBe(true);
    expect(prisma.sharedFolder.findFirst).toHaveBeenCalledWith({
      where: {
        folderId: 'folder-1',
        sharedWithId: 'shared-user',
        accepted: true,
        canRead: true,
      },
    });
  });

  it('refuses folder permissions before acceptance', async () => {
    (prisma.folder.findUnique as jest.Mock).mockResolvedValue({ id: 'folder-1', parentId: null });
    (prisma.sharedFolder.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(checkSharedFolderPermission('shared-user', 'folder-1', 'read')).resolves.toBe(false);
    expect(prisma.sharedFolder.findFirst).toHaveBeenCalledWith({
      where: {
        folderId: 'folder-1',
        sharedWithId: 'shared-user',
        accepted: true,
        canRead: true,
      },
    });
  });
});
