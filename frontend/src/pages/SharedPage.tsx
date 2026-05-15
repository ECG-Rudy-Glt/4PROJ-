import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { shareService } from '@/services/shareService';
import { fileService } from '@/services/fileService';
import { SharedLink, SharedFolder, SharedFile, File } from '@/types';
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
  FolderOpen,
  Settings
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import FilePreviewModal from '@/components/FilePreviewModal';
import ShareFolderModal from '@/components/ShareFolderModal';
import { ShareFileModal } from '@/components/ShareFileModal';
import { formatBytes } from '@/utils/bytes';
import { getApiErrorMessage } from '@/utils/getApiErrorMessage';
import { useTranslation } from 'react-i18next';

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


type TabType = 'shared-with-me' | 'my-shares' | 'pending';

export default function SharedPage() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'fr' ? fr : enUS;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
  const [managedShareFile, setManagedShareFile] = useState<File | null>(null);
  const [managedShareFolder, setManagedShareFolder] = useState<SharedFolder | null>(null);

  // Partages en attente
  const [pendingFolders, setPendingFolders] = useState<SharedFolder[]>([]);
  const [pendingFiles, setPendingFiles] = useState<SharedFile[]>([]);
  
  useEffect(() => {
    loadShared();
  }, []);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab === 'shared-with-me' || tab === 'my-shares' || tab === 'pending') {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const loadShared = async () => {
    setIsLoading(true);
    try {
      const [linksData, foldersData, filesData, sharedByMeFoldersData, sharedByMeFilesData, pendingData] = await Promise.all([
        shareService.listShareLinks(),
        shareService.listSharedWithMe(),
        shareService.listFilesSharedWithMe().catch(() => ({ sharedFiles: [] })),
        shareService.listSharedByMe().catch(() => ({ sharedFolders: [] })),
        shareService.listFilesSharedByMe().catch(() => ({ sharedFiles: [] })),
        shareService.getPendingShares().catch(() => ({ folders: [], files: [] })),
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

      // Partages en attente
      setPendingFolders(pendingData.folders || []);
      setPendingFiles(pendingData.files || []);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('shared.error_loading_shared')));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptShare = async (shareId: string, type: 'file' | 'folder') => {
    try {
      if (type === 'file') {
        await shareService.acceptSharedFile(shareId);
      } else {
        await shareService.acceptSharedFolder(shareId);
      }
      toast.success(t('shared.pending.accept_success'));
      loadShared();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('shared.pending.error_accept')));
    }
  };

  const handleRejectShare = async (shareId: string, type: 'file' | 'folder') => {
    if (!confirm(t('shared.pending.confirm_reject'))) return;
    try {
      if (type === 'file') {
        await shareService.rejectSharedFile(shareId);
      } else {
        await shareService.rejectSharedFolder(shareId);
      }
      toast.success(t('shared.pending.reject_success'));
      loadShared();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('shared.pending.error_reject')));
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!confirm(t('shared.my_shares.delete_link_confirm'))) return;

    try {
      await shareService.deleteShareLink(linkId);
      toast.success(t('shared.my_shares.delete_link_success'));
      loadShared();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('shared.my_shares.error_delete_link')));
    }
  };

  const handleCopyLink = (url: string) => {
    navigator.clipboard.writeText(url);
    toast.success(t('shared.my_shares.copy_link_success'));
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
      await fileService.triggerSharedFileDownload(file.id, file.name);
      toast.success(t('shared.download_started'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('shared.error_download')));
    }
  };

  const tabs = [
    { id: 'shared-with-me' as TabType, label: t('shared.tabs.with_me'), icon: Users, count: sharedFiles.length + sharedFolders.length },
    { id: 'pending' as TabType, label: t('shared.tabs.pending'), icon: Clock, count: pendingFiles.length + pendingFolders.length, highlight: true },
    { id: 'my-shares' as TabType, label: t('shared.tabs.my_shares'), icon: Share2, count: shareLinks.length + sharedByMeFiles.length + sharedByMeFolders.length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('shared.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {t('shared.subtitle')}
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
                  : tab.highlight && tab.count > 0
                    ? 'border-transparent text-amber-600 dark:text-amber-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon className="w-5 h-5" />
              {tab.label}
              {tab.count > 0 && (
                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id
                    ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/50 dark:text-primary-300'
                    : tab.highlight 
                      ? 'bg-amber-100 text-amber-600 animate-pulse'
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
                      {t('shared.with_me_files')}
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
                              <span>{t('shared.shared_by', { name: (file as any).sharedBy?.email || file.user?.email || t('common.others') })}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handlePreviewFile(file)}
                              className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                              title={t('common.preview')}
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDownloadFile(file)}
                              className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                              title={t('common.download')}
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
                      {t('shared.with_me_folders')}
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
                            {folder.folder?.name || t('shared.my_shares.shared_folder')}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400 mt-1">
                            <span>{t('shared.shared_by', { name: folder.sharedBy?.email || t('common.others') })}</span>
                            <span>•</span>
                            <span className={`flex items-center gap-1 ${folder.canWrite ? 'text-green-600 dark:text-green-400' : 'text-gray-500'}`}>
                              {folder.canWrite ? (
                                <>
                                  <Unlock className="w-3 h-3" />
                                  {t('shared.permissions.write')}
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3 h-3" />
                                  {t('shared.permissions.read_only')}
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
                    {t('shared.no_shared_with_me')}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    {t('shared.no_shared_with_me_desc')}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Partages en attente */}
          {activeTab === 'pending' && (
            <div className="space-y-6">
              {(pendingFiles.length > 0 || pendingFolders.length > 0) ? (
                <div className="grid grid-cols-1 gap-4">
                  {/* Fichiers en attente */}
                  {pendingFiles.map((share) => (
                    <div key={share.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-amber-200 dark:border-amber-900/30 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                          <FileIcon className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white truncate">
                            {share.file?.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t('shared.shared_by', { name: share.sharedBy?.firstName || share.sharedBy?.email })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRejectShare(share.id, 'file')}
                          className="px-4 py-2 text-sm font-bold bg-red-600 text-white hover:bg-red-700 rounded-lg shadow-sm shadow-red-600/20 transition-all"
                        >
                          {t('shared.pending.reject')}
                        </button>
                        <button
                          onClick={() => handleAcceptShare(share.id, 'file')}
                          className="px-4 py-2 text-sm font-bold bg-primary-600 text-white hover:bg-primary-700 rounded-lg shadow-sm transition-all shadow-primary-600/20"
                        >
                          {t('shared.pending.accept')}
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Dossiers en attente */}
                  {pendingFolders.map((share) => (
                    <div key={share.id} className="bg-white dark:bg-gray-800 rounded-xl p-4 shadow-sm border border-amber-200 dark:border-amber-900/30 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                          <Folder className="w-6 h-6" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 dark:text-white truncate">
                            {share.folder?.name}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {t('shared.shared_by', { name: share.sharedBy?.firstName || share.sharedBy?.email })}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRejectShare(share.id, 'folder')}
                          className="px-4 py-2 text-sm font-bold bg-red-600 text-white hover:bg-red-700 rounded-lg shadow-sm shadow-red-600/20 transition-all"
                        >
                          {t('shared.pending.reject')}
                        </button>
                        <button
                          onClick={() => handleAcceptShare(share.id, 'folder')}
                          className="px-4 py-2 text-sm font-bold bg-primary-600 text-white hover:bg-primary-700 rounded-lg shadow-sm transition-all shadow-primary-600/20"
                        >
                          {t('shared.pending.accept')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center text-gray-500">
                  <Clock className="w-12 h-12 mx-auto mb-4 opacity-20" />
                  <p>{t('shared.pending.no_pending')}</p>
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
                      {t('shared.my_shares.active_links')}
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
                                    {link.downloads} {link.downloads > 1 ? t('shared.my_shares.downloads_plural') : t('shared.my_shares.downloads')}
                                    {link.maxDownloads && t('shared.my_shares.max_downloads', { count: link.maxDownloads })}
                                  </span>
                                </div>
                                {link.expiresAt && (
                                  <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                                    <Clock className="w-4 h-4" />
                                    <span>
                                      {t('shared.my_shares.expires_at', { date: format(new Date(link.expiresAt), 'dd MMM yyyy', { locale: dateLocale }) })}
                                    </span>
                                  </div>
                                )}
                                {link.password && (
                                  <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                                    <Shield className="w-4 h-4" />
                                    <span>{t('shared.my_shares.protected')}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleCopyLink(link.url)}
                              className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                              title={t('shared.my_shares.copy_link')}
                            >
                              <Copy className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleOpenLink(link.url)}
                              className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                              title={t('shared.my_shares.open_link')}
                            >
                              <ExternalLink className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleDeleteLink(link.id)}
                              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title={t('shared.my_shares.delete_link')}
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
                      {t('shared.my_shares.shared_files')}
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
                                  t('shared.my_shares.shared_with', { name: (file as any).sharedWith.firstName || (file as any).sharedWith.email }) 
                                  : t('shared.my_shares.not_shared')}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => setManagedShareFile(file)}
                            className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                            title={t('common.settings')}
                            aria-label={t('common.settings')}
                          >
                            <Settings className="w-5 h-5" />
                          </button>
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
                      {t('shared.my_shares.shared_folders')}
                    </h2>
                  </div>
                  <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {sharedByMeFolders.map((folder) => (
                      <div
                        key={folder.id}
                        className="flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/files/${folder.folderId}`)}
                      >
                        <div className="flex items-start justify-between gap-4 flex-1 min-w-0">
                          <div className="flex items-start gap-4 flex-1 min-w-0">
                            <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400">
                              <FolderOpen className="w-5 h-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 dark:text-white truncate">
                                {folder.folder?.name || t('shared.my_shares.shared_folder')}
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">
                                {t('shared.my_shares.shared_with', { name: folder.sharedWith?.email || t('common.others') })}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                setManagedShareFolder(folder);
                              }}
                              className="p-2 text-gray-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors"
                              title={t('common.settings')}
                              aria-label={t('common.settings')}
                            >
                              <Settings className="w-5 h-5" />
                            </button>
                            <ExternalLink className="w-5 h-5 text-gray-400" />
                          </div>
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
                    {t('shared.my_shares.no_shares')}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    {t('shared.my_shares.no_shares_desc')}
                  </p>
                  <button
                    onClick={() => navigate('/files')}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    <FolderOpen className="w-5 h-5" />
                    {t('shared.my_shares.go_to_files')}
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

      {managedShareFile && (
        <ShareFileModal
          file={managedShareFile}
          onClose={() => {
            setManagedShareFile(null);
            loadShared();
          }}
        />
      )}

      {managedShareFolder && (
        <ShareFolderModal
          folderId={managedShareFolder.folderId}
          folderName={managedShareFolder.folder?.name || t('shared.my_shares.shared_folder')}
          isOpen={true}
          onClose={() => {
            setManagedShareFolder(null);
            loadShared();
          }}
        />
      )}
    </div>
  );
}
