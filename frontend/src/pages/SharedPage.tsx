import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { shareService } from '@/services/shareService';
import { fileService } from '@/services/fileService';
import { SharedLink, SharedFolder, File } from '@/types';
import {
  Link2,
  Trash2,
  Users,
  Copy,
  ExternalLink,
  Download,
  Lock,
  Unlock,
  Eye,
  FileText,
  FileSpreadsheet,
  Presentation,
  Image,
  Video,
  Music,
  Archive,
  File as FileIcon,
  Folder,
  Clock,
  Shield,
  Share2,
  FolderOpen
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import FilePreviewModal from '@/components/FilePreviewModal';

const getMimeTypeIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('video/')) return Video;
  if (mimeType.startsWith('audio/')) return Music;
  if (mimeType.includes('spreadsheet') || mimeType.includes('sheet') || mimeType.includes('excel')) return FileSpreadsheet;
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint') || mimeType.includes('slide')) return Presentation;
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

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 o';
  const k = 1024;
  const sizes = ['o', 'Ko', 'Mo', 'Go'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

type TabType = 'shared-with-me' | 'my-shares';

export default function SharedPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('shared-with-me');
  const [shareLinks, setShareLinks] = useState<SharedLink[]>([]);
  const [sharedFolders, setSharedFolders] = useState<SharedFolder[]>([]);
  const [sharedFiles, setSharedFiles] = useState<File[]>([]);
  // Fichiers et dossiers partagés PAR l'utilisateur
  const [sharedByMeFolders, setSharedByMeFolders] = useState<SharedFolder[]>([]);
  const [sharedByMeFiles, setSharedByMeFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  useEffect(() => {
    loadShared();
  }, []);

  const loadShared = async () => {
    setIsLoading(true);
    try {
      const [linksData, foldersData, filesData, sharedByMeFoldersData, sharedByMeFilesData] = await Promise.all([
        shareService.listShareLinks(),
        shareService.listSharedWithMe(),
        shareService.listFilesSharedWithMe().catch(() => ({ sharedFiles: [] })),
        shareService.listSharedByMe().catch(() => ({ sharedFolders: [] })),
        shareService.listFilesSharedByMe().catch(() => ({ sharedFiles: [] })),
      ]);
      setShareLinks(linksData.shareLinks || []);
      setSharedFolders(foldersData.sharedFolders || []);
      // Extraire les fichiers des partages
      const files = (filesData.sharedFiles || []).map((sf: any) => ({
        ...sf.file,
        sharedBy: sf.sharedBy,
        canRead: sf.canRead,
        canWrite: sf.canWrite,
        canDelete: sf.canDelete,
        canShare: sf.canShare,
      })).filter((f: any) => f && f.id);
      setSharedFiles(files);
      
      // Fichiers/dossiers partagés PAR l'utilisateur
      setSharedByMeFolders(sharedByMeFoldersData.sharedFolders || []);
      const sharedByMeFilesList = (sharedByMeFilesData.sharedFiles || []).map((sf: any) => ({
        ...sf.file,
        sharedWith: sf.sharedWith,
        canRead: sf.canRead,
        canWrite: sf.canWrite,
        canDelete: sf.canDelete,
        canShare: sf.canShare,
      })).filter((f: any) => f && f.id);
      setSharedByMeFiles(sharedByMeFilesList);
    } catch (error) {
      toast.error('Échec du chargement des éléments partagés');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!confirm('Supprimer ce lien de partage ?')) return;

    try {
      await shareService.deleteShareLink(linkId);
      toast.success('Lien de partage supprimé');
      loadShared();
    } catch (error) {
      toast.error('Échec de la suppression du lien');
    }
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success('Lien copié dans le presse-papiers');
  };

  const handleOpenLink = (url: string) => {
    window.open(url, '_blank');
  };

  const handlePreviewFile = (file: File) => {
    setPreviewFile(file);
    setShowPreviewModal(true);
  };

  const handleDownloadFile = async (file: File) => {
    try {
      // Use shared file download URL for shared files
      const url = fileService.getSharedFileDownloadUrl(file.id);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Téléchargement démarré');
    } catch (error) {
      toast.error('Échec du téléchargement');
    }
  };

  const tabs = [
    { id: 'shared-with-me' as TabType, label: 'Partagés avec moi', icon: Users, count: sharedFiles.length + sharedFolders.length },
    { id: 'my-shares' as TabType, label: 'Mes partages', icon: Share2, count: shareLinks.length + sharedByMeFiles.length + sharedByMeFolders.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Partages</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Gérez vos fichiers partagés et vos liens de partage
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-primary-600 text-primary-600 dark:text-primary-300'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id
                    ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/50 dark:text-primary-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          {/* Partagés avec moi */}
          {activeTab === 'shared-with-me' && (
            <div className="space-y-6">
              {/* Fichiers partagés */}
              {sharedFiles.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <FileIcon className="w-5 h-5 text-primary-600" />
                      Fichiers partagés avec moi
                    </h2>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {sharedFiles.map((file) => {
                      const Icon = getMimeTypeIcon(file.mimeType);
                      const colorClass = getMimeTypeColor(file.mimeType);
                      return (
                        <div
                          key={file.id}
                          className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                        >
                          <div className={`p-2.5 rounded-lg ${colorClass}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white truncate">
                              {file.name}
                            </p>
                            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                              <span>{formatBytes(Number(file.size))}</span>
                              <span>•</span>
                              <span>Partagé par {(file as any).sharedBy?.email || file.user?.email || 'Inconnu'}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handlePreviewFile(file)}
                              className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                              title="Prévisualiser"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDownloadFile(file)}
                              className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                              title="Télécharger"
                            >
                              <Download className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Dossiers partagés */}
              {sharedFolders.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Folder className="w-5 h-5 text-amber-500" />
                      Dossiers partagés avec moi
                    </h2>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {sharedFolders.map((folder) => (
                      <div
                        key={folder.id}
                        className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/files/${folder.folderId}`)}
                      >
                        <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                          <FolderOpen className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white truncate">
                            {folder.folder?.name || 'Dossier partagé'}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                            <span>Partagé par {folder.sharedBy?.email || 'Inconnu'}</span>
                            <span>•</span>
                            <span className={`flex items-center gap-1 ${folder.canWrite ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                              {folder.canWrite ? (
                                <>
                                  <Unlock className="w-3 h-3" />
                                  Modification
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3 h-3" />
                                  Lecture seule
                                </>
                              )}
                            </span>
                          </div>
                        </div>
                        <ExternalLink className="w-5 h-5 text-gray-400" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sharedFiles.length === 0 && sharedFolders.length === 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
                  <Users className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Aucun élément partagé avec vous
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Les fichiers et dossiers que d'autres utilisateurs partagent avec vous apparaîtront ici.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Mes partages */}
          {activeTab === 'my-shares' && (
            <div className="space-y-6">
              {/* Liens de partage publics */}
              {shareLinks.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Link2 className="w-5 h-5 text-primary-600" />
                      Liens de partage actifs
                    </h2>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {shareLinks.map((link) => (
                      <div
                        key={link.id}
                        className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4 flex-1 min-w-0">
                            <div className="p-2.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-300">
                              <Link2 className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 dark:text-white truncate">
                                {link.fileName}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
                                {link.url}
                              </p>
                              <div className="flex flex-wrap items-center gap-4 mt-3">
                                <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                                  <Download className="w-4 h-4" />
                                  <span>
                                    {link.downloads} téléchargement{link.downloads !== 1 ? 's' : ''}
                                    {link.maxDownloads && ` / ${link.maxDownloads} max`}
                                  </span>
                                </div>
                                {link.expiresAt && (
                                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                                    <Clock className="w-4 h-4" />
                                    <span>
                                      Expire le {format(new Date(link.expiresAt), 'dd MMM yyyy', { locale: fr })}
                                    </span>
                                  </div>
                                )}
                                {link.password && (
                                  <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                                    <Shield className="w-4 h-4" />
                                    <span>Protégé</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleCopyLink(link.url)}
                              className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                              title="Copier le lien"
                            >
                              <Copy className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleOpenLink(link.url)}
                              className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                              title="Ouvrir le lien"
                            >
                              <ExternalLink className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDeleteLink(link.id)}
                              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Supprimer le lien"
                            >
                              <Trash2 className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Fichiers partagés directement */}
              {sharedByMeFiles.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Share2 className="w-5 h-5 text-green-500" />
                      Fichiers partagés
                    </h2>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {sharedByMeFiles.map((file) => (
                      <div
                        key={file.id}
                        className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4 flex-1 min-w-0">
                            <div className="p-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 dark:text-white truncate">
                                {file.name}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
                                {((file as any).sharedWith?.firstName || (file as any).sharedWith?.email) ? 
                                  `Partagé avec ${(file as any).sharedWith.firstName || (file as any).sharedWith.email}` 
                                  : 'Non partagé'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dossiers partagés */}
              {sharedByMeFolders.length > 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Folder className="w-5 h-5 text-amber-500" />
                      Dossiers partagés
                    </h2>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {sharedByMeFolders.map((folder) => (
                      <div
                        key={folder.id}
                        className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/files/${folder.folderId}`)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-start gap-4 flex-1 min-w-0">
                            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                              <FolderOpen className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 dark:text-white truncate">
                                {folder.folder?.name || 'Dossier partagé'}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
                                Partagé avec {folder.sharedWith?.email || 'Inconnu'}
                              </p>
                            </div>
                          </div>
                          <ExternalLink className="w-5 h-5 text-gray-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Message vide si rien n'est partagé */}
              {shareLinks.length === 0 && sharedByMeFiles.length === 0 && sharedByMeFolders.length === 0 && (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
                  <Link2 className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Aucun partage
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    Créez un lien de partage ou partagez un fichier avec d'autres utilisateurs depuis la page de vos fichiers.
                  </p>
                  <button
                    onClick={() => navigate('/files')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    <FolderOpen className="w-5 h-5" />
                    Aller à mes fichiers
                  </button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Preview Modal */}
      {showPreviewModal && previewFile && (
        <FilePreviewModal
          file={previewFile}
          isShared={true}
          onClose={() => {
            setShowPreviewModal(false);
            setPreviewFile(null);
          }}
        />
      )}
    </div>
  );
}
