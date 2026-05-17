import api from './api';

const shareAccessHeaders = (shareAccessToken?: string | null) =>
  shareAccessToken ? { headers: { 'X-Share-Access-Token': shareAccessToken } } : undefined;

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
  async createComment(fileId: string, content: string, parentId?: string, shareAccessToken?: string | null) {
    const { data } = await api.post(`/files/${fileId}/comments`, {
      content,
      parentId,
    }, shareAccessHeaders(shareAccessToken));
    return data;
  },

  /**
   * Récupérer tous les commentaires d'un fichier
   */
  async getFileComments(fileId: string, shareAccessToken?: string | null) {
    const { data } = await api.get(`/files/${fileId}/comments`, shareAccessHeaders(shareAccessToken));
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
  async countFileComments(fileId: string, shareAccessToken?: string | null) {
    const { data } = await api.get(`/files/${fileId}/comments/count`, shareAccessHeaders(shareAccessToken));
    return data;
  },
};
