import api from './api';
import { Tag, FileTag, FileItem } from '../types';

function unwrap<T>(data: any): T {
  return (data?.success === true && 'data' in data) ? data.data : data;
}

export const tagService = {
  async createTag(name: string, color?: string): Promise<{ tag: Tag }> {
    const res = await api.post('/tags', { name, color });
    return unwrap(res.data);
  },

  async getUserTags(): Promise<{ tags: Tag[] }> {
    const res = await api.get('/tags');
    return unwrap(res.data);
  },

  async updateTag(tagId: string, name?: string, color?: string): Promise<{ tag: Tag }> {
    const res = await api.put(`/tags/${tagId}`, { name, color });
    return unwrap(res.data);
  },

  async deleteTag(tagId: string): Promise<{ message: string }> {
    const res = await api.delete(`/tags/${tagId}`);
    return unwrap(res.data);
  },

  async addTagToFile(fileId: string, tagId: string): Promise<{ fileTag: FileTag }> {
    const res = await api.post(`/tags/file/${fileId}`, { tagId });
    return unwrap(res.data);
  },

  async removeTagFromFile(fileId: string, tagId: string): Promise<{ message: string }> {
    const res = await api.delete(`/tags/file/${fileId}/${tagId}`);
    return unwrap(res.data);
  },

  async getFileTags(fileId: string): Promise<{ tags: FileTag[] }> {
    const res = await api.get(`/tags/file/${fileId}`);
    return unwrap(res.data);
  },

  async getFilesByTag(tagId: string): Promise<{ files: FileItem[] }> {
    const res = await api.get(`/tags/${tagId}/files`);
    return unwrap(res.data);
  },
};
