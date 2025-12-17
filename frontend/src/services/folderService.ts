import api from './api';
import { Folder, Breadcrumb } from '@/types';

export const folderService = {
  async createFolder(name: string, parentId?: string) {
    const response = await api.post('/folders', { name, parentId });
    return response.data;
  },

  async listFolders(parentId?: string): Promise<{ folders: Folder[] }> {
    const response = await api.get('/folders', {
      params: { parentId },
    });
    return response.data;
  },

  async getFolder(folderId: string): Promise<{ folder: Folder }> {
    const response = await api.get(`/folders/${folderId}`);
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

  async deleteFolder(folderId: string) {
    const response = await api.delete(`/folders/${folderId}`);
    return response.data;
  },

  async getBreadcrumbs(folderId: string): Promise<{ breadcrumbs: Breadcrumb[] }> {
    const response = await api.get(`/folders/${folderId}/breadcrumbs`);
    return response.data;
  },
};
