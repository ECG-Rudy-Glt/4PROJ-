import prisma from '../../config/database';
import { FolderService } from '../folderService';
import { SyncService, SYNC_ROOT_NAME } from '../syncService';

jest.mock('../../config/database', () => ({
  __esModule: true,
  default: {
    folder: {
      findFirst: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    file: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  },
}));

jest.mock('../folderService', () => ({
  FolderService: {
    createFolder: jest.fn(),
  },
}));

describe('SyncService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the active SupFile Sync root when it exists', async () => {
    const root = { id: 'root-1', name: SYNC_ROOT_NAME, isDeleted: false };
    (prisma.folder.findFirst as jest.Mock).mockResolvedValueOnce(root);

    await expect(SyncService.getOrCreateRoot('user-1')).resolves.toBe(root);
    expect(FolderService.createFolder).not.toHaveBeenCalled();
  });

  it('restores a deleted SupFile Sync root before creating a new one', async () => {
    const deleted = { id: 'root-deleted', name: SYNC_ROOT_NAME, isDeleted: true };
    const restored = { ...deleted, isDeleted: false, deletedAt: null };
    (prisma.folder.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(deleted);
    (prisma.folder.update as jest.Mock).mockResolvedValue(restored);

    await expect(SyncService.getOrCreateRoot('user-1')).resolves.toBe(restored);
    expect(prisma.folder.update).toHaveBeenCalledWith({
      where: { id: 'root-deleted' },
      data: { isDeleted: false, deletedAt: null },
    });
    expect(FolderService.createFolder).not.toHaveBeenCalled();
  });

  it('creates the root when no active or deleted root exists', async () => {
    const created = { id: 'root-new', name: SYNC_ROOT_NAME };
    (prisma.folder.findFirst as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    (FolderService.createFolder as jest.Mock).mockResolvedValue(created);

    await expect(SyncService.getOrCreateRoot('user-1')).resolves.toBe(created);
    expect(FolderService.createFolder).toHaveBeenCalledWith('user-1', SYNC_ROOT_NAME);
  });

  it('normalizes only sha256 checksums', () => {
    expect(SyncService.normalizeChecksum('ABCDEF'.padEnd(64, '0'))).toBe('abcdef'.padEnd(64, '0'));
    expect(SyncService.normalizeChecksum('not-a-checksum')).toBeUndefined();
  });

  it('asserts only the dedicated root folder', async () => {
    const root = {
      id: 'root-1',
      userId: 'user-1',
      name: SYNC_ROOT_NAME,
      parentId: null,
      path: `/${SYNC_ROOT_NAME}`,
      isDeleted: false,
      isVault: false,
    };
    (prisma.folder.findFirst as jest.Mock).mockResolvedValueOnce(root);

    await expect(SyncService.assertRoot('user-1', 'root-1')).resolves.toBe(root);
    expect(prisma.folder.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'root-1',
        userId: 'user-1',
        parentId: null,
        name: SYNC_ROOT_NAME,
        isDeleted: false,
        isVault: false,
      },
    });
  });

  it('rejects a target folder outside the sync root', async () => {
    (prisma.folder.findFirst as jest.Mock)
      .mockResolvedValueOnce({ id: 'outside-1', parentId: null, path: '/Documents', isDeleted: false, isVault: false })
      .mockResolvedValueOnce({ id: 'root-1', parentId: null, path: `/${SYNC_ROOT_NAME}` })
      .mockResolvedValueOnce({ id: 'outside-1', parentId: null, isDeleted: false, isVault: false });

    await expect(SyncService.assertFolderInsideRoot('user-1', 'root-1', 'outside-1')).rejects.toMatchObject({
      statusCode: 403,
      code: 'SYNC_SCOPE_VIOLATION',
    });
  });

  it('allows a target folder inside the sync root', async () => {
    const folder = { id: 'child-1', parentId: 'root-1', path: `/${SYNC_ROOT_NAME}/Child`, isDeleted: false, isVault: false };
    (prisma.folder.findFirst as jest.Mock)
      .mockResolvedValueOnce(folder)
      .mockResolvedValueOnce({ id: 'root-1', parentId: null, path: `/${SYNC_ROOT_NAME}` })
      .mockResolvedValueOnce({ id: 'child-1', parentId: 'root-1', isDeleted: false, isVault: false });

    await expect(SyncService.assertFolderInsideRoot('user-1', 'root-1', 'child-1')).resolves.toBe(folder);
  });

  it('rejects a path-spoofed folder when parent ancestry is outside the sync root', async () => {
    const folder = {
      id: 'spoofed-1',
      parentId: null,
      path: `/${SYNC_ROOT_NAME}/LooksInside`,
      isDeleted: false,
      isVault: false,
    };
    (prisma.folder.findFirst as jest.Mock)
      .mockResolvedValueOnce(folder)
      .mockResolvedValueOnce({ id: 'root-1', parentId: null, path: `/${SYNC_ROOT_NAME}` })
      .mockResolvedValueOnce({ id: 'spoofed-1', parentId: null, isDeleted: false, isVault: false });

    await expect(SyncService.assertFolderInsideRoot('user-1', 'root-1', 'spoofed-1')).rejects.toMatchObject({
      statusCode: 403,
      code: 'SYNC_SCOPE_VIOLATION',
    });
  });

  it('rejects replacement of a file outside the sync root', async () => {
    (prisma.file.findFirst as jest.Mock).mockResolvedValueOnce({
      id: 'file-1',
      folderId: 'outside-1',
      folder: { id: 'outside-1', parentId: null, path: '/Documents', isDeleted: false, isVault: false },
    });
    (prisma.folder.findFirst as jest.Mock)
      .mockResolvedValueOnce({ id: 'root-1', parentId: null, path: `/${SYNC_ROOT_NAME}` })
      .mockResolvedValueOnce({ id: 'outside-1', parentId: null, isDeleted: false, isVault: false });

    await expect(SyncService.getFileForReplacement('user-1', 'file-1', 'root-1')).rejects.toMatchObject({
      statusCode: 403,
      code: 'SYNC_SCOPE_VIOLATION',
    });
  });

  it('detects replacement conflicts from stale remote timestamps', () => {
    const current = { updatedAt: new Date('2026-05-21T10:00:00.000Z') };

    expect(SyncService.shouldRejectReplacement(current, '2026-05-21T09:59:59.000Z')).toBe(true);
    expect(SyncService.shouldRejectReplacement(current, '2026-05-21T10:00:00.000Z')).toBe(false);
    expect(SyncService.shouldRejectReplacement(current, undefined)).toBe(false);
  });
});
