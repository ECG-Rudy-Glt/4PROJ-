import { create } from 'zustand';
import { FileItem, Folder, Breadcrumb } from '../types';
import { fileService } from '../services/fileService';
import { folderService } from '../services/folderService';

interface FileState {
  files: FileItem[];
  folders: Folder[];
  breadcrumbs: Breadcrumb[];
  currentFolderId: string | undefined;
  loading: boolean;
  error: string | null;

  fetchContents: (folderId?: string) => Promise<void>;
  navigateToFolder: (folderId?: string) => Promise<void>;
  createFolder: (name: string) => Promise<void>;
  renameFile: (fileId: string, name: string) => Promise<void>;
  renameFolder: (folderId: string, name: string) => Promise<void>;
  deleteFile: (fileId: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  moveFile: (fileId: string, folderId?: string) => Promise<void>;
  moveFolder: (folderId: string, parentId?: string) => Promise<void>;
  toggleFavorite: (fileId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const useFileStore = create<FileState>((set, get) => ({
  files: [],
  folders: [],
  breadcrumbs: [],
  currentFolderId: undefined,
  loading: false,
  error: null,

  fetchContents: async (folderId) => {
    set({ loading: true, error: null });
    try {
      const [filesRes, foldersRes] = await Promise.all([
        fileService.listFiles(folderId),
        folderService.listFolders(folderId),
      ]);

      let breadcrumbs: Breadcrumb[] = [];
      if (folderId) {
        breadcrumbs = await folderService.getBreadcrumbs(folderId);
      }

      set({
        files: filesRes.files,
        folders: foldersRes.folders,
        breadcrumbs,
        currentFolderId: folderId,
        loading: false,
      });
    } catch {
      set({ error: 'Impossible de charger les fichiers', loading: false });
    }
  },

  navigateToFolder: async (folderId) => {
    await get().fetchContents(folderId);
  },

  createFolder: async (name) => {
    const { currentFolderId } = get();
    await folderService.createFolder(name, currentFolderId);
    await get().fetchContents(currentFolderId);
  },

  renameFile: async (fileId, name) => {
    await fileService.updateFile(fileId, name);
    await get().refresh();
  },

  renameFolder: async (folderId, name) => {
    await folderService.renameFolder(folderId, name);
    await get().refresh();
  },

  deleteFile: async (fileId) => {
    await fileService.deleteFile(fileId);
    await get().refresh();
  },

  deleteFolder: async (folderId) => {
    await folderService.deleteFolder(folderId);
    await get().refresh();
  },

  moveFile: async (fileId, folderId) => {
    await fileService.moveFile(fileId, folderId);
    await get().refresh();
  },

  moveFolder: async (folderId, parentId) => {
    await folderService.moveFolder(folderId, parentId);
    await get().refresh();
  },

  toggleFavorite: async (fileId) => {
    const { file } = await fileService.toggleFavorite(fileId);
    set((state) => ({
      files: state.files.map((f) => (f.id === fileId ? { ...f, isFavorite: file.isFavorite } : f)),
    }));
  },

  refresh: async () => {
    const { currentFolderId } = get();
    await get().fetchContents(currentFolderId);
  },
}));
