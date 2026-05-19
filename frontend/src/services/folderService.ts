import api from './api';
import { Folder, Breadcrumb } from '@/types';
import { folderShareAccessHeaders } from '@/utils/shareAccessTokens';

export const folderService = {
  async createFolder(name: string, parentId?: string) {
    const response = await api.post('/folders', { name, parentId });
    return response.data;
  },

  async listFolders(parentId?: string): Promise<{ folders: Folder[] }> {
    const response = await api.get('/folders', {
      params: { parentId },
      headers: folderShareAccessHeaders(parentId),
    });
    return response.data;
  },

  async getFolder(folderId: string): Promise<{ folder: Folder }> {
    const response = await api.get(`/folders/${folderId}`, {
      headers: folderShareAccessHeaders(folderId),
    });
    return response.data;
  },

  async updateFolder(folderId: string, name: string) {
    const response = await api.put(`/folders/${folderId}`, { name });
    return response.data;
  },

  async moveFolder(folderId: string, parentId?: string) {
    const response = await api.put(`/folders/${folderId}/move`, { parentId });
    return response.data;
  },

  async deleteFolder(folderId: string, permanent: boolean = false) {
    const response = await api.delete(`/folders/${folderId}`, {
      params: { permanent },
    });
    return response.data;
  },

  async restoreFolder(folderId: string) {
    const response = await api.post(`/folders/${folderId}/restore`);
    return response.data;
  },

  async getDeletedFolders() {
    const { data } = await api.get('/folders/deleted');
    return data;
  },

  async getFolderTrashContents(folderId: string) {
    const { data } = await api.get(`/folders/${folderId}/trash-contents`, {
      headers: folderShareAccessHeaders(folderId),
    });
    return data;
  },

  async getBreadcrumbs(folderId: string): Promise<{ breadcrumbs: Breadcrumb[] }> {
    const response = await api.get(`/folders/${folderId}/breadcrumbs`, {
      headers: folderShareAccessHeaders(folderId),
    });
    return response.data;
  },

  async downloadFolderAsZip(folderId: string, folderName: string): Promise<void> {
    const response = await api.get(`/folders/${folderId}/download`, {
      responseType: 'blob',
      headers: folderShareAccessHeaders(folderId),
    });
    const url = URL.createObjectURL(new Blob([response.data], { type: 'application/zip' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${folderName}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
