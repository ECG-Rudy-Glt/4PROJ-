import { create } from 'zustand';
import { Tag } from '@/types';
import { tagService } from '@/services/tagService';

interface TagState {
  tags: Tag[];
  isLoading: boolean;
  loadTags: () => Promise<void>;
  createTag: (name: string, color?: string) => Promise<Tag>;
  updateTag: (tagId: string, name?: string, color?: string) => Promise<Tag>;
  deleteTag: (tagId: string) => Promise<void>;
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],
  isLoading: false,

  loadTags: async () => {
    set({ isLoading: true });
    try {
      const { tags } = await tagService.getUserTags();
      set({ tags, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  createTag: async (name: string, color?: string) => {
    try {
      const { tag } = await tagService.createTag(name, color);
      set({ tags: [...get().tags, tag] });
      return tag;
    } catch (error) {
      throw error;
    }
  },

  updateTag: async (tagId: string, name?: string, color?: string) => {
    try {
      const { tag } = await tagService.updateTag(tagId, name, color);
      set({
        tags: get().tags.map((t) => (t.id === tagId ? tag : t)),
      });
      return tag;
    } catch (error) {
      throw error;
    }
  },

  deleteTag: async (tagId: string) => {
    try {
      await tagService.deleteTag(tagId);
      set({ tags: get().tags.filter((t) => t.id !== tagId) });
    } catch (error) {
      throw error;
    }
  },
}));
