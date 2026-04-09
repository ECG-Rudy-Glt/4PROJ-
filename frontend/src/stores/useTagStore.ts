import { create } from 'zustand';
import { Tag } from '@/types';
import { tagService } from '@/services/tagService';

interface TagState {
  tags: Tag[];
  isLoading: boolean;
  isLoaded: boolean;
  loadTags: () => Promise<void>;
  invalidateTags: () => void;
  createTag: (name: string, color?: string) => Promise<Tag>;
  updateTag: (tagId: string, name?: string, color?: string) => Promise<Tag>;
  deleteTag: (tagId: string) => Promise<void>;
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],
  isLoading: false,
  isLoaded: false,

  loadTags: async () => {
    if (get().isLoading || get().isLoaded) return;
    set({ isLoading: true });
    try {
      const { tags } = await tagService.getUserTags();
      set({ tags, isLoading: false, isLoaded: true });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  invalidateTags: () => set({ isLoaded: false }),

  createTag: async (name: string, color?: string) => {
    const { tag } = await tagService.createTag(name, color);
    set({ tags: [...get().tags, tag] });
    return tag;
  },

  updateTag: async (tagId: string, name?: string, color?: string) => {
    const { tag } = await tagService.updateTag(tagId, name, color);
    set({
      tags: get().tags.map((t) => (t.id === tagId ? tag : t)),
    });
    return tag;
  },

  deleteTag: async (tagId: string) => {
    await tagService.deleteTag(tagId);
    set({ tags: get().tags.filter((t) => t.id !== tagId) });
  },
}));
