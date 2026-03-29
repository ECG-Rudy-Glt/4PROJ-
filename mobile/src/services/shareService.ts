import api from './api';
import { SharedFile, SharedFolder } from '../types';

export const shareService = {
  async getSharedWithMe(): Promise<{ files: SharedFile[]; folders: SharedFolder[] }> {
    const res = await api.get('/share/with-me');
    return res.data;
  },

  async getSharedByMe(): Promise<{ files: SharedFile[]; folders: SharedFolder[] }> {
    const res = await api.get('/share/by-me');
    return res.data;
  },

  async acceptShare(type: 'file' | 'folder', shareId: string): Promise<void> {
    await api.post(`/share/${type}/${shareId}/accept`);
  },

  async removeShare(type: 'file' | 'folder', shareId: string): Promise<void> {
    await api.delete(`/share/${type}/${shareId}`);
  },
};
