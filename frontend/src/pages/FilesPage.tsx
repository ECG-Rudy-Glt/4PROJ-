import { useEffect, useState, useRef, useCallback } from 'react';
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
  Pencil,
  AlertTriangle,
  FolderDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { fileService } from '@/services/fileService';
import { folderService } from '@/services/folderService';
import { shareService } from '@/services/shareService';
import { File, Folder as FolderType, Breadcrumb as BreadcrumbType } from '@/types';
import FilePreviewModal from '@/components/FilePreviewModal';
import Breadcrumb from '@/components/Breadcrumb';
import { NewFolderModal, ShareModal } from '@/components/FileModals';
import { useUploadStore } from '@/stores/useUploadStore';
import TagsManager from '@/components/TagsManager';
import TagSelector from '@/components/TagSelector';
import ShareFolderModal from '@/components/ShareFolderModal';
import { ShareFileModal } from '@/components/ShareFileModal';
import PendingSharesModal from '@/components/PendingSharesModal';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { formatBytes } from '@/utils/bytes';
import { getApiErrorMessage } from '@/utils/getApiErrorMessage';
import { FilterBar, FilterState } from '@/components/FilterBar';
import { useTranslation } from 'react-i18next';

const getMimeTypeIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('video/')) return Video;
  if (mimeType.startsWith('audio/')) return Music;
  if (mimeType.includes('spreadsheet') || mimeType.includes('sheet') || mimeType.includes('excel')) return FileText;
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint') || mimeType.includes('slide')) return FileText;
  if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('document') || mimeType.includes('text')) return FileText;
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('compressed')) return Archive;
  return FileIcon;
};

const getMimeTypeColor = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
  if (mimeType.startsWith('video/')) return 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20';
  if (mimeType.startsWith('audio/')) return 'text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/20';
  if (mimeType.includes('spreadsheet') || mimeType.includes('sheet') || mimeType.includes('excel')) return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint') || mimeType.includes('slide')) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
  if (mimeType.includes('pdf')) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
  if (mimeType.includes('word') || mimeType.includes('document') || mimeType.includes('text')) return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
  if (mimeType.includes('zip') || mimeType.includes('rar')) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20';
  return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20';
};

