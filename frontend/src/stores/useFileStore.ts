import { create } from 'zustand';
import { File, Folder } from '@/types';
import { fileService } from '@/services/fileService';
import { folderService } from '@/services/folderService';

interface FileState {
  files: File[];
  folders: Folder[];
  currentFolderId: string | null;
  isLoading: boolean;
  isDragging: boolean;
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
  deleteFolder: (folderId: string, permanent?: boolean) => Promise<void>;
  setCurrentFolder: (folderId: string | null) => void;
  setSorting: (sortBy: string, sortOrder: 'asc' | 'desc') => void;
  setIsDragging: (isDragging: boolean) => void;
}

export const useFileStore = create<FileState>((set, get) => ({
  files: [],
  folders: [],
  currentFolderId: null,
  isLoading: false,
  isDragging: false,
  sortBy: 'updatedAt',
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
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  uploadFile: async (file, folderId) => {
    await fileService.uploadFile(file, folderId);
    await get().loadContent(folderId);
  },

  deleteFile: async (fileId, permanent = false) => {
    await fileService.deleteFile(fileId, permanent);
    await get().loadContent(get().currentFolderId || undefined);
  },

  createFolder: async (name, parentId) => {
    await folderService.createFolder(name, parentId);
    await get().loadContent(parentId);
  },

  deleteFolder: async (folderId, permanent = false) => {
    await folderService.deleteFolder(folderId, permanent);
    await get().loadContent(get().currentFolderId || undefined);
  },

  setCurrentFolder: (folderId) => {
    set({ currentFolderId: folderId });
  },

  setSorting: (sortBy, sortOrder) => {
    set({ sortBy, sortOrder });
  },

  setIsDragging: (isDragging) => {
    set({ isDragging });
  },
}));
