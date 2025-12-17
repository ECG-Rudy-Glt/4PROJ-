import api from './api';

export interface FileVersion {
  id: string;
  fileId: string;
  versionNumber: number;
  name: string;
  size: bigint;
  storagePath: string;
  mimeType: string;
  createdAt: string;
  createdById: string;
  createdBy: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  };
}

export const versionService = {
  /**
   * Récupérer toutes les versions d'un fichier
   */
  async getFileVersions(fileId: string) {
    const { data } = await api.get(`/files/${fileId}/versions`);
    return data;
  },

  /**
   * Restaurer une version spécifique
   */
  async restoreVersion(fileId: string, versionId: string) {
    const { data } = await api.post(`/files/${fileId}/versions/${versionId}/restore`);
    return data;
  },

  /**
   * Supprimer une version
   */
  async deleteVersion(fileId: string, versionId: string) {
    const { data } = await api.delete(`/files/${fileId}/versions/${versionId}`);
    return data;
  },
};
