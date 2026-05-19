import api from './api';
import { SharedLink, SharedFolder, SharedFile } from '@/types';

const SHARE_ACCESS_HEADER = 'X-Share-Access-Token';

const shareAccessHeaders = (shareAccessToken?: string | null) =>
  shareAccessToken ? { [SHARE_ACCESS_HEADER]: shareAccessToken } : undefined;

type ShareUnlockResponse = { shareAccessToken: string | null; expiresIn?: number };

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

  async getSharedFile(token: string, shareAccessToken?: string | null) {
    const response = await api.get(`/share/${token}`, {
      headers: shareAccessHeaders(shareAccessToken),
    });
    return response.data;
  },

  getSharedFileDownloadUrl(token: string): string {
    return `${api.defaults.baseURL}/share/${token}/download`;
  },

  async downloadSharedFile(token: string, shareAccessToken?: string | null): Promise<Blob> {
    const response = await api.get(`/share/${token}/download`, {
      responseType: 'blob',
      headers: shareAccessHeaders(shareAccessToken),
    });
    return response.data;
  },

  async downloadBundleShareLink(token: string, shareAccessToken?: string | null): Promise<Blob> {
    const response = await api.get(`/share/${token}/download-bundle`, {
      responseType: 'blob',
      headers: shareAccessHeaders(shareAccessToken),
    });
    return response.data;
  },

  async shareFolder(
    folderId: string,
    targetUserEmail: string,
    permissions: {
      canRead?: boolean;
      canWrite?: boolean;
      canDelete?: boolean;
      canShare?: boolean;
    } = {},
    password?: string
  ) {
    const response = await api.post('/share/folders', {
      folderId,
      targetUserEmail,
      ...permissions,
      ...(password ? { password } : {}),
    });
    return response.data;
  },

  async updateSharedFolderPermissions(
    shareId: string,
    permissions: {
      canRead?: boolean;
      canWrite?: boolean;
      canDelete?: boolean;
      canShare?: boolean;
      password?: string;
      clearPassword?: boolean;
    }
  ) {
    const response = await api.patch(`/share/folders/${shareId}/permissions`, permissions);
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

  // File sharing methods
  async shareFile(
    fileId: string,
    targetUserEmail: string,
    permissions: {
      canRead?: boolean;
      canWrite?: boolean;
      canDelete?: boolean;
      canShare?: boolean;
    } = {},
    password?: string
  ) {
    const response = await api.post('/share/files', {
      fileId,
      targetUserEmail,
      ...permissions,
      ...(password ? { password } : {}),
    });
    return response.data;
  },

  async getFileShares(fileId: string): Promise<{ shares: SharedFile[] }> {
    const response = await api.get(`/share/files/${fileId}/shares`);
    return response.data;
  },

  async updateSharedFilePermissions(
    shareId: string,
    permissions: {
      canRead?: boolean;
      canWrite?: boolean;
      canDelete?: boolean;
      canShare?: boolean;
      password?: string;
      clearPassword?: boolean;
    }
  ) {
    const response = await api.patch(`/share/files/${shareId}/permissions`, permissions);
    return response.data;
  },

  async listFilesSharedWithMe(): Promise<{ sharedFiles: SharedFile[] }> {
    const response = await api.get('/share/files/with-me');
    return response.data;
  },

  async listFilesSharedByMe(): Promise<{ sharedFiles: SharedFile[] }> {
    const response = await api.get('/share/files/by-me');
    return response.data;
  },

  async removeSharedFile(shareId: string) {
    const response = await api.delete(`/share/files/${shareId}`);
    return response.data;
  },

  // Share acceptance/rejection
  async getPendingShares() {
    const response = await api.get('/share/pending');
    return response.data;
  },

  async acceptSharedFolder(shareId: string) {
    const response = await api.post(`/share/folders/${shareId}/accept`);
    return response.data;
  },

  async acceptSharedFile(shareId: string) {
    const response = await api.post(`/share/files/${shareId}/accept`);
    return response.data;
  },

  async rejectSharedFolder(shareId: string) {
    const response = await api.post(`/share/folders/${shareId}/reject`);
    return response.data;
  },

  async rejectSharedFile(shareId: string) {
    const response = await api.post(`/share/files/${shareId}/reject`);
    return response.data;
  },

  // Get accepted shares
  async getAcceptedShares() {
    const response = await api.get('/files/shares/accepted');
    return response.data;
  },

  // Unlock password-protected direct share (returns shareAccessToken)
  async unlockDirectShare(shareId: string, password: string): Promise<ShareUnlockResponse> {
    const response = await api.post(`/share/files/${shareId}/unlock`, { password });
    return response.data;
  },

  // Unlock password-protected direct folder share (returns shareAccessToken)
  async unlockDirectFolderShare(shareId: string, password: string): Promise<ShareUnlockResponse> {
    const response = await api.post(`/share/folders/${shareId}/unlock`, { password });
    return response.data;
  },

  // Unlock password-protected public share link (returns shareAccessToken)
  async unlockPublicShare(token: string, password: string): Promise<ShareUnlockResponse> {
    const response = await api.post(`/share/${token}/unlock`, { password });
    return response.data;
  },
};
