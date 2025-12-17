import api from './api';

export interface Comment {
  id: string;
  content: string;
  fileId: string;
  userId: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    avatar: string | null;
  };
  replies?: Comment[];
}

export const commentService = {
  /**
   * Créer un nouveau commentaire
   */
  async createComment(fileId: string, content: string, parentId?: string) {
    const { data } = await api.post(`/files/${fileId}/comments`, {
      content,
      parentId,
    });
    return data;
  },

  /**
   * Récupérer tous les commentaires d'un fichier
   */
  async getFileComments(fileId: string) {
    const { data } = await api.get(`/files/${fileId}/comments`);
    return data;
  },

  /**
   * Mettre à jour un commentaire
   */
  async updateComment(commentId: string, content: string) {
    const { data } = await api.put(`/comments/${commentId}`, { content });
    return data;
  },

  /**
   * Supprimer un commentaire
   */
  async deleteComment(commentId: string) {
    const { data } = await api.delete(`/comments/${commentId}`);
    return data;
  },

  /**
   * Compter les commentaires d'un fichier
   */
  async countFileComments(fileId: string) {
    const { data } = await api.get(`/files/${fileId}/comments/count`);
    return data;
  },
};