export default function FilesPage() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'fr' ? fr : enUS;
  
  const { folderId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const searchQuery = searchParams.get('search');
  const { files, folders, loadContent, createFolder, deleteFile, deleteFolder, sortBy, sortOrder, setSorting, setCurrentFolder } = useFileStore();

  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbType[]>([]);
  const [searchResults, setSearchResults] = useState<File[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { enqueueUpload } = useUploadStore();

  const [activeFilters, setActiveFilters] = useState<FilterState>({});
  const folderUploadInputRef = useRef<HTMLInputElement | null>(null);

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

  const [showPendingShares, setShowPendingShares] = useState(false);
  const [pendingSharesCount, setPendingSharesCount] = useState(0);
  const [acceptedSharedFiles, setAcceptedSharedFiles] = useState<any[]>([]);
  const [acceptedSharedFolders, setAcceptedSharedFolders] = useState<any[]>([]);

  const [renamingFileId, setRenamingFileId] = useState<string | null>(null);
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameExtension, setRenameExtension] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  const displayFiles = searchQuery ? searchResults : files;

  const getSharedItemsAsDisplayFiles = useCallback(async () => {
    try {
      const data = await shareService.getAcceptedShares();
      const sharedItems: any[] = [];
      const sharedFolders: any[] = [];

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
  }, []);

  const loadBreadcrumbs = useCallback(async (folderId: string) => {
    try {
      const { breadcrumbs } = await folderService.getBreadcrumbs(folderId);
      setBreadcrumbs(breadcrumbs);
    } catch (error) {
      console.error('Failed to load breadcrumbs', error);
    }
  }, []);

  const loadPendingSharesCount = useCallback(async () => {
    try {
      const data = await shareService.getPendingShares();
      const count = (data.files?.length || 0) + (data.folders?.length || 0);
      setPendingSharesCount(count);
    } catch (error) {
      console.error('Error loading pending shares count', error);
    }
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    setIsSearching(true);
    try {
      const result = await fileService.searchFiles(query);
      setSearchResults(result.files);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('files.error_search')));
    } finally {
      setIsSearching(false);
    }
  }, [t]);

  useEffect(() => {
    setCurrentFolder(folderId || null);
  }, [folderId, setCurrentFolder]);

  useEffect(() => {
    if (!folderId && !searchQuery) {
      getSharedItemsAsDisplayFiles().then(setAcceptedSharedFiles);
      loadPendingSharesCount();
    } else {
      setAcceptedSharedFiles([]);
      setAcceptedSharedFolders([]);
    }
  }, [folderId, searchQuery, getSharedItemsAsDisplayFiles, loadPendingSharesCount]);

  useEffect(() => {
    if (searchQuery) {
      handleSearch(searchQuery);
    } else {
      loadContent(folderId, sortBy, sortOrder, activeFilters);
      setSearchResults([]);
      if (folderId) {
        loadBreadcrumbs(folderId);
      } else {
        setBreadcrumbs([]);
      }
    }
  }, [folderId, searchQuery, activeFilters, sortBy, sortOrder, handleSearch, loadContent, loadBreadcrumbs]);

  useEffect(() => {
    const previewId = searchParams.get('preview');
    if (!previewId) return;

    const local = [...files, ...acceptedSharedFiles].find(f => f.id === previewId);
    if (local) {
      setPreviewFile(local);
      setShowPreviewModal(true);
      return;
    }

    fileService.getFile(previewId).then(({ file }) => {
      setPreviewFile(file);
      setShowPreviewModal(true);
    }).catch((error) => {
      toast.error(getApiErrorMessage(error, t('common.error_loading')));
    });
  }, [searchParams, files, acceptedSharedFiles, t]);



  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    enqueueUpload(Array.from(selectedFiles), folderId);
    e.target.value = '';
  };

  const handleFolderUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;
    enqueueUpload(Array.from(selectedFiles), folderId);
    e.target.value = '';
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await createFolder(newFolderName, folderId);
      toast.success(t('files.create_folder_success'));
      setShowNewFolderModal(false);
      setNewFolderName('');
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('common.error')));
    }
  };

  const handleDownloadFile = async (fileId: string, fileName: string) => {
    try {
      await fileService.triggerDownload(fileId, fileName);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('common.error')));
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm(t('trash.confirm_delete', { type: t('common.file') }))) return;
    try {
      await deleteFile(fileId);
      toast.success(t('trash.delete_success', { type: t('common.file') }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('common.error')));
    }
  };

  const handleDeleteFolder = async (folderId: string, folderName: string) => {
    if (!confirm(t('files.delete_folder_confirm', { name: folderName }))) return;
    try {
      await deleteFolder(folderId);
      toast.success(t('trash.delete_success', { type: t('common.folder') }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('common.error')));
    }
  };

  const handleRemoveSharedFolder = async (sharedFolderId: string, folderName: string) => {
    if (!confirm(t('files.stop_sharing_confirm', { name: folderName }))) return;
    try {
      await shareService.rejectSharedFolder(sharedFolderId);
      toast.success(t('files.stop_sharing_success'));
      getSharedItemsAsDisplayFiles().then(setAcceptedSharedFiles);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('common.error')));
    }
  };

  const handleToggleFavorite = async (fileId: string, currentStatus: boolean) => {
    try {
      await fileService.toggleFavorite(fileId);
      toast.success(currentStatus ? t('files.favorites_removed') : t('files.favorites_added'));
      loadContent(folderId, sortBy, sortOrder, activeFilters);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('common.error')));
    }
  };

  const handleSortChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    const [field, order] = value.split('-');
    setSorting(field as any, order as 'asc' | 'desc');
    loadContent(folderId, field as any, order as 'asc' | 'desc', activeFilters);
  };

  const handleFilterChange = (filters: FilterState) => {
    setActiveFilters(filters);
  };

  const handleClearFilters = () => {
    setActiveFilters({});
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
      toast.success(t('files.share_link_created'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('common.error')));
    }
  };

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    toast.success(t('files.copy_link_success'));
  };

  const startRenameFile = (file: File) => {
    setRenamingFileId(file.id);
    setRenamingFolderId(null);
    const lastDot = file.name.lastIndexOf('.');
    if (lastDot > 0) {
      setRenameValue(file.name.substring(0, lastDot));
      setRenameExtension(file.name.substring(lastDot));
    } else {
      setRenameValue(file.name);
      setRenameExtension('');
    }
    setTimeout(() => renameInputRef.current?.select(), 50);
  };

  const startRenameFolder = (folder: FolderType) => {
    setRenamingFolderId(folder.id);
    setRenamingFileId(null);
    setRenameValue(folder.name);
    setTimeout(() => renameInputRef.current?.select(), 50);
  };

  const cancelRename = () => {
    setRenamingFileId(null);
    setRenamingFolderId(null);
    setRenameValue('');
    setRenameExtension('');
  };

  const confirmRenameFile = async () => {
    if (!renamingFileId || !renameValue.trim()) return;
    try {
      await fileService.updateFile(renamingFileId, renameValue.trim() + renameExtension);
      toast.success(t('files.rename_success', { type: t('common.file') }));
      loadContent(folderId);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('files.rename_error')));
    } finally {
      cancelRename();
    }
  };

  const confirmRenameFolder = async () => {
    if (!renamingFolderId || !renameValue.trim()) return;
    try {
      await folderService.updateFolder(renamingFolderId, renameValue.trim());
      toast.success(t('files.rename_success', { type: t('common.folder') }));
      loadContent(folderId);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('files.rename_error')));
    } finally {
      cancelRename();
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent, type: 'file' | 'folder') => {
    if (e.key === 'Enter') {
      if (type === 'file') confirmRenameFile(); else confirmRenameFolder();
    } else if (e.key === 'Escape') {
      cancelRename();
    }
  };

  // --- Drag & Drop move ---
  const [draggedItem, setDraggedItem] = useState<{ id: string; type: 'file' | 'folder' } | null>(null);
  const [dropTargetFolderId, setDropTargetFolderId] = useState<string | null>(null);

  const handleItemDragStart = (id: string, type: 'file' | 'folder', e: React.DragEvent) => {
    e.dataTransfer.setData('application/supfile-item', JSON.stringify({ id, type }));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedItem({ id, type });
  };

  const handleFolderDragOver = (folderId: string, e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('application/supfile-item')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetFolderId(folderId);
  };

  const handleFolderDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropTargetFolderId(null);
    }
  };

  const handleFolderDrop = async (targetFolderId: string, e: React.DragEvent) => {
    e.preventDefault();
    setDropTargetFolderId(null);
    const raw = e.dataTransfer.getData('application/supfile-item');
    if (!raw) return;
    const item: { id: string; type: 'file' | 'folder' } = JSON.parse(raw);
    if (item.id === targetFolderId) return;
    try {
      if (item.type === 'file') {
        await fileService.moveFile(item.id, targetFolderId);
      } else {
        await folderService.moveFolder(item.id, targetFolderId);
      }
      toast.success(t('files.move_success'));
      loadContent(folderId);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('files.move_error')));
    } finally {
      setDraggedItem(null);
    }
  };

  return (
    <div className="relative pb-48">
      {!searchQuery && breadcrumbs.length > 0 && <Breadcrumb items={breadcrumbs} />}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {searchQuery ? t('files.search_results', { query: searchQuery }) : t('files.title')}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            {searchQuery
              ? `${displayFiles.length} ${displayFiles.length > 1 ? t('common.file_plural') : t('common.file')}`
              : `${folders.length + acceptedSharedFolders.length} ${ (folders.length + acceptedSharedFolders.length) > 1 ? t('common.folder_plural') : t('common.folder')} · ${files.length + acceptedSharedFiles.length} ${ (files.length + acceptedSharedFiles.length) > 1 ? t('common.file_plural') : t('common.file')}`
            }
          </p>
        </div>
        {!searchQuery && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowPendingShares(true)}
                className="relative flex items-center gap-2 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
                title={t('files.pending_shares_title')}
              >
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">{t('common.share')}</span>
                {pendingSharesCount > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-xs font-bold text-white bg-orange-500">
                    {pendingSharesCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setShowTagsManager(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
              >
                <TagIconLucide className="w-4 h-4" />
                <span className="hidden sm:inline">{t('common.tags')}</span>
              </button>
              <button
                onClick={() => setShowNewFolderModal(true)}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all"
              >
                <FolderPlus className="w-4 h-4" />
                <span className="hidden sm:inline">{t('files.new_folder')}</span>
              </button>
            </div>
            <div className="flex items-center gap-2 pl-2 border-l border-gray-200 dark:border-gray-700">
              <button
                onClick={() => folderUploadInputRef.current?.click()}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-all font-medium"
              >
                <Folder className="w-4 h-4" />
                <span className="hidden sm:inline">{t('files.upload_folder')}</span>
              </button>
              <label className="flex items-center gap-2 px-4 py-2 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 cursor-pointer transition-all font-medium">
                <Upload className="w-4 h-4" />
                {t('files.upload')}
                <input type="file" multiple onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
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

      {!searchQuery && (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
          <FilterBar onFilterChange={handleFilterChange} onClearFilters={handleClearFilters} />
          {files.length > 0 && (
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 shrink-0">
              <ArrowUpDown className="w-4 h-4 text-gray-400" />
              <label htmlFor="sort-select" className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap"> {t('common.sort_by')} : </label>
              <select
                id="sort-select"
                value={`${sortBy}-${sortOrder}`}
                onChange={handleSortChange}
                className="text-sm bg-transparent border-none text-gray-900 dark:text-white focus:ring-0 cursor-pointer"
              >
                <option value="name-asc">{t('files.sort.name_asc')}</option>
                <option value="name-desc">{t('files.sort.name_desc')}</option>
                <option value="createdAt-desc">{t('files.sort.date_desc')}</option>
                <option value="createdAt-asc">{t('files.sort.date_asc')}</option>
                <option value="size-desc">{t('files.sort.size_desc')}</option>
                <option value="size-asc">{t('files.sort.size_asc')}</option>
              </select>
            </div>
          )}
        </div>
      )}

      {isSearching && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span className="ml-3 text-gray-600 dark:text-gray-400">{t('files.searching')}</span>
        </div>
      )}

      {!searchQuery && (folders.length > 0 || acceptedSharedFolders.length > 0) && (
        <div className="mb-8">
          <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">{t('files.folders')}</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {[...folders, ...acceptedSharedFolders].map((folder: FolderType | any) => (
              <div
                key={folder.id}
                draggable={!folder._isShared && renamingFolderId !== folder.id}
                onDragStart={(e) => handleItemDragStart(folder.id, 'folder', e)}
                onDragOver={(e) => handleFolderDragOver(folder.id, e)}
                onDragLeave={handleFolderDragLeave}
                onDrop={(e) => void handleFolderDrop(folder.id, e)}
                className={`group relative flex flex-col items-center p-4 bg-white dark:bg-gray-800 border rounded-xl hover:shadow-md transition-all duration-200 ${
                  dropTargetFolderId === folder.id
                    ? 'border-primary-500 dark:border-primary-400 ring-2 ring-primary-300 dark:ring-primary-600 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600'
                } ${draggedItem?.id === folder.id ? 'opacity-50' : ''}`}
              >
                {renamingFolderId === folder.id ? (
                  <div className="flex flex-col items-center w-full">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-3">
                      <Folder className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => handleRenameKeyDown(e, 'folder')}
                      onBlur={confirmRenameFolder}
                      className="text-sm font-medium text-center border border-primary-400 dark:border-primary-500 rounded-lg px-2 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 w-full"
                      autoFocus
                    />
                  </div>
                ) : (
                  <button onClick={() => navigate(`/files/${folder.id}`)} className="flex flex-col items-center w-full">
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg mb-3 group-hover:scale-110 transition-transform duration-200">
                      <Folder className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-sm text-center text-gray-900 dark:text-white font-medium truncate w-full">{folder.name}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">{format(new Date(folder.updatedAt), 'dd MMM yyyy', { locale: dateLocale })}</span>
                  </button>
                )}
                {!folder._isShared && (
                  <div className="absolute top-2 right-2 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    <button onClick={(e) => { e.stopPropagation(); startRenameFolder(folder); }} className="p-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-primary-50 dark:hover:bg-gray-600 hover:border-primary-300 dark:hover:border-gray-500 transition-all" title={t('common.rename')}><Pencil className="w-3.5 h-3.5 text-primary-600 dark:text-white" /></button>
                    <button onClick={(e) => { e.stopPropagation(); setSelectedFolder(folder); setShowShareFolderModal(true); }} className="p-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-primary-50 dark:hover:bg-gray-600 hover:border-primary-300 dark:hover:border-gray-500 transition-all" title={t('common.share')}><Share2 className="w-3.5 h-3.5 text-primary-600 dark:text-white" /></button>
                    <button onClick={(e) => { e.stopPropagation(); void folderService.downloadFolderAsZip(folder.id, folder.name).catch((error) => toast.error(getApiErrorMessage(error, t('common.download_error')))); }} className="p-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-primary-50 dark:hover:bg-gray-600 hover:border-primary-300 dark:hover:border-gray-500 transition-all" title={t('common.download_zip')}><FolderDown className="w-3.5 h-3.5 text-primary-600 dark:text-white" /></button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteFolder(folder.id, folder.name); }} className="p-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/40 hover:border-red-300 dark:hover:border-red-800 transition-all" title={t('common.delete')}><Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-500" /></button>
                  </div>
                )}
                {folder._isShared && (
                  <button onClick={(e) => { e.stopPropagation(); handleRemoveSharedFolder(folder.id, folder.name); }} className="absolute top-2 right-2 p-1.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/40 transition-all" title={t('common.delete')}><Trash2 className="w-4 h-4 text-red-600 dark:text-red-500" /></button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {(displayFiles.length > 0 || acceptedSharedFiles.length > 0) && (
        <div>
          {!searchQuery && <h2 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-3">{t('files.files')}</h2>}
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700/50 [&>tr>th:first-child]:rounded-tl-xl [&>tr>th:last-child]:rounded-tr-xl">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">{t('common.name')}</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">{t('common.tags')}</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">{t('common.size')}</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">{t('common.modified')}</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {[...displayFiles, ...acceptedSharedFiles].map((file) => {
                  const Icon = getMimeTypeIcon(file.mimeType);
                  const colorClass = getMimeTypeColor(file.mimeType);
                  return (
                    <tr
                      key={file.id}
                      draggable={!(file as any)._isShared && renamingFileId !== file.id}
                      onDragStart={(e) => handleItemDragStart(file.id, 'file', e)}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${draggedItem?.id === file.id ? 'opacity-50' : ''}`}
                    >
                      <td className="px-6 py-4">
                        {renamingFileId === file.id ? (
                          <div className="flex items-center space-x-2">
                            <div className={`p-2 rounded-lg ${colorClass}`}><Icon className="w-5 h-5" /></div>
                            <input
                              ref={renameInputRef}
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              onKeyDown={(e) => handleRenameKeyDown(e, 'file')}
                              onBlur={confirmRenameFile}
                              className="text-sm font-medium px-2 py-1 border border-primary-400 rounded-lg"
                              autoFocus
                            />
                            {renameExtension && <span className="text-sm text-gray-400">{renameExtension}</span>}
                          </div>
                        ) : (
                          <button onClick={() => { setPreviewFile(file); setShowPreviewModal(true); }} className="flex items-center space-x-3 hover:opacity-80 transition-opacity">
                            <div className={`p-2 rounded-lg ${colorClass}`}><Icon className="w-5 h-5" /></div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">{file.name}</span>
                            {['.exe', '.msi', '.bat', '.sh', '.cmd', '.com', '.bin', '.app', '.run'].some(ext => file.name.toLowerCase().endsWith(ext)) && (
                              <span title={t('common.dangerous_file')}>
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                              </span>
                            )}
                          </button>
                        )}
                      </td>
                      <td className="px-6 py-4">{!(file as any)._isShared && <TagSelector file={file} onTagsChanged={() => loadContent(folderId)} />}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{formatBytes(Number(file.size))}</td>
                      <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{format(new Date(file.updatedAt), 'dd MMM yyyy', { locale: dateLocale })}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button onClick={() => handleToggleFavorite(file.id, file.isFavorite)} className={`p-2 rounded-lg ${file.isFavorite ? 'text-yellow-500' : 'text-gray-400'}`} title={file.isFavorite ? t('favorites.remove') : t('common.share')}><Star className="w-4 h-4" fill={file.isFavorite ? 'currentColor' : 'none'} /></button>
                          {!(file as any)._isShared && <button onClick={() => startRenameFile(file)} className="p-2 text-gray-400 hover:text-primary-600" title={t('common.rename')}><Pencil className="w-4 h-4" /></button>}
                          <button onClick={() => { setPreviewFile(file); setShowPreviewModal(true); }} className="p-2 text-gray-400 hover:text-primary-600" title={t('common.preview')}><Eye className="w-4 h-4" /></button>
                          <button onClick={() => handleDownloadFile(file.id, file.name)} className="p-2 text-gray-400 hover:text-primary-600" title={t('common.download')}><Download className="w-4 h-4" /></button>
                          {!(file as any)._isShared && <button onClick={() => handleDelete(file.id)} className="p-2 text-gray-400 hover:text-red-600" title={t('common.delete')}><Trash2 className="w-4 h-4" /></button>}
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

      {displayFiles.length === 0 && folders.length === 0 && acceptedSharedFolders.length === 0 && !isSearching && (
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
          <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
            {searchQuery ? <FileIcon className="w-12 h-12 text-gray-400" /> : <Folder className="w-12 h-12 text-gray-400" />}
          </div>
          <p className="text-lg font-medium text-gray-900 dark:text-white mb-1">{searchQuery ? t('files.no_results') : t('files.no_files')}</p>
          <p className="text-gray-600 dark:text-gray-400 text-center max-w-sm">{searchQuery ? t('files.no_results_desc') : t('files.no_files_desc')}</p>
        </div>
      )}

      <NewFolderModal isOpen={showNewFolderModal} folderName={newFolderName} onClose={() => setShowNewFolderModal(false)} onChange={setNewFolderName} onCreate={handleCreateFolder} />
      <ShareModal isOpen={showShareModal} file={selectedFile} shareLink={shareLink} password={sharePassword} expiry={shareExpiry} maxDownloads={shareMaxDownloads} onClose={() => setShowShareModal(false)} onPasswordChange={setSharePassword} onExpiryChange={setShareExpiry} onMaxDownloadsChange={setShareMaxDownloads} onCreateLink={handleCreateShareLink} onCopyLink={handleCopyShareLink} />
      {showPreviewModal && previewFile && <FilePreviewModal file={previewFile} onClose={() => setShowPreviewModal(false)} isShared={(previewFile as any)._isShared} />}
      <TagsManager isOpen={showTagsManager} onClose={() => setShowTagsManager(false)} />
      {selectedFolder && <ShareFolderModal folderId={selectedFolder.id} folderName={selectedFolder.name} isOpen={showShareFolderModal} onClose={() => { setShowShareFolderModal(false); setSelectedFolder(null); }} />}
      {selectedFile && showShareFileModal && <ShareFileModal file={selectedFile} onClose={() => { setShowShareFileModal(false); setSelectedFile(null); }} />}
      <PendingSharesModal isOpen={showPendingShares} onClose={() => setShowPendingShares(false)} onAccept={() => { if (!folderId) { loadContent(folderId); getSharedItemsAsDisplayFiles().then(setAcceptedSharedFiles); } loadPendingSharesCount(); }} />
    </div>
  );
}
