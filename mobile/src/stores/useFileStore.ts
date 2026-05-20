import { create } from 'zustand';
import { FileItem, Folder, Breadcrumb } from '../types';
import { fileService } from '../services/fileService';
import { folderService } from '../services/folderService';

interface FileState {
  files: FileItem[];
  folders: Folder[];
  favorites: FileItem[];
  breadcrumbs: Breadcrumb[];
  currentFolderId: string | undefined;
  loading: boolean;
  error: string | null;

  fetchContents: (folderId?: string) => Promise<void>;
  fetchFavorites: () => Promise<void>;
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
  reset: () => void;
}

const initialState = {
  files: [] as FileItem[],
  folders: [] as Folder[],
  favorites: [] as FileItem[],
  breadcrumbs: [] as Breadcrumb[],
  currentFolderId: undefined as string | undefined,
  loading: false,
  error: null as string | null,
};

export const useFileStore = create<FileState>((set, get) => ({
  ...initialState,

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

  fetchFavorites: async () => {
    set({ loading: true, error: null });
    try {
      const { files } = await fileService.getFavoriteFiles();
      set({ favorites: files, loading: false });
    } catch {
      set({ error: 'Impossible de charger les favoris', loading: false });
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
    set((state) => {
      const updatedFiles = state.files.map((f) => (f.id === fileId ? { ...f, isFavorite: file.isFavorite } : f));
      let updatedFavorites = [...state.favorites];

      if (file.isFavorite) {
        const exists = updatedFavorites.some((f) => f.id === fileId);
        if (!exists) {
          const fileObj = state.files.find((f) => f.id === fileId) || file;
          updatedFavorites.push({ ...fileObj, isFavorite: true });
        }
      } else {
        updatedFavorites = updatedFavorites.filter((f) => f.id !== fileId);
      }

      return {
        files: updatedFiles,
        favorites: updatedFavorites,
      };
    });
  },

  refresh: async () => {
    const { currentFolderId } = get();
    await Promise.all([
      get().fetchContents(currentFolderId),
      get().fetchFavorites(),
    ]);
  },

  reset: () => set(initialState),
}));
