import { create } from 'zustand';
import { File, Folder } from '@/types';
import { fileService } from '@/services/fileService';
import { folderService } from '@/services/folderService';

interface FileState {
  files: File[];
  folders: Folder[];
  currentFolderId: string | null;
  isLoading: boolean;
  loadContent: (folderId?: string) => Promise<void>;
  uploadFile: (file: globalThis.File, folderId?: string) => Promise<void>;
  deleteFile: (fileId: string, permanent?: boolean) => Promise<void>;
  createFolder: (name: string, parentId?: string) => Promise<void>;
  setCurrentFolder: (folderId: string | null) => void;
}

export const useFileStore = create<FileState>((set, get) => ({
  files: [],
  folders: [],
  currentFolderId: null,
  isLoading: false,

  loadContent: async (folderId) => {
    set({ isLoading: true });
    try {
      const [filesData, foldersData] = await Promise.all([
        fileService.listFiles(folderId),
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
    try {
      await fileService.uploadFile(file, folderId);
      await get().loadContent(folderId);
    } catch (error) {
      throw error;
    }
  },

  deleteFile: async (fileId, permanent = false) => {
    try {
      await fileService.deleteFile(fileId, permanent);
      await get().loadContent(get().currentFolderId || undefined);
    } catch (error) {
      throw error;
    }
  },

  createFolder: async (name, parentId) => {
    try {
      await folderService.createFolder(name, parentId);
      await get().loadContent(parentId);
    } catch (error) {
      throw error;
    }
  },

  setCurrentFolder: (folderId) => {
    set({ currentFolderId: folderId });
  },
}));
