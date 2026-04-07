import api from './api';
import { Folder, Breadcrumb } from '../types';

export const folderService = {
  async listFolders(parentId?: string): Promise<{ folders: Folder[] }> {
    const res = await api.get('/folders', { params: { parentId } });
    return res.data;
  },

  async createFolder(name: string, parentId?: string): Promise<{ folder: Folder }> {
    const res = await api.post('/folders', { name, parentId });
    return res.data;
  },

  async renameFolder(folderId: string, name: string): Promise<{ folder: Folder }> {
    const res = await api.put(`/folders/${folderId}`, { name });
    return res.data;
  },

  async deleteFolder(folderId: string) {
    const res = await api.delete(`/folders/${folderId}`);
    return res.data;
  },

  async moveFolder(folderId: string, parentId?: string): Promise<{ folder: Folder }> {
    const res = await api.put(`/folders/${folderId}/move`, { parentId });
    return res.data;
  },

  async listAllFolders(): Promise<{ folders: Folder[] }> {
    const res = await api.get('/folders', { params: { all: true } });
    return res.data;
  },

  async getBreadcrumbs(folderId: string): Promise<Breadcrumb[]> {
    const res = await api.get(`/folders/${folderId}/breadcrumbs`);
    return res.data;
  },
};
