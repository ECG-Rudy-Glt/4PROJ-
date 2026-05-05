import * as SecureStore from 'expo-secure-store';
import api from './api';
import { FileItem } from '../types';

type DownloadMode = 'download' | 'stream';
type FileReference = Pick<FileItem, 'id' | 'name'>;

const safeFilename = (name: string): string =>
  name.replace(/[^a-zA-Z0-9._-]/g, '_') || 'supfile-file';

async function getFileSystem() {
  return import('expo-file-system/legacy').catch(() => import('expo-file-system'));
}

async function downloadProtectedFile(file: FileReference, mode: DownloadMode): Promise<string> {
  const token = await SecureStore.getItemAsync('token');
  if (!token) {
    throw new Error('Session expirée');
  }

  const FileSystem = await getFileSystem();
  const cacheDirectory = (FileSystem as any).cacheDirectory;
  if (!cacheDirectory) {
    throw new Error('Cache local indisponible');
  }

  const dir = `${cacheDirectory}supfile-preview/`;
  await (FileSystem as any).makeDirectoryAsync(dir, { intermediates: true }).catch(() => undefined);

  const endpoint = mode === 'download' ? 'download' : 'stream';
  const uri = `${api.defaults.baseURL}/files/${file.id}/${endpoint}`;
  const destination = `${dir}${Date.now()}-${file.id}-${safeFilename(file.name)}`;
  const result = await (FileSystem as any).downloadAsync(uri, destination, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`Erreur ${result.status}`);
  }

  return result.uri;
}

export const fileService = {
  async listFiles(
    folderId?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
  ): Promise<{ files: FileItem[] }> {
    const res = await api.get('/files', { params: { folderId, sortBy, sortOrder } });
    return res.data;
  },

  async getFile(fileId: string): Promise<{ file: FileItem }> {
    const res = await api.get(`/files/${fileId}`);
    return res.data;
  },

  async updateFile(fileId: string, name: string) {
    const res = await api.put(`/files/${fileId}`, { name });
    return res.data;
  },

  async moveFile(fileId: string, folderId?: string) {
    const res = await api.put(`/files/${fileId}/move`, { folderId });
    return res.data;
  },

  async deleteFile(fileId: string, permanent = false) {
    const res = await api.delete(`/files/${fileId}`, { params: { permanent } });
    return res.data;
  },

  async restoreFile(fileId: string) {
    const res = await api.post(`/files/${fileId}/restore`);
    return res.data;
  },

  async getDeletedFiles(): Promise<{ files: FileItem[] }> {
    const res = await api.get('/files/deleted');
    return res.data;
  },

  async searchFiles(query: string): Promise<{ files: FileItem[] }> {
    const res = await api.get('/files/search', { params: { q: query } });
    return res.data;
  },

  async toggleFavorite(fileId: string): Promise<{ file: FileItem }> {
    const res = await api.post(`/files/${fileId}/favorite`);
    return res.data;
  },

  async getFavoriteFiles(): Promise<{ files: FileItem[] }> {
    const res = await api.get('/files/favorites');
    return res.data;
  },

  async downloadToCache(file: FileReference): Promise<string> {
    return downloadProtectedFile(file, 'download');
  },

  async streamToCache(file: FileReference): Promise<string> {
    return downloadProtectedFile(file, 'stream');
  },
};
