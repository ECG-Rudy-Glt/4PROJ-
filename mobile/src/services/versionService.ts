import api from './api';
import { FileVersion } from '../types';

export const versionService = {
  async getFileVersions(fileId: string): Promise<{ versions: FileVersion[] }> {
    const res = await api.get(`/files/${fileId}/versions`);
    return res.data;
  },

  async restoreVersion(fileId: string, versionId: string) {
    const res = await api.post(`/files/${fileId}/versions/${versionId}/restore`);
    return res.data;
  },

  async deleteVersion(fileId: string, versionId: string) {
    const res = await api.delete(`/files/${fileId}/versions/${versionId}`);
    return res.data;
  },
};
