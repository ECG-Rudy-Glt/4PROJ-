import api from './api';
import { SharedFile, SharedFolder, SharedLink } from '../types';

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
    return res.data;
  },

  async listShareLinks(): Promise<{ shareLinks: SharedLink[] }> {
    const res = await api.get('/share/links');
    return res.data;
  },

  async deleteShareLink(linkId: string) {
    const res = await api.delete(`/share/links/${linkId}`);
    return res.data;
  },

  // ── Folder sharing (user-to-user) ───────────────────
  async shareFolder(folderId: string, targetUserEmail: string, permissions: SharePermissions = {}) {
    const res = await api.post('/share/folders', { folderId, targetUserEmail, ...permissions });
    return res.data;
  },

  async updateSharedFolderPermissions(shareId: string, permissions: SharePermissions) {
    const res = await api.patch(`/share/folders/${shareId}/permissions`, permissions);
    return res.data;
  },

  async listFoldersSharedWithMe(): Promise<{ sharedFolders: SharedFolder[] }> {
    const res = await api.get('/share/folders/with-me');
    return res.data;
  },

  async listFoldersSharedByMe(): Promise<{ sharedFolders: SharedFolder[] }> {
    const res = await api.get('/share/folders/by-me');
    return res.data;
  },

  async removeSharedFolder(shareId: string) {
    const res = await api.delete(`/share/folders/${shareId}`);
    return res.data;
  },

  // ── File sharing (user-to-user) ─────────────────────
  async shareFile(fileId: string, targetUserEmail: string, permissions: SharePermissions = {}) {
    const res = await api.post('/share/files', { fileId, targetUserEmail, ...permissions });
    return res.data;
  },

  async getFileShares(fileId: string): Promise<{ shares: SharedFile[] }> {
    const res = await api.get(`/share/files/${fileId}/shares`);
    return res.data;
  },

  async updateSharedFilePermissions(shareId: string, permissions: SharePermissions) {
    const res = await api.patch(`/share/files/${shareId}/permissions`, permissions);
    return res.data;
  },

  async listFilesSharedWithMe(): Promise<{ sharedFiles: SharedFile[] }> {
    const res = await api.get('/share/files/with-me');
    return res.data;
  },

  async listFilesSharedByMe(): Promise<{ sharedFiles: SharedFile[] }> {
    const res = await api.get('/share/files/by-me');
    return res.data;
  },

  async removeSharedFile(shareId: string) {
    const res = await api.delete(`/share/files/${shareId}`);
    return res.data;
  },

  // ── Pending shares (accept/reject) ──────────────────
  async getPendingShares(): Promise<{ files: SharedFile[]; folders: SharedFolder[] }> {
    const res = await api.get('/share/pending');
    return res.data;
  },

  async acceptSharedFolder(shareId: string) {
    const res = await api.post(`/share/folders/${shareId}/accept`);
    return res.data;
  },

  async acceptSharedFile(shareId: string) {
    const res = await api.post(`/share/files/${shareId}/accept`);
    return res.data;
  },

  async rejectSharedFolder(shareId: string) {
    const res = await api.post(`/share/folders/${shareId}/reject`);
    return res.data;
  },

  async rejectSharedFile(shareId: string) {
    const res = await api.post(`/share/files/${shareId}/reject`);
    return res.data;
  },

  async getSharedFolderContents(folderId: string): Promise<{ files: any[]; folders: any[] }> {
    const res = await api.get(`/share/folders/${folderId}/contents`);
    return res.data;
  },

  // ── Accepted shares ─────────────────────────────────
  async getAcceptedShares() {
    const res = await api.get('/files/shares/accepted');
    return res.data;
  },
};
