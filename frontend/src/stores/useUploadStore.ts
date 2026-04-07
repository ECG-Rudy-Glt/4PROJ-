import { create } from 'zustand';
import { fileService } from '@/services/fileService';
import { useFileStore } from './useFileStore';

export interface UploadingFile {
  id: string;
  file: globalThis.File;
  name: string;
  size: number;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

interface UploadState {
  isDragging: boolean;
  uploadingFiles: UploadingFile[];
  showUploadModal: boolean;
  setIsDragging: (isDragging: boolean) => void;
  setShowUploadModal: (show: boolean) => void;
  enqueueUpload: (files: globalThis.File[], folderId?: string | null) => void;
  cancelUpload: () => void;
  clearUploads: () => void;
}

export const useUploadStore = create<UploadState>((set, get) => {
  const activeControllers = new Map<string, AbortController>();
  let isProcessing = false;

  const processQueue = async (folderId?: string | null) => {
    if (isProcessing) return;
    isProcessing = true;

    const { uploadingFiles } = get();
    const pending = uploadingFiles.filter(f => f.status === 'pending');
    
    // Process in batches of 3
    const CONCURRENT = 3;
    for (let i = 0; i < pending.length; i += CONCURRENT) {
      const batch = pending.slice(i, i + CONCURRENT);
      await Promise.all(batch.map(file => uploadSingleFile(file, folderId)));
    }

    isProcessing = false;
    
    // Refresh file list if we are in the same folder
    const currentFileStoreFolder = useFileStore.getState().currentFolderId;
    if (currentFileStoreFolder === (folderId || null)) {
      useFileStore.getState().loadContent(folderId || undefined);
    }
  };

  const uploadSingleFile = async (uploadingFile: UploadingFile, folderId?: string | null) => {
    set(state => ({
      uploadingFiles: state.uploadingFiles.map(f => 
        f.id === uploadingFile.id ? { ...f, status: 'uploading' } : f
      )
    }));

    const controller = new AbortController();
    activeControllers.set(uploadingFile.id, controller);

    try {
      await fileService.uploadFile(
        uploadingFile.file,
        folderId || undefined,
        (progress) => {
          set(state => ({
            uploadingFiles: state.uploadingFiles.map(f => 
              f.id === uploadingFile.id ? { ...f, progress } : f
            )
          }));
        },
        controller.signal
      );

      set(state => ({
        uploadingFiles: state.uploadingFiles.map(f => 
          f.id === uploadingFile.id ? { ...f, status: 'success', progress: 100 } : f
        )
      }));
    } catch (error: any) {
      if (error.name === 'AbortError') return;
      set(state => ({
        uploadingFiles: state.uploadingFiles.map(f => 
          f.id === uploadingFile.id ? { ...f, status: 'error', error: error.message } : f
        )
      }));
    } finally {
      activeControllers.delete(uploadingFile.id);
    }
  };

  return {
    isDragging: false,
    uploadingFiles: [],
    showUploadModal: false,

    setIsDragging: (isDragging) => set({ isDragging }),
    setShowUploadModal: (showUploadModal) => set({ showUploadModal }),

    enqueueUpload: (files, folderId) => {
      const newUploads: UploadingFile[] = files.map(file => ({
        id: Math.random().toString(36).substring(7),
        file,
        name: file.name,
        size: file.size,
        progress: 0,
        status: 'pending'
      }));

      set(state => ({
        uploadingFiles: [...state.uploadingFiles, ...newUploads],
        showUploadModal: true
      }));

      processQueue(folderId);
    },

    cancelUpload: () => {
      activeControllers.forEach(c => c.abort());
      activeControllers.clear();
      set({ uploadingFiles: [], showUploadModal: false });
      isProcessing = false;
    },

    clearUploads: () => {
      set({ uploadingFiles: [], showUploadModal: false });
    }
  };
});
