import { create } from 'zustand';
import { File, Folder } from '@/types';
import { fileService } from '@/services/fileService';
import { folderService } from '@/services/folderService';

interface FileState {
  files: File[];
  folders: Folder[];
  currentFolderId: string | null;
  isLoading: boolean;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  loadContent: (
    folderId?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    filters?: any
  ) => Promise<void>;
  uploadFile: (file: globalThis.File, folderId?: string) => Promise<void>;
  deleteFile: (fileId: string, permanent?: boolean) => Promise<void>;
  createFolder: (name: string, parentId?: string) => Promise<void>;
  setCurrentFolder: (folderId: string | null) => void;
  setSorting: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
}

export const useFileStore = create<FileState>((set, get) => ({
  files: [],
  folders: [],
  currentFolderId: null,
  isLoading: false,
  sortBy: 'createdAt',
  sortOrder: 'desc',

  loadContent: async (folderId, sortBy, sortOrder, filters) => {
    set({ isLoading: true });
    try {
      const currentSortBy = sortBy || get().sortBy;
      const currentSortOrder = sortOrder || get().sortOrder;

      const [filesData, foldersData] = await Promise.all([
        fileService.listFiles(folderId, currentSortBy, currentSortOrder, filters),
        folderService.listFolders(folderId),
      ]);
      set({
        files: filesData.files,
        folders: foldersData.folders,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
      throw new Error('Failed to load content');
    }
  },

  uploadFile: async (file, folderId) => {
    try {
      await fileService.uploadFile(file, folderId);
      await get().loadContent(folderId);
    } catch {
      throw new Error('Failed to upload file');
    }
  },

  deleteFile: async (fileId, permanent = false) => {
    try {
      await fileService.deleteFile(fileId, permanent);
      await get().loadContent(get().currentFolderId || undefined);
    } catch {
      throw new Error('Failed to delete file');
    }
  },

  createFolder: async (name, parentId) => {
    try {
      await folderService.createFolder(name, parentId);
      await get().loadContent(parentId);
    } catch {
      throw new Error('Failed to create folder');
    }
  },

  setCurrentFolder: (folderId) => {
    set({ currentFolderId: folderId });
  },

  setSorting: (sortBy, sortOrder) => {
    set({ sortBy, sortOrder });
  },
}));
