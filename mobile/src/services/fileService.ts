import * as SecureStore from 'expo-secure-store';
import api from './api';
import { FileItem } from '../types';

function unwrap<T>(data: any): T {
  return (data?.success === true && 'data' in data) ? data.data : data;
}

export const fileService = {
  async listFiles(
    folderId?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
  ): Promise<{ files: FileItem[] }> {
    const res = await api.get('/files', { params: { folderId, sortBy, sortOrder } });
    return unwrap(res.data);
  },

  async getFile(fileId: string): Promise<{ file: FileItem }> {
    const res = await api.get(`/files/${fileId}`);
    return unwrap(res.data);
  },

  async updateFile(fileId: string, name: string) {
    const res = await api.put(`/files/${fileId}`, { name });
    return unwrap(res.data);
  },

  async moveFile(fileId: string, folderId?: string) {
    const res = await api.put(`/files/${fileId}/move`, { folderId });
    return unwrap(res.data);
  },

  async deleteFile(fileId: string, permanent = false) {
    const res = await api.delete(`/files/${fileId}`, { params: { permanent } });
    return unwrap(res.data);
  },

  async restoreFile(fileId: string) {
    const res = await api.post(`/files/${fileId}/restore`);
    return unwrap(res.data);
  },

  async getDeletedFiles(): Promise<{ files: FileItem[] }> {
    const res = await api.get('/files/deleted');
    return unwrap(res.data);
  },

  async searchFiles(query: string): Promise<{ files: FileItem[] }> {
    const res = await api.get('/files/search', { params: { q: query } });
    return unwrap(res.data);
  },

  async toggleFavorite(fileId: string): Promise<{ file: FileItem }> {
    const res = await api.post(`/files/${fileId}/favorite`);
    return unwrap(res.data);
  },

  async getFavoriteFiles(): Promise<{ files: FileItem[] }> {
    const res = await api.get('/files/favorites');
    return unwrap(res.data);
  },

  async getDownloadUrl(fileId: string): Promise<string> {
    const token = await SecureStore.getItemAsync('token');
    return `${api.defaults.baseURL}/files/${fileId}/download?token=${token}`;
  },

  async getStreamUrl(fileId: string): Promise<string> {
    const token = await SecureStore.getItemAsync('token');
    return `${api.defaults.baseURL}/files/${fileId}/stream?token=${token}`;
  },

  async getSharedStreamUrl(fileId: string): Promise<string> {
    const token = await SecureStore.getItemAsync('token');
    return `${api.defaults.baseURL}/share/access/${fileId}/stream?token=${token}`;
  },

  // Synchrone — construit l'URL sans attendre (token déjà en mémoire dans api.defaults)
  buildStreamUrl(fileId: string): string {
    const token = (api.defaults.headers.common['Authorization'] as string | undefined)
      ?.replace('Bearer ', '') ?? '';
    return `${api.defaults.baseURL}/files/${fileId}/stream?token=${token}`;
  },
};
