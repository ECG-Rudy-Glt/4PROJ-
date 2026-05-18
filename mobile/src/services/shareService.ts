import api from './api';
import { SharedFile, SharedFolder, SharedLink } from '../types';

function unwrap<T>(data: any): T {
  return (data?.success === true && 'data' in data) ? data.data : data;
}

export interface SharePermissions {
  canRead?: boolean;
  canWrite?: boolean;
  canDelete?: boolean;
  canShare?: boolean;
}

export const shareService = {
  // ── Public links (file) ─────────────────────────────
  async createShareLink(
    fileId: string,
    options?: { password?: string; expiresAt?: string; maxDownloads?: number },
  ): Promise<{ shareLink: SharedLink }> {
    const res = await api.post('/share/links', { fileId, ...options });
    return unwrap(res.data);
  },

  async createBundleShareLink(
    fileIds: string[],
    options?: { password?: string; expiresAt?: string; maxDownloads?: number },
  ): Promise<{ shareLink: { id: string; token: string; fileIds: string[]; url: string; expiresAt?: string; maxDownloads?: number; downloads: number } }> {
    const res = await api.post('/share/links/bundle', { fileIds, ...options });
    return unwrap(res.data);
  },

  async listShareLinks(): Promise<{ shareLinks: SharedLink[] }> {
    const res = await api.get('/share/links');
    return unwrap(res.data);
  },

  async deleteShareLink(linkId: string) {
    const res = await api.delete(`/share/links/${linkId}`);
    return unwrap(res.data);
  },

  // ── Folder sharing (user-to-user) ───────────────────
  async shareFolder(folderId: string, targetUserEmail: string, permissions: SharePermissions = {}) {
    const res = await api.post('/share/folders', { folderId, targetUserEmail, ...permissions });
    return unwrap(res.data);
  },

  async updateSharedFolderPermissions(shareId: string, permissions: SharePermissions) {
    const res = await api.patch(`/share/folders/${shareId}/permissions`, permissions);
    return unwrap(res.data);
  },

  async listFoldersSharedWithMe(): Promise<{ sharedFolders: SharedFolder[] }> {
    const res = await api.get('/share/folders/with-me');
    return unwrap(res.data);
  },

  async listFoldersSharedByMe(): Promise<{ sharedFolders: SharedFolder[] }> {
    const res = await api.get('/share/folders/by-me');
    return unwrap(res.data);
  },

  async removeSharedFolder(shareId: string) {
    const res = await api.delete(`/share/folders/${shareId}`);
    return unwrap(res.data);
  },

  // ── File sharing (user-to-user) ─────────────────────
  async shareFile(fileId: string, targetUserEmail: string, permissions: SharePermissions = {}) {
    const res = await api.post('/share/files', { fileId, targetUserEmail, ...permissions });
    return unwrap(res.data);
  },

  async getFileShares(fileId: string): Promise<{ shares: SharedFile[] }> {
    const res = await api.get(`/share/files/${fileId}/shares`);
    return unwrap(res.data);
  },

  async updateSharedFilePermissions(shareId: string, permissions: SharePermissions) {
    const res = await api.patch(`/share/files/${shareId}/permissions`, permissions);
    return unwrap(res.data);
  },

  async listFilesSharedWithMe(): Promise<{ sharedFiles: SharedFile[] }> {
    const res = await api.get('/share/files/with-me');
    return unwrap(res.data);
  },

  async listFilesSharedByMe(): Promise<{ sharedFiles: SharedFile[] }> {
    const res = await api.get('/share/files/by-me');
    return unwrap(res.data);
  },

  async removeSharedFile(shareId: string) {
    const res = await api.delete(`/share/files/${shareId}`);
    return unwrap(res.data);
  },

  // ── Pending shares (accept/reject) ──────────────────
  async getPendingShares(): Promise<{ files: SharedFile[]; folders: SharedFolder[] }> {
    const res = await api.get('/share/pending');
    return unwrap(res.data);
  },

  async acceptSharedFolder(shareId: string) {
    const res = await api.post(`/share/folders/${shareId}/accept`);
    return unwrap(res.data);
  },

  async acceptSharedFile(shareId: string) {
    const res = await api.post(`/share/files/${shareId}/accept`);
    return unwrap(res.data);
  },

  async rejectSharedFolder(shareId: string) {
    const res = await api.post(`/share/folders/${shareId}/reject`);
    return unwrap(res.data);
  },

  async rejectSharedFile(shareId: string) {
    const res = await api.post(`/share/files/${shareId}/reject`);
    return unwrap(res.data);
  },

  async getSharedFolderContents(folderId: string, rootFolderId?: string): Promise<{ files: any[]; folders: any[] }> {
    const res = await api.get(`/share/folders/${folderId}/contents`, {
      params: rootFolderId ? { rootFolderId } : undefined,
    });
    return res.data;
  },

  // ── Accepted shares ─────────────────────────────────
  async getAcceptedShares() {
    const res = await api.get('/files/shares/accepted');
    return res.data;
  },
};
