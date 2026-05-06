import api from './api';
import { Folder, Breadcrumb } from '../types';

function unwrap<T>(data: any): T {
  return (data?.success === true && 'data' in data) ? data.data : data;
}

export const folderService = {
  async listFolders(parentId?: string): Promise<{ folders: Folder[] }> {
    const res = await api.get('/folders', { params: { parentId } });
    return unwrap(res.data);
  },

  async createFolder(name: string, parentId?: string): Promise<{ folder: Folder }> {
    const res = await api.post('/folders', { name, parentId });
    return unwrap(res.data);
  },

  async renameFolder(folderId: string, name: string): Promise<{ folder: Folder }> {
    const res = await api.put(`/folders/${folderId}`, { name });
    return unwrap(res.data);
  },

  async deleteFolder(folderId: string) {
    const res = await api.delete(`/folders/${folderId}`);
    return unwrap(res.data);
  },

  async moveFolder(folderId: string, parentId?: string): Promise<{ folder: Folder }> {
    const res = await api.put(`/folders/${folderId}/move`, { parentId });
    return unwrap(res.data);
  },

  async listAllFolders(): Promise<{ folders: Folder[] }> {
    const res = await api.get('/folders', { params: { all: true } });
    return unwrap(res.data);
  },

  async getBreadcrumbs(folderId: string): Promise<Breadcrumb[]> {
    const res = await api.get(`/folders/${folderId}/breadcrumbs`);
    const unwrapped = unwrap<any>(res.data);
    return unwrapped.breadcrumbs ?? unwrapped;
  },
};
