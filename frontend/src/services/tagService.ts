import api from './api';
import { Tag, FileTag } from '@/types';

export const tagService = {
  // Créer un tag
  async createTag(name: string, color?: string): Promise<{ tag: Tag }> {
    const response = await api.post('/tags', { name, color });
    return response.data;
  },

  // Récupérer tous les tags de l'utilisateur
  async getUserTags(): Promise<{ tags: Tag[] }> {
    const response = await api.get('/tags');
    return response.data;
  },

  // Mettre à jour un tag
  async updateTag(tagId: string, name?: string, color?: string): Promise<{ tag: Tag }> {
    const response = await api.put(`/tags/${tagId}`, { name, color });
    return response.data;
  },

  // Supprimer un tag
  async deleteTag(tagId: string): Promise<{ message: string }> {
    const response = await api.delete(`/tags/${tagId}`);
    return response.data;
  },

  // Ajouter un tag à un fichier
  async addTagToFile(fileId: string, tagId: string): Promise<{ fileTag: FileTag }> {
    const response = await api.post(`/tags/file/${fileId}`, { tagId });
    return response.data;
  },

  // Retirer un tag d'un fichier
  async removeTagFromFile(fileId: string, tagId: string): Promise<{ message: string }> {
    const response = await api.delete(`/tags/file/${fileId}/${tagId}`);
    return response.data;
  },

  // Récupérer tous les tags d'un fichier
  async getFileTags(fileId: string): Promise<{ tags: FileTag[] }> {
    const response = await api.get(`/tags/file/${fileId}`);
    return response.data;
  },

  // Récupérer tous les fichiers avec un tag spécifique
  async getFilesByTag(tagId: string): Promise<{ files: any[] }> {
    const response = await api.get(`/tags/${tagId}/files`);
    return response.data;
  },
};
