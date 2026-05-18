import api from './api';
import { Comment } from '../types';

function unwrap<T>(data: any): T {
  return (data?.success === true && 'data' in data) ? data.data : data;
}

export const commentService = {
  async createComment(fileId: string, content: string, parentId?: string): Promise<{ comment: Comment }> {
    const res = await api.post(`/files/${fileId}/comments`, { content, parentId });
    return unwrap(res.data);
  },

  async getFileComments(fileId: string): Promise<{ comments: Comment[] }> {
    const res = await api.get(`/files/${fileId}/comments`);
    return unwrap(res.data);
  },

  async updateComment(commentId: string, content: string): Promise<{ comment: Comment }> {
    const res = await api.put(`/comments/${commentId}`, { content });
    return unwrap(res.data);
  },

  async deleteComment(commentId: string) {
    const res = await api.delete(`/comments/${commentId}`);
    return unwrap(res.data);
  },

  async countFileComments(fileId: string): Promise<{ count: number }> {
    const res = await api.get(`/files/${fileId}/comments/count`);
    return unwrap(res.data);
  },
};
