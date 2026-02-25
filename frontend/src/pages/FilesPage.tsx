import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useFileStore } from '@/stores/useFileStore';
import {
  Upload,
  FolderPlus,
  Download,
  Trash2,
  Eye,
  Share2,
  Folder,
  File as FileIcon,
  Image,
  Video,
  Music,
  FileText,
  Archive,
  Star,
  ArrowUpDown,
  Tag as TagIconLucide,
  Edit3,
  FileSpreadsheet,
  Presentation
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fileService } from '@/services/fileService';
import { folderService } from '@/services/folderService';
import { shareService } from '@/services/shareService';
import { File, Folder as FolderType, Breadcrumb as BreadcrumbType } from '@/types';
import FilePreviewModal from '@/components/FilePreviewModal';
import Breadcrumb from '@/components/Breadcrumb';
import { NewFolderModal, ShareModal } from '@/components/FileModals';
import UploadModal, { UploadingFile } from '@/components/UploadModal';
import TagsManager from '@/components/TagsManager';
import TagSelector from '@/components/TagSelector';
import ShareFolderModal from '@/components/ShareFolderModal';
import { ShareFileModal } from '@/components/ShareFileModal';
import { DocumentEditor } from '@/components/DocumentEditor';
import PendingSharesModal from '@/components/PendingSharesModal';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAuthStore } from '@/stores/useAuthStore';

const getMimeTypeIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('video/')) return Video;
  if (mimeType.startsWith('audio/')) return Music;
  // Excel / Spreadsheets
  if (mimeType.includes('spreadsheet') || mimeType.includes('sheet') || mimeType.includes('excel')) return FileSpreadsheet;
  // PowerPoint / Presentations
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint') || mimeType.includes('slide')) return Presentation;
  // Word / Documents
  if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('document') || mimeType.includes('text')) return FileText;
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('compressed')) return Archive;
  return FileIcon;
};

