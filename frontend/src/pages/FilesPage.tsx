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
  Star
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
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const getMimeTypeIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('video/')) return Video;
  if (mimeType.startsWith('audio/')) return Music;
  if (mimeType.includes('pdf') || mimeType.includes('document')) return FileText;
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('compressed')) return Archive;
  return FileIcon;
};

const getMimeTypeColor = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
  if (mimeType.startsWith('video/')) return 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20';
  if (mimeType.startsWith('audio/')) return 'text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/20';
  if (mimeType.includes('pdf') || mimeType.includes('document')) return 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20';
  if (mimeType.includes('zip') || mimeType.includes('rar')) return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
  return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20';
};

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 o';
  const k = 1024;
  const sizes = ['o', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

export default function FilesPage() {
  const { folderId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const searchQuery = searchParams.get('search');
  const { files, folders, loadContent, createFolder, deleteFile } = useFileStore();

  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbType[]>([]);
  const [searchResults, setSearchResults] = useState<File[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const uploadCancelledRef = useRef(false);

  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  const [showShareModal, setShowShareModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [shareLink, setShareLink] = useState('');
  const [sharePassword, setSharePassword] = useState('');
  const [shareExpiry, setShareExpiry] = useState('');
  const [shareMaxDownloads, setShareMaxDownloads] = useState('');

  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewFile, setPreviewFile] = useState<File | null>(null);

  useEffect(() => {
    if (searchQuery) {
      handleSearch(searchQuery);
    } else {
      loadContent(folderId);
      setSearchResults([]);
      if (folderId) {
        loadBreadcrumbs(folderId);
      } else {
        setBreadcrumbs([]);
      }
    }
  }, [folderId, searchQuery]);

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

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    await startUpload(Array.from(selectedFiles));
    e.target.value = ''; // Reset input
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    if (droppedFiles.length === 0) return;

    await startUpload(droppedFiles);
  };

  const startUpload = async (filesToUpload: globalThis.File[]) => {
    uploadCancelledRef.current = false;
    
    // Initialize uploading files state
    const initialFiles: UploadingFile[] = filesToUpload.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      file,
      progress: 0,
      status: 'pending' as const,
    }));

    setUploadingFiles(initialFiles);
    setShowUploadModal(true);

    // Upload files one by one
    for (let i = 0; i < initialFiles.length; i++) {
      if (uploadCancelledRef.current) break;

      const uploadingFile = initialFiles[i];

      // Set current file to uploading
      setUploadingFiles(prev => prev.map(f => 
        f.id === uploadingFile.id ? { ...f, status: 'uploading' as const } : f
      ));

      try {
        await fileService.uploadFile(
          uploadingFile.file,
          folderId,
          (progress) => {
            setUploadingFiles(prev => prev.map(f => 
              f.id === uploadingFile.id ? { ...f, progress } : f
            ));
          }
        );

        // Mark as success
        setUploadingFiles(prev => prev.map(f => 
          f.id === uploadingFile.id ? { ...f, status: 'success' as const, progress: 100 } : f
        ));
      } catch (error: any) {
        // Mark as error
        setUploadingFiles(prev => prev.map(f => 
          f.id === uploadingFile.id ? { 
            ...f, 
            status: 'error' as const, 
            error: error.response?.data?.error || 'Échec du téléversement'
          } : f
        ));
      }
    }

    // Reload content after all uploads
    await loadContent(folderId);
  };

  const handleCancelUpload = () => {
    uploadCancelledRef.current = true;
    setShowUploadModal(false);
    setUploadingFiles([]);
    toast.error('Téléversement annulé');
  };

  const handleCloseUploadModal = () => {
    setShowUploadModal(false);
    setUploadingFiles([]);
    
    const successCount = uploadingFiles.filter(f => f.status === 'success').length;
    const errorCount = uploadingFiles.filter(f => f.status === 'error').length;
    
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

  const handleToggleFavorite = async (fileId: string, currentStatus: boolean) => {
    try {
      await fileService.toggleFavorite(fileId);
      toast.success(currentStatus ? 'Retiré des favoris' : 'Ajouté aux favoris');
      // Recharger les fichiers pour mettre à jour l'état
      loadContent(folderId);
    } catch (error) {
      toast.error('Échec de la modification');
    }
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

  return (
    <div
      className="space-y-6 relative"
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {searchQuery ? `Recherche : "${searchQuery}"` : 'Mes fichiers'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {searchQuery
              ? `${displayFiles.length} résultat${displayFiles.length > 1 ? 's' : ''}`
              : `${folders.length} dossier${folders.length > 1 ? 's' : ''}, ${files.length} fichier${files.length > 1 ? 's' : ''}`
            }
          </p>
        </div>
        {!searchQuery && (
          <div className="flex space-x-3">
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
      {!searchQuery && folders.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wider">
            Dossiers
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {folders.map((folder: FolderType) => (
              <button
                key={folder.id}
                onClick={() => navigate(`/files/${folder.id}`)}
                className="group flex flex-col items-center p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md transition-all duration-200"
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
            ))}
          </div>
        </div>
      )}

      {/* Files */}
      {displayFiles.length > 0 && (
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
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Taille</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Modifié</th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {displayFiles.map((file) => {
                  const Icon = getMimeTypeIcon(file.mimeType);
                  const colorClass = getMimeTypeColor(file.mimeType);

                  return (
                    <tr key={file.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <button
                          onClick={() => { setPreviewFile(file); setShowPreviewModal(true); }}
                          className="flex items-center space-x-3 hover:opacity-80 transition-opacity group"
                        >
                          <div className={`p-2 rounded-lg ${colorClass}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                            {file.name}
                          </span>
                        </button>
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
                            className={`p-2 rounded-lg transition-all ${
                              file.isFavorite
                                ? 'text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20'
                                : 'text-gray-600 dark:text-gray-400 hover:text-yellow-500 hover:bg-gray-100 dark:hover:bg-gray-700'
                            }`}
                            title={file.isFavorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                          >
                            <Star className="w-4 h-4" fill={file.isFavorite ? 'currentColor' : 'none'} />
                          </button>
                          <button
                            onClick={() => { setPreviewFile(file); setShowPreviewModal(true); }}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                            title="Aperçu"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => { setSelectedFile(file); setShareLink(''); setSharePassword(''); setShareExpiry(''); setShareMaxDownloads(''); setShowShareModal(true); }}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                            title="Partager"
                          >
                            <Share2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => window.open(fileService.getDownloadUrl(file.id))}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                            title="Télécharger"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(file.id)}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                            title="Supprimer"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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
      {displayFiles.length === 0 && folders.length === 0 && !isSearching && (
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
        />
      )}

      <UploadModal
        isOpen={showUploadModal}
        files={uploadingFiles}
        onClose={handleCloseUploadModal}
        onCancel={handleCancelUpload}
      />
    </div>
  );
}
