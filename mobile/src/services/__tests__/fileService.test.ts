import { fileService } from '../fileService';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

jest.mock('../api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    put: jest.fn(),
    post: jest.fn(),
    delete: jest.fn(),
    defaults: { baseURL: 'http://localhost:5001/api' },
  },
}));

import api from '../api';

const makeFile = (overrides = {}) => ({
  id: 'file-1',
  name: 'document.pdf',
  mimeType: 'application/pdf',
  size: 1024,
  storagePath: '/data/uploads/file-1.enc',
  folderId: null,
  userId: 'user-1',
  isDeleted: false,
  isVault: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('fileService.listFiles', () => {
  it('fetches all files without folder filter', async () => {
    const files = [makeFile()];
    (api.get as jest.Mock).mockResolvedValue({ data: { files } });

    const result = await fileService.listFiles();

    expect(api.get).toHaveBeenCalledWith('/files', {
      params: { folderId: undefined, sortBy: undefined, sortOrder: undefined },
    });
    expect(result).toMatchObject({ files: [{ id: 'file-1' }] });
  });

  it('passes folderId and sort parameters to the API', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { files: [] } });

    await fileService.listFiles('folder-1', 'name', 'asc');

    expect(api.get).toHaveBeenCalledWith('/files', {
      params: { folderId: 'folder-1', sortBy: 'name', sortOrder: 'asc' },
    });
  });

  it('unwraps success envelope', async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: { success: true, data: { files: [makeFile()] } },
    });

    const result = await fileService.listFiles();

    expect(result).toMatchObject({ files: [{ id: 'file-1' }] });
  });
});

describe('fileService.getFile', () => {
  it('fetches a single file by id', async () => {
    const file = makeFile();
    (api.get as jest.Mock).mockResolvedValue({ data: { file } });

    const result = await fileService.getFile('file-1');

    expect(api.get).toHaveBeenCalledWith('/files/file-1');
    expect(result).toMatchObject({ file: { id: 'file-1' } });
  });
});

describe('fileService.updateFile', () => {
  it('sends rename request to the correct endpoint', async () => {
    const updated = makeFile({ name: 'renamed.pdf' });
    (api.put as jest.Mock).mockResolvedValue({ data: { file: updated } });

    const result = await fileService.updateFile('file-1', 'renamed.pdf');

    expect(api.put).toHaveBeenCalledWith('/files/file-1', { name: 'renamed.pdf' });
    expect(result).toMatchObject({ file: { name: 'renamed.pdf' } });
  });
});

describe('fileService.moveFile', () => {
  it('moves a file to a folder', async () => {
    (api.put as jest.Mock).mockResolvedValue({ data: {} });

    await fileService.moveFile('file-1', 'folder-2');

    expect(api.put).toHaveBeenCalledWith('/files/file-1/move', { folderId: 'folder-2' });
  });

  it('moves a file to the root by passing undefined folderId', async () => {
    (api.put as jest.Mock).mockResolvedValue({ data: {} });

    await fileService.moveFile('file-1', undefined);

    expect(api.put).toHaveBeenCalledWith('/files/file-1/move', { folderId: undefined });
  });
});

describe('fileService.deleteFile', () => {
  it('soft-deletes a file by default', async () => {
    (api.delete as jest.Mock).mockResolvedValue({ data: {} });

    await fileService.deleteFile('file-1');

    expect(api.delete).toHaveBeenCalledWith('/files/file-1', { params: { permanent: false } });
  });

  it('permanently deletes a file when permanent is true', async () => {
    (api.delete as jest.Mock).mockResolvedValue({ data: {} });

    await fileService.deleteFile('file-1', true);

    expect(api.delete).toHaveBeenCalledWith('/files/file-1', { params: { permanent: true } });
  });
});

describe('fileService.restoreFile', () => {
  it('restores a soft-deleted file', async () => {
    const restored = makeFile({ isDeleted: false });
    (api.post as jest.Mock).mockResolvedValue({ data: { file: restored } });

    const result = await fileService.restoreFile('file-1');

    expect(api.post).toHaveBeenCalledWith('/files/file-1/restore');
    expect(result).toMatchObject({ file: { isDeleted: false } });
  });
});

describe('fileService.getDeletedFiles', () => {
  it('fetches files in the trash', async () => {
    const deleted = [makeFile({ isDeleted: true })];
    (api.get as jest.Mock).mockResolvedValue({ data: { files: deleted } });

    const result = await fileService.getDeletedFiles();

    expect(api.get).toHaveBeenCalledWith('/files/deleted');
    expect(result).toMatchObject({ files: [{ isDeleted: true }] });
  });
});

describe('fileService.searchFiles', () => {
  it('passes search query to the API', async () => {
    const files = [makeFile({ name: 'report.pdf' })];
    (api.get as jest.Mock).mockResolvedValue({ data: { files } });

    const result = await fileService.searchFiles('report');

    expect(api.get).toHaveBeenCalledWith('/files/search', { params: { q: 'report' } });
    expect(result).toMatchObject({ files: [{ name: 'report.pdf' }] });
  });

  it('returns empty results for a query with no matches', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { files: [] } });

    const result = await fileService.searchFiles('zzz-no-match');

    expect(result).toMatchObject({ files: [] });
  });
});

describe('fileService.toggleFavorite', () => {
  it('posts to the favorite endpoint and returns the updated file', async () => {
    const favorited = makeFile({ isFavorite: true });
    (api.post as jest.Mock).mockResolvedValue({ data: { file: favorited } });

    const result = await fileService.toggleFavorite('file-1');

    expect(api.post).toHaveBeenCalledWith('/files/file-1/favorite');
    expect(result).toMatchObject({ file: { id: 'file-1' } });
  });
});

describe('fileService.getFavoriteFiles', () => {
  it('fetches the favorites list', async () => {
    const files = [makeFile({ isFavorite: true }), makeFile({ id: 'file-2', isFavorite: true })];
    (api.get as jest.Mock).mockResolvedValue({ data: { files } });

    const result = await fileService.getFavoriteFiles();

    expect(api.get).toHaveBeenCalledWith('/files/favorites');
    expect(result.files).toHaveLength(2);
  });
});
