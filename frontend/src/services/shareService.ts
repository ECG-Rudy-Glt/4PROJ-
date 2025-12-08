import api from './api';
import { SharedLink, SharedFolder } from '@/types';

export const shareService = {
  async createShareLink(
    fileId: string,
    options?: {
      password?: string;
      expiresAt?: string;
      maxDownloads?: number;
    }
  ): Promise<{ shareLink: SharedLink }> {
    const response = await api.post('/share/links', { fileId, ...options });
    return response.data;
  },

  async listShareLinks(): Promise<{ shareLinks: SharedLink[] }> {
    const response = await api.get('/share/links');
    return response.data;
  },

  async deleteShareLink(linkId: string) {
    const response = await api.delete(`/share/links/${linkId}`);
    return response.data;
  },

  async getSharedFile(token: string, password?: string) {
    const response = await api.get(`/share/${token}`, {
      params: { password },
    });
    return response.data;
  },

  getSharedFileDownloadUrl(token: string, password?: string): string {
    const params = password ? `?password=${password}` : '';
    return `${api.defaults.baseURL}/share/${token}/download${params}`;
  },

  async shareFolder(
    folderId: string,
    targetUserEmail: string,
    canEdit: boolean = false
  ) {
    const response = await api.post('/share/folders', {
      folderId,
      targetUserEmail,
      canEdit,
    });
    return response.data;
  },

  async listSharedWithMe(): Promise<{ sharedFolders: SharedFolder[] }> {
    const response = await api.get('/share/folders/with-me');
    return response.data;
  },

  async listSharedByMe(): Promise<{ sharedFolders: SharedFolder[] }> {
    const response = await api.get('/share/folders/by-me');
    return response.data;
  },

  async removeSharedFolder(shareId: string) {
    const response = await api.delete(`/share/folders/${shareId}`);
    return response.data;
  },
};
