import * as SecureStore from 'expo-secure-store';
import api from './api';
import { FileItem } from '../types';

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

  async getDownloadUrl(fileId: string): Promise<string> {
    const token = await SecureStore.getItemAsync('token');
    return `${api.defaults.baseURL}/files/${fileId}/download?token=${token}`;
  },

  async getStreamUrl(fileId: string): Promise<string> {
    const token = await SecureStore.getItemAsync('token');
    return `${api.defaults.baseURL}/files/${fileId}/stream?token=${token}`;
  },
};
