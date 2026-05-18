import api from './api';
import { File } from '@/types';
import { folderShareAccessHeaders } from '@/utils/shareAccessTokens';

export const fileService = {
  async uploadFiles(
    files: globalThis.File[],
    folderId?: string,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal
  ) {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    if (folderId) {
      formData.append('folderId', folderId);
    }

    const response = await api.post('/files/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      signal,
      onUploadProgress: (progressEvent) => {
        if (progressEvent.total && onProgress) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(progress);
        }
      },
    });

    return response.data;
  },

  async uploadFile(
    file: globalThis.File,
    folderId?: string,
    onProgress?: (progress: number) => void,
    signal?: AbortSignal
  ) {
    return this.uploadFiles([file], folderId, onProgress, signal);
  },

  async listFiles(
    folderId?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    filters?: {
      mimeType?: string;
      minSize?: number;
      maxSize?: number;
      dateFrom?: string;
      dateTo?: string;
    }
  ): Promise<{ files: File[] }> {
    const response = await api.get('/files', {
      //@ts-ignore - params handling
      params: { folderId, sortBy, sortOrder, ...filters },
      headers: folderShareAccessHeaders(folderId),
    });
    return response.data;
  },

  async getFile(fileId: string): Promise<{ file: File }> {
    const response = await api.get(`/files/${fileId}`);
    return response.data;
  },

  async updateFile(fileId: string, name: string) {
    const response = await api.put(`/files/${fileId}`, { name });
    return response.data;
  },

  async moveFile(fileId: string, folderId?: string) {
    const response = await api.put(`/files/${fileId}/move`, { folderId });
    return response.data;
  },

  async deleteFile(fileId: string, permanent: boolean = false) {
    const response = await api.delete(`/files/${fileId}`, {
      params: { permanent },
    });
    return response.data;
  },

  async restoreFile(fileId: string) {
    const response = await api.post(`/files/${fileId}/restore`);
    return response.data;
  },

  async getDeletedFiles(): Promise<{ files: File[] }> {
    const response = await api.get('/files/deleted');
    return response.data;
  },

  async searchFiles(
    query: string,
    filters?: { mimeType?: string; dateFrom?: string; dateTo?: string }
  ): Promise<{ files: File[] }> {
    const response = await api.get('/files/search', {
      params: { q: query, ...filters },
    });
    return response.data;
  },

  getDownloadUrl(fileId: string): string {
    return `${api.defaults.baseURL}/files/${fileId}/download`;
  },

  getStreamUrl(fileId: string): string {
    return `${api.defaults.baseURL}/files/${fileId}/stream`;
  },

  // For files shared with you
  getSharedFileStreamUrl(fileId: string, _shareAccessToken?: string): string {
    return `${api.defaults.baseURL}/share/access/${fileId}/stream`;
    // Note: shareAccessToken is passed via header X-Share-Access-Token in actual requests
  },

  // For files shared with you
  getSharedFileDownloadUrl(fileId: string, _shareAccessToken?: string): string {
    return `${api.defaults.baseURL}/share/access/${fileId}/download`;
    // Note: shareAccessToken is passed via header X-Share-Access-Token in actual requests
  },

  async triggerDownload(fileId: string, fileName: string): Promise<void> {
    const response = await api.get(`/files/${fileId}/download`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async triggerSharedFileDownload(fileId: string, fileName: string, shareAccessToken?: string): Promise<void> {
    const headers: Record<string, string> = {};
    if (shareAccessToken) {
      headers['X-Share-Access-Token'] = shareAccessToken;
    }
    const response = await api.get(`/share/access/${fileId}/download`, {
      responseType: 'blob',
      headers,
    });
    const url = URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  async toggleFavorite(fileId: string): Promise<{ file: File }> {
    const response = await api.post(`/files/${fileId}/favorite`);
    return response.data;
  },

  async getFavoriteFiles(): Promise<{ files: File[] }> {
    const response = await api.get('/files/favorites');
    return response.data;
  },

  async exportFilesCsv(): Promise<Blob> {
    const response = await api.get('/files/export/csv', {
      responseType: 'blob',
    });
    return response.data;
  },
};