const getMimeTypeColor = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
  if (mimeType.startsWith('video/')) return 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20';
  if (mimeType.startsWith('audio/')) return 'text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/20';
  // Excel - vert
  if (mimeType.includes('spreadsheet') || mimeType.includes('sheet') || mimeType.includes('excel')) return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
  // PowerPoint - rouge/orange
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint') || mimeType.includes('slide')) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
  // Word/PDF - bleu
  if (mimeType.includes('pdf')) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
  if (mimeType.includes('word') || mimeType.includes('document') || mimeType.includes('text')) return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
  if (mimeType.includes('zip') || mimeType.includes('rar')) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20';
  return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20';
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 o';
  const k = 1024;
  const sizes = ['o', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

const canEditDocument = (mimeType: string) => {
  const editableMimeTypes = [
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    'application/msword', // .doc
    'application/vnd.oasis.opendocument.text', // .odt
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
    'application/vnd.ms-excel', // .xls
    'application/vnd.oasis.opendocument.spreadsheet', // .ods
    'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
    'application/vnd.ms-powerpoint', // .ppt
    'application/vnd.oasis.opendocument.presentation', // .odp
    'text/plain', // .txt
  ];
  return editableMimeTypes.includes(mimeType);
};

import { FilterBar, FilterState } from '@/components/FilterBar';

// ... (existing imports)

export default function FilesPage() {
  const { folderId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const searchQuery = searchParams.get('search');
  const { files, folders, loadContent, createFolder, deleteFile, sortBy, sortOrder, setSorting } = useFileStore();
  const { user, loadUser } = useAuthStore();

  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbType[]>([]);
  const [searchResults, setSearchResults] = useState<File[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Filter state
  const [activeFilters, setActiveFilters] = useState<FilterState>({});


  // Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const uploadCancelledRef = useRef(false);
  const uploadingFilesRef = useRef<UploadingFile[]>([]);
  const isQueueProcessingRef = useRef(false);
  const activeUploadControllersRef = useRef<Map<string, AbortController>>(new Map());
  const folderUploadInputRef = useRef<HTMLInputElement | null>(null);
  const CONCURRENT_UPLOADS = 3;

  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [showShareModal, setShowShareModal] = useState(false);
  const [showShareFileModal, setShowShareFileModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [shareLink, setShareLink] = useState('');
  const [sharePassword, setSharePassword] = useState('');
  const [shareExpiry, setShareExpiry] = useState('');
  const [shareMaxDownloads, setShareMaxDownloads] = useState('');

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);

  const [showTagsManager, setShowTagsManager] = useState(false);

  const [showShareFolderModal, setShowShareFolderModal] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<FolderType | null>(null);

  const [showDocumentEditor, setShowDocumentEditor] = useState(false);
  const [editorFile, setEditorFile] = useState<File | null>(null);

  const [showPendingShares, setShowPendingShares] = useState(false);
  const [pendingSharesCount, setPendingSharesCount] = useState(0);
  const [acceptedSharedFiles, setAcceptedSharedFiles] = useState<any[]>([]);
  const [acceptedSharedFolders, setAcceptedSharedFolders] = useState<any[]>([]);

  const loadPendingSharesCount = async () => {
    try {
      const data = await shareService.getPendingShares();
      const count = (data.files?.length || 0) + (data.folders?.length || 0);
      setPendingSharesCount(count);
    } catch (error) {
      console.error('Error loading pending shares count', error);
    }
  };

  useEffect(() => {
    // Load accepted shared files in root directory only
    if (!folderId && !searchQuery) {
      const loadSharedFiles = async () => {
        const shared = await getSharedItemsAsDisplayFiles();
        setAcceptedSharedFiles(shared);
      };
      loadSharedFiles();
      loadPendingSharesCount();
    } else {
      setAcceptedSharedFiles([]);
    }
  }, [folderId, searchQuery]);

  useEffect(() => {
    if (searchQuery) {
      handleSearch(searchQuery);
    } else {
      // Pass activeFilters to loadContent
      loadContent(folderId, sortBy, sortOrder, activeFilters);
      setSearchResults([]);
      if (folderId) {
        loadBreadcrumbs(folderId);
      } else {
        setBreadcrumbs([]);
      }
    }
  }, [folderId, searchQuery, activeFilters]); // Add activeFilters dependency

  // Handle auto-preview from dashboard
  useEffect(() => {
    const previewId = searchParams.get('preview');
    if (previewId && files.length > 0) {
      const file = files.find(f => f.id === previewId);
      if (file) {
        setPreviewFile(file);
        setShowPreviewModal(true);
        // Clean up the URL
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('preview');
        navigate({ search: newParams.toString() }, { replace: true });
      }
    }
  }, [files, searchParams, navigate]);

  useEffect(() => {
    uploadingFilesRef.current = uploadingFiles;
  }, [uploadingFiles]);

  useEffect(() => {
    return () => {
      activeUploadControllersRef.current.forEach((controller) => controller.abort());
      activeUploadControllersRef.current.clear();
    };
  }, []);


  const loadBreadcrumbs = async (folderId: string) => {
    try {
      const { breadcrumbs } = await folderService.getBreadcrumbs(folderId);
      setBreadcrumbs(breadcrumbs);
    } catch (error) {
      console.error('Failed to load breadcrumbs', error);
    }
  };

  const handleSearch = async (query: string) => {
    setIsSearching(true);
    try {
      const result = await fileService.searchFiles(query);
      setSearchResults(result.files);
    } catch (error) {
      toast.error('Échec de la recherche');
    } finally {
      setIsSearching(false);
    }
  };

  const collectFilesFromEntry = async (entry: any): Promise<globalThis.File[]> => {
    if (!entry) return [];

    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file(
          (file: globalThis.File) => resolve([file]),
          () => resolve([])
        );
      });
    }

    if (entry.isDirectory) {
      const reader = entry.createReader();
      const entries: any[] = [];

      while (true) {
        const batch = await new Promise<any[]>((resolve) => {
          reader.readEntries(resolve, () => resolve([]));
        });

        if (batch.length === 0) {
          break;
        }
        entries.push(...batch);
      }

      const nestedFiles = await Promise.all(entries.map((child) => collectFilesFromEntry(child)));
      return nestedFiles.flat();
    }

    return [];
  };

  const extractDroppedFiles = async (e: React.DragEvent): Promise<globalThis.File[]> => {
    const items = Array.from(e.dataTransfer.items || []);
    if (items.length === 0) {
      return Array.from(e.dataTransfer.files || []);
    }

    const groupedFiles = await Promise.all(
      items.map(async (item) => {
        const withEntry = item as DataTransferItem & {
          webkitGetAsEntry?: () => any;
        };
        const entry = withEntry.webkitGetAsEntry ? withEntry.webkitGetAsEntry() : null;

        if (entry) {
          return await collectFilesFromEntry(entry);
        }

        const file = item.getAsFile();
        return file ? [file] : [];
      })
    );

    const flattened = groupedFiles.flat();
    if (flattened.length > 0) {
      return flattened;
    }

    return Array.from(e.dataTransfer.files || []);
  };

  const uploadSingleFile = async (uploadingFile: UploadingFile): Promise<void> => {
    if (uploadCancelledRef.current || uploadingFile.status !== 'pending') {
      return;
    }

    setUploadingFiles((prev) => {
      const next = prev.map((file) =>
        file.id === uploadingFile.id
          ? { ...file, status: 'uploading' as const, error: undefined }
          : file
      );
      uploadingFilesRef.current = next;
      return next;
    });

    const controller = new AbortController();
    activeUploadControllersRef.current.set(uploadingFile.id, controller);

    try {
      await fileService.uploadFile(
        uploadingFile.file,
        folderId,
        (progress) => {
          setUploadingFiles((prev) => {
            const next = prev.map((file) =>
              file.id === uploadingFile.id ? { ...file, progress } : file
            );
            uploadingFilesRef.current = next;
            return next;
          });
        },
        controller.signal
      );

      setUploadingFiles((prev) => {
        const next = prev.map((file) =>
          file.id === uploadingFile.id
            ? { ...file, status: 'success' as const, progress: 100 }
            : file
        );
        uploadingFilesRef.current = next;
        return next;
      });
    } catch (error: any) {
      const cancelled = error?.code === 'ERR_CANCELED';
      const errorMessage = cancelled
        ? 'Téléversement annulé'
        : error.response?.data?.code === 'QUOTA_EXCEEDED'
          ? 'Quota dépassé - espace insuffisant'
          : error.response?.data?.error || error.response?.data?.message || 'Échec du téléversement';

      setUploadingFiles((prev) => {
        const next = prev.map((file) =>
          file.id === uploadingFile.id
            ? {
              ...file,
              status: 'error' as const,
              error: errorMessage,
            }
            : file
        );
        uploadingFilesRef.current = next;
        return next;
      });
    } finally {
      activeUploadControllersRef.current.delete(uploadingFile.id);
    }
  };

  const processUploadQueue = async () => {
    if (isQueueProcessingRef.current) {
      return;
    }

    isQueueProcessingRef.current = true;
    uploadCancelledRef.current = false;

    try {
      while (!uploadCancelledRef.current) {
        const snapshot = uploadingFilesRef.current;
        const uploadingCount = snapshot.filter((file) => file.status === 'uploading').length;
        const pendingFiles = snapshot.filter((file) => file.status === 'pending');

        if (pendingFiles.length === 0) {
          if (uploadingCount === 0) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
          continue;
        }

        const availableSlots = Math.max(0, CONCURRENT_UPLOADS - uploadingCount);
        if (availableSlots === 0) {
          await new Promise((resolve) => setTimeout(resolve, 100));
          continue;
        }

        const nextBatch = pendingFiles.slice(0, availableSlots);
        await Promise.all(nextBatch.map((file) => uploadSingleFile(file)));
      }
    } finally {
      isQueueProcessingRef.current = false;
    }

    if (uploadCancelledRef.current) {
      return;
    }

    const hasPendingAfterLoop = uploadingFilesRef.current.some((file) => file.status === 'pending');
    if (hasPendingAfterLoop) {
      void processUploadQueue();
      return;
    }

    await loadContent(folderId, sortBy, sortOrder, activeFilters);
    await loadUser();
  };

  const enqueueUpload = (filesToUpload: globalThis.File[]) => {
    if (filesToUpload.length === 0) {
      return;
    }

    const quotaUsed = user?.quotaUsed || 0;
    const quotaLimit = user?.quotaLimit || 0;
    const reservedBytes = uploadingFilesRef.current
      .filter((file) => file.status === 'pending' || file.status === 'uploading')
      .reduce((sum, file) => sum + file.file.size, 0);

    let runningQuotaUsed = quotaUsed + reservedBytes;
    const queuedFiles: UploadingFile[] = filesToUpload.map((file, index) => {
      const wouldExceedQuota = quotaLimit > 0 && (runningQuotaUsed + file.size) > quotaLimit;

      if (!wouldExceedQuota) {
        runningQuotaUsed += file.size;
      }

      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}-${index}`,
        file,
        progress: 0,
        status: wouldExceedQuota ? 'error' as const : 'pending' as const,
        error: wouldExceedQuota ? 'Quota dépassé - espace insuffisant' : undefined,
      };
    });

    const pendingCount = queuedFiles.filter((file) => file.status === 'pending').length;
    if (pendingCount === 0) {
      toast.error('Aucun fichier ne peut être téléversé - quota dépassé');
      setShowUploadModal(true);
      setUploadingFiles((prev) => {
        const next = [...prev, ...queuedFiles];
        uploadingFilesRef.current = next;
        return next;
      });
      return;
    }

    setShowUploadModal(true);
    setUploadingFiles((prev) => {
      const next = [...prev, ...queuedFiles];
      uploadingFilesRef.current = next;
      return next;
    });

    void processUploadQueue();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    enqueueUpload(Array.from(selectedFiles));
    e.target.value = '';
  };

  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    enqueueUpload(Array.from(selectedFiles));
    e.target.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = await extractDroppedFiles(e);
    if (droppedFiles.length === 0) return;

    enqueueUpload(droppedFiles);
  };

  const handleCancelUpload = () => {
    uploadCancelledRef.current = true;
    activeUploadControllersRef.current.forEach((controller) => controller.abort());
    activeUploadControllersRef.current.clear();
    isQueueProcessingRef.current = false;
    setShowUploadModal(false);
    setUploadingFiles([]);
    uploadingFilesRef.current = [];
    toast.error('Téléversement annulé');
  };

  const handleCloseUploadModal = () => {
    setShowUploadModal(false);
    setUploadingFiles([]);
    uploadingFilesRef.current = [];

    const successCount = uploadingFiles.filter((file) => file.status === 'success').length;
    const errorCount = uploadingFiles.filter((file) => file.status === 'error').length;

    if (successCount > 0) {
      toast.success(`${successCount} fichier${successCount > 1 ? 's' : ''} téléversé${successCount > 1 ? 's' : ''}`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} fichier${errorCount > 1 ? 's' : ''} en erreur`);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      await createFolder(newFolderName, folderId);
      toast.success('Dossier créé');
      setShowNewFolderModal(false);
      setNewFolderName('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Échec de la création du dossier');
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm('Déplacer vers la corbeille ?')) return;

    try {
      await deleteFile(fileId);
      toast.success('Déplacé vers la corbeille');
    } catch (error) {
      toast.error('Échec de la suppression');
    }
  };

  const handleRemoveSharedFile = async (sharedFileId: string, fileName: string) => {
    if (!confirm(`Arrêter de partager "${fileName}" ?`)) return;

    try {
      await shareService.rejectSharedFile(sharedFileId);
      toast.success('Partage supprimé');
      // Reload accepted shares
      const shared = await getSharedItemsAsDisplayFiles();
      setAcceptedSharedFiles(shared);
    } catch (error) {
      toast.error('Échec de la suppression du partage');
    }
  };

  const handleRemoveSharedFolder = async (sharedFolderId: string, folderName: string) => {
    if (!confirm(`Arrêter de partager "${folderName}" ?`)) return;

    try {
      await shareService.rejectSharedFolder(sharedFolderId);
      toast.success('Partage supprimé');
      // Reload accepted shares
      const shared = await getSharedItemsAsDisplayFiles();
      setAcceptedSharedFolders(shared.filter(f => f._isShared));
    } catch (error) {
      toast.error('Échec de la suppression du partage');
    }
  };

  const handleToggleFavorite = async (fileId: string, currentStatus: boolean) => {
    try {
      await fileService.toggleFavorite(fileId);
      toast.success(currentStatus ? 'Retiré des favoris' : 'Ajouté aux favoris');
      // Recharger les fichiers pour mettre à jour l'état
      loadContent(folderId, sortBy, sortOrder, activeFilters);
    } catch (error) {
      toast.error('Échec de la modification');
    }
  };

  const handleSortChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    let newSortBy = sortBy;
    let newSortOrder: 'asc' | 'desc' = sortOrder;

    switch (value) {
      case 'name-asc':
        newSortBy = 'name';
        newSortOrder = 'asc';
        break;
      case 'name-desc':
        newSortBy = 'name';
        newSortOrder = 'desc';
        break;
      case 'date-asc':
        newSortBy = 'createdAt';
        newSortOrder = 'asc';
        break;
      case 'date-desc':
        newSortBy = 'createdAt';
        newSortOrder = 'desc';
        break;
      case 'size-asc':
        newSortBy = 'size';
        newSortOrder = 'asc';
        break;
      case 'size-desc':
        newSortBy = 'size';
        newSortOrder = 'desc';
        break;
    }

    setSorting(newSortBy, newSortOrder);
    await loadContent(folderId, newSortBy, newSortOrder, activeFilters);
  };

  const handleCreateShareLink = async () => {
    if (!selectedFile) return;

    try {
      const options: any = {};
      if (sharePassword) options.password = sharePassword;
      if (shareExpiry) options.expiresAt = new Date(shareExpiry).toISOString();
      if (shareMaxDownloads) options.maxDownloads = parseInt(shareMaxDownloads);

      const result = await shareService.createShareLink(selectedFile.id, options);
      setShareLink(result.shareLink.url);
      toast.success('Lien de partage créé !');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Échec de la création du lien de partage');
    }
  };

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    toast.success('Lien copié dans le presse-papiers !');
  };

  const displayFiles = searchQuery ? searchResults : files;

  // Format shared accepted files and folders to merge with regular files for display
  const getSharedItemsAsDisplayFiles = async () => {
    try {
      const data = await shareService.getAcceptedShares();
      const sharedItems: any[] = [];
      const sharedFolders: any[] = [];

      // Add shared folders
      if (data.folders && data.folders.length > 0) {
        sharedFolders.push(
          ...data.folders.map((sf: any) => ({
            id: sf.folder.id,
            name: sf.folder.name,
            parentId: sf.folder.parentId,
            createdAt: sf.folder.createdAt,
            updatedAt: sf.folder.createdAt,
            userId: sf.folder.userId,
            _isShared: true,
            _sharedBy: sf.sharedBy,
            _canWrite: sf.canWrite,
            _canDelete: sf.canDelete,
            _canShare: sf.canShare,
          }))
        );
        setAcceptedSharedFolders(sharedFolders);
      } else {
        setAcceptedSharedFolders([]);
      }

      // Add shared files
      if (data.files) {
        sharedItems.push(
          ...data.files.map((sf: any) => ({
            id: sf.file.id,
            name: sf.file.name,
            mimeType: sf.file.mimeType,
            size: sf.file.size,
            createdAt: sf.file.createdAt,
            updatedAt: sf.file.createdAt,
            userId: sf.file.user.id,
            folderId: null,
            isDeleted: false,
            isFavorite: false,
            tags: sf.file.tags || [],
            _isShared: true,
            _sharedBy: sf.sharedBy,
            _canWrite: sf.canWrite,
            _canDelete: sf.canDelete,
          }))
        );
      }

      return sharedItems;
    } catch (error) {
      console.error('Error loading shared items', error);
      return [];
    }
  };


  const handleFilterChange = (filters: FilterState) => {
    setActiveFilters(filters);
    // loadContent will be triggered by useEffect
  };

  const handleClearFilters = () => {
    setActiveFilters({});
  };

  // ... (existing JSX)



  return (
    <div
      className="relative"
      onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
      onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
      onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); if (e.currentTarget === e.target) setIsDragging(false); }}
      onDrop={handleDrop}
    >
      {/* Drag Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-primary-600 bg-opacity-90 flex items-center justify-center pointer-events-none">
          <div className="text-center text-white">
            <Upload className="w-20 h-20 mx-auto mb-4 animate-bounce" />
            <p className="text-2xl font-bold">Déposez vos fichiers</p>
            <p className="text-lg mt-2">Relâchez pour téléverser</p>
          </div>
        </div>
      )}

      {/* Breadcrumb */}
      {!searchQuery && breadcrumbs.length > 0 && <Breadcrumb items={breadcrumbs} />}

      {/* Header with Sort */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {searchQuery ? `Recherche : "${searchQuery}"` : 'Mes fichiers'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {searchQuery
              ? `${displayFiles.length} résultat${displayFiles.length > 1 ? 's' : ''}`
              : `${folders.length + acceptedSharedFolders.length} dossier${(folders.length + acceptedSharedFolders.length) > 1 ? 's' : ''}, ${files.length + acceptedSharedFiles.length} fichier${(files.length + acceptedSharedFiles.length) > 1 ? 's' : ''}`
            }
          </p>
        </div>
        {!searchQuery && (
          <div className="flex space-x-3">
            <button
              onClick={() => setShowPendingShares(true)}
              className="relative flex items-center px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-all"
              title="Voir les partages en attente"
            >
              <Share2 className="w-5 h-5 mr-2" />
              Partages en attente
              {pendingSharesCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold text-white bg-orange-500 dark:bg-orange-600">
                  {pendingSharesCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setShowTagsManager(true)}
              className="flex items-center px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-all"
              title="Gérer les tags"
            >
              <TagIconLucide className="w-5 h-5 mr-2" />
              Tags
            </button>
            <button
              onClick={() => setShowNewFolderModal(true)}
              className="flex items-center px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-all"
            >
              <FolderPlus className="w-5 h-5 mr-2" />
              Nouveau dossier
            </button>
            <label className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 cursor-pointer transition-all">
              <Upload className="w-5 h-5 mr-2" />
              Téléverser
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <button
              onClick={() => folderUploadInputRef.current?.click()}
              className="flex items-center px-4 py-2 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-700 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-all"
            >
              <Folder className="w-5 h-5 mr-2" />
              Téléverser dossier
            </button>
            <input
              ref={folderUploadInputRef}
              type="file"
              multiple
              onChange={handleFolderUpload}
              className="hidden"
              {...({ webkitdirectory: '', directory: '' } as any)}
            />
          </div>
        )}
      </div>

      {/* Sort Dropdown - Only show when not searching and have files */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
        {!searchQuery && (
          <FilterBar onFilterChange={handleFilterChange} onClearFilters={handleClearFilters} />
        )}

        {!searchQuery && files.length > 0 && (
          <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2 ml-auto">
            <ArrowUpDown className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <label htmlFor="sort-select" className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Trier par :
            </label>
            <select
              id="sort-select"
              value={`${sortBy === 'name' ? 'name' : sortBy === 'size' ? 'size' : 'date'}-${sortOrder}`}
              onChange={handleSortChange}
              className="text-sm bg-transparent border-none text-gray-900 dark:text-white focus:ring-0 cursor-pointer"
            >
              <option value="name-asc">Nom (A-Z)</option>
              <option value="name-desc">Nom (Z-A)</option>
              <option value="date-desc">Plus récents</option>
              <option value="date-asc">Plus anciens</option>
              <option value="size-desc">Plus volumineux</option>
              <option value="size-asc">Plus petits</option>
            </select>
          </div>
        )}
      </div>

      {isSearching && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">Recherche en cours...</span>
        </div>
      )}

      {/* Folders */}
      {!searchQuery && (folders.length > 0 || acceptedSharedFolders.length > 0) && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
            Dossiers
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[...folders, ...acceptedSharedFolders].map((folder: FolderType | any) => (
              <div
                key={folder.id}
                className="group relative flex flex-col items-center p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md transition-all duration-200"
              >
                <button
                  onClick={() => navigate(`/files/${folder.id}`)}
                  className="flex flex-col items-center w-full"
                >
                  <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-3 group-hover:scale-110 transition-transform duration-200">
                    <Folder className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-sm text-center text-gray-900 dark:text-white font-medium truncate w-full">
                    {folder.name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {format(new Date(folder.updatedAt), 'dd MMM yyyy', { locale: fr })}
                  </span>
                </button>
                {!folder._isShared && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFolder(folder);
                      setShowShareFolderModal(true);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:border-primary-300 dark:hover:border-primary-600 transition-all"
                    title="Partager ce dossier"
                  >
                    <Share2 className="w-4 h-4 text-primary-600 dark:text-primary-300" />
                  </button>
                )}
                {folder._isShared && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveSharedFolder(folder.id, folder.name);
                    }}
                    className="absolute top-2 right-2 p-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-600 transition-all"
                    title="Arrêter de partager"
                  >
                    <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                  </button>
                )}
                {folder._isShared && folder._sharedBy && (
                  <div className="absolute top-2 right-2 flex items-center space-x-1">
                    {folder._sharedBy?.avatar ? (
                      <img
                        src={folder._sharedBy.avatar}
                        alt={folder._sharedBy.firstName}
                        className="w-6 h-6 rounded-full"
                        title={`Partagé par ${folder._sharedBy.firstName} ${folder._sharedBy.lastName}`}
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-xs font-bold text-primary-600 dark:text-primary-300">
                        {(folder._sharedBy?.firstName?.[0] || 'U').toUpperCase()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Files */}
      {(displayFiles.length > 0 || acceptedSharedFiles.length > 0) && (
        <div>
          {!searchQuery && folders.length > 0 && (
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
              Fichiers
            </h2>
          )}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Nom</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Tags</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Taille</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Modifié</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {[...displayFiles, ...acceptedSharedFiles].map((file) => {
                  const Icon = getMimeTypeIcon(file.mimeType);
                  const colorClass = getMimeTypeColor(file.mimeType);

                  return (
                    <tr key={file.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <button
                          onClick={() => {
                            const enrichedFile = {
                              ...file,
                              // Copy shared folder permissions to file if they exist
                              ...(file as any)._sharedFolderPermissions && {
                                canWrite: (file as any)._sharedFolderPermissions.canWrite,
                                canDelete: (file as any)._sharedFolderPermissions.canDelete,
                                canShare: (file as any)._sharedFolderPermissions.canShare,
                              }
                            };
                            setPreviewFile(enrichedFile);
                            setShowPreviewModal(true);
                          }}
                          className="flex items-center space-x-3 hover:opacity-80 transition-opacity group"
                        >
                          <div className={`p-2 rounded-lg ${colorClass}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                              {file.name}
                            </span>
                            {(file as any)._isShared && (file as any)._sharedBy && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                Partagé par {(file as any)._sharedBy.firstName} {(file as any)._sharedBy.lastName}
                              </span>
                            )}
                          </div>
                          {(file as any)._isShared && (
                            <div className="ml-auto flex-shrink-0">
                              {(file as any)._sharedBy?.avatar ? (
                                <img
                                  src={(file as any)._sharedBy.avatar}
                                  alt={(file as any)._sharedBy.firstName}
                                  className="w-6 h-6 rounded-full"
                                  title={`Partagé par ${(file as any)._sharedBy.firstName} ${(file as any)._sharedBy.lastName}`}
                                />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-xs font-bold text-primary-600 dark:text-primary-300">
                                  {((file as any)._sharedBy?.firstName?.[0] || 'U').toUpperCase()}
                                </div>
                              )}
                            </div>
                          )}
                        </button>
                      </td>
                      <td className="px-6 py-4">
                        {!(file as any)._isShared && <TagSelector file={file} onTagsChanged={() => loadContent(folderId)} />}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {formatBytes(Number(file.size))}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                        {format(new Date(file.updatedAt), 'dd MMM yyyy', { locale: fr })}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleToggleFavorite(file.id, file.isFavorite)}
                            className={`p-2 rounded-lg transition-all ${file.isFavorite
                              ? 'text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                              : 'text-gray-600 dark:text-gray-400 hover:text-yellow-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                              }`}
                            title={file.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                          >
                            <Star className="w-4 h-4" fill={file.isFavorite ? 'currentColor' : 'none'} />
                          </button>
                          {canEditDocument(file.mimeType) && !(file as any)._isShared && (
                            <button
                              onClick={() => { setEditorFile(file); setShowDocumentEditor(true); }}
                              className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                              title="Éditer le document"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              const enrichedFile = {
                                ...file,
                                // Copy shared folder permissions to file if they exist
                                ...(file as any)._sharedFolderPermissions && {
                                  canWrite: (file as any)._sharedFolderPermissions.canWrite,
                                  canDelete: (file as any)._sharedFolderPermissions.canDelete,
                                  canShare: (file as any)._sharedFolderPermissions.canShare,
                                }
                              };
                              setPreviewFile(enrichedFile);
                              setShowPreviewModal(true);
                            }}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                            title="Aperçu"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {!(file as any)._isShared && (
                            <button
                              onClick={() => { setSelectedFile(file); setShowShareFileModal(true); }}
                              className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                              title="Partager avec des utilisateurs"
                            >
                              <Share2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => window.open(fileService.getDownloadUrl(file.id))}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                            title="Télécharger"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {!(file as any)._isShared && (
                            <button
                              onClick={() => handleDelete(file.id)}
                              className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                              title="Supprimer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          {(file as any)._isShared && (
                            <button
                              onClick={() => handleRemoveSharedFile(file.id, file.name)}
                              className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                              title="Arrêter de partager"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty State */}
      {displayFiles.length === 0 && folders.length === 0 && acceptedSharedFolders.length === 0 && !isSearching && (
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
            {searchQuery ? <FileIcon className="w-12 h-12 text-gray-400" /> : <Folder className="w-12 h-12 text-gray-400" />}
          </div>
          <p className="text-lg font-medium text-gray-900 dark:text-white mb-1">
            {searchQuery ? 'Aucun résultat' : 'Aucun fichier'}
          </p>
          <p className="text-gray-600 dark:text-gray-400 text-center max-w-sm">
            {searchQuery ? 'Aucun fichier ne correspond à votre recherche' : 'Commencez par téléverser des fichiers ou créer un dossier'}
          </p>
        </div>
      )}

      {/* Modals */}
      <NewFolderModal
        isOpen={showNewFolderModal}
        folderName={newFolderName}
        onClose={() => { setShowNewFolderModal(false); setNewFolderName(''); }}
        onChange={setNewFolderName}
        onCreate={handleCreateFolder}
      />

      <ShareModal
        isOpen={showShareModal}
        file={selectedFile}
        shareLink={shareLink}
        password={sharePassword}
        expiry={shareExpiry}
        maxDownloads={shareMaxDownloads}
        onClose={() => setShowShareModal(false)}
        onPasswordChange={setSharePassword}
        onExpiryChange={setShareExpiry}
        onMaxDownloadsChange={setShareMaxDownloads}
        onCreateLink={handleCreateShareLink}
        onCopyLink={handleCopyShareLink}
      />

      {showPreviewModal && previewFile && (
        <FilePreviewModal
          file={previewFile}
          onClose={() => setShowPreviewModal(false)}
          isShared={(previewFile as any)._sharedFolderPermissions !== undefined}
        />
      )}

      <UploadModal
        isOpen={showUploadModal}
        files={uploadingFiles}
        onClose={handleCloseUploadModal}
        onCancel={handleCancelUpload}
      />

      <TagsManager
        isOpen={showTagsManager}
        onClose={() => setShowTagsManager(false)}
      />

      {selectedFolder && (
        <ShareFolderModal
          folderId={selectedFolder.id}
          folderName={selectedFolder.name}
          isOpen={showShareFolderModal}
          onClose={() => {
            setShowShareFolderModal(false);
            setSelectedFolder(null);
          }}
        />
      )}

      {selectedFile && showShareFileModal && (
        <ShareFileModal
          file={selectedFile}
          onClose={() => {
            setShowShareFileModal(false);
            setSelectedFile(null);
          }}
        />
      )}

      {showDocumentEditor && editorFile && (
        <DocumentEditor
          file={editorFile}
          onClose={() => {
            setShowDocumentEditor(false);
            setEditorFile(null);
            // Recharger le contenu pour voir les éventuelles modifications
            loadContent(folderId);
          }}
        />
      )}

      <PendingSharesModal
        isOpen={showPendingShares}
        onClose={() => setShowPendingShares(false)}
        onAccept={() => {
          // Recharger le contenu pour afficher les dossiers/fichiers acceptés
          if (!folderId) {
            loadContent(folderId);
            getSharedItemsAsDisplayFiles();
          }
          // Recharger le nombre de partages en attente
          loadPendingSharesCount();
        }}
      />
    </div>
  );
}
