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

  async deleteFolder(folderId: string, permanent = false) {
    const res = await api.delete(`/folders/${folderId}`, { params: { permanent } });
    return unwrap(res.data);
  },

  async moveFolder(folderId: string, parentId?: string): Promise<{ folder: Folder }> {
    const res = await api.put(`/folders/${folderId}/move`, { parentId });
    return unwrap(res.data);
  },

  async listAllFolders(): Promise<{ folders: Folder[] }> {
    const seen = new Set<string>();
    const folders: Folder[] = [];

    const visit = async (parentId?: string): Promise<void> => {
      const { folders: children } = await folderService.listFolders(parentId);
      for (const folder of children ?? []) {
        if (seen.has(folder.id)) continue;
        seen.add(folder.id);
        folders.push(folder);
        await visit(folder.id);
      }
    };

    await visit();
    return { folders };
  },

  async getBreadcrumbs(folderId: string): Promise<Breadcrumb[]> {
    const res = await api.get(`/folders/${folderId}/breadcrumbs`);
    const unwrapped = unwrap<any>(res.data);
    return unwrapped.breadcrumbs ?? unwrapped;
  },

  async getDeletedFolders(): Promise<{ folders: Folder[] }> {
    const res = await api.get('/folders/deleted');
    return unwrap(res.data);
  },

  async restoreFolder(folderId: string): Promise<{ folder: Folder }> {
    const res = await api.post(`/folders/${folderId}/restore`);
    return unwrap(res.data);
  },
};
