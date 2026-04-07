import api from './api';
import { Comment } from '../types';

export const commentService = {
  async createComment(fileId: string, content: string, parentId?: string): Promise<{ comment: Comment }> {
    const res = await api.post(`/files/${fileId}/comments`, { content, parentId });
    return res.data;
  },

  async getFileComments(fileId: string): Promise<{ comments: Comment[] }> {
    const res = await api.get(`/files/${fileId}/comments`);
    return res.data;
  },

  async updateComment(commentId: string, content: string): Promise<{ comment: Comment }> {
    const res = await api.put(`/comments/${commentId}`, { content });
    return res.data;
  },

  async deleteComment(commentId: string) {
    const res = await api.delete(`/comments/${commentId}`);
    return res.data;
  },

  async countFileComments(fileId: string): Promise<{ count: number }> {
    const res = await api.get(`/files/${fileId}/comments/count`);
    return res.data;
  },
};
