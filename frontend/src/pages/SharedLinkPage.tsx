import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { shareService } from '@/services/shareService';
import { Download, Lock, FileText, Image, Video, Music, Archive, File, User, Calendar, HardDrive, AlertCircle, FileSpreadsheet, Presentation } from 'lucide-react';
import { formatBytes } from '@/utils/bytes';
import toast from 'react-hot-toast';

const getFileIcon = (mimeType: string) => {
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
  return File;
};

const getFileColor = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return 'from-blue-500 to-blue-600';
  if (mimeType.startsWith('video/')) return 'from-purple-500 to-purple-600';
  if (mimeType.startsWith('audio/')) return 'from-pink-500 to-pink-600';
  // Excel - vert
  if (mimeType.includes('spreadsheet') || mimeType.includes('sheet') || mimeType.includes('excel')) return 'from-green-500 to-green-600';
  // PowerPoint - rouge
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint') || mimeType.includes('slide')) return 'from-red-500 to-red-600';
  if (mimeType.includes('pdf')) return 'from-red-500 to-red-600';
  if (mimeType.includes('word') || mimeType.includes('document') || mimeType.includes('text')) return 'from-blue-500 to-blue-600';
  if (mimeType.includes('zip') || mimeType.includes('rar')) return 'from-amber-500 to-amber-600';
  return 'from-gray-500 to-gray-600';
};


const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export default function SharedLinkPage() {
  const { token } = useParams<{ token: string }>();
  const [file, setFile] = useState<any>(null);
  const [sharedBy, setSharedBy] = useState<any>(null);
  const [bundleInfo, setBundleInfo] = useState<{ fileCount: number } | null>(null);
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadSharedFile();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadSharedFile = async (pwd?: string) => {
    try {
      const data = await shareService.getSharedFile(token!, pwd);
      setNeedsPassword(false);

      if (data.isBundle) {
        setBundleInfo({ fileCount: data.fileCount });
        setSharedBy(data.sharedBy);
        return;
      }

      setFile(data.file);
      setSharedBy(data.sharedBy);

      if (data.file?.mimeType?.startsWith('image/')) {
        setPreviewUrl(shareService.getSharedFileDownloadUrl(token!, pwd));
      }
    } catch (error: any) {
      if (error.response?.data?.error === 'Password required') {
        setNeedsPassword(true);
      } else {
        toast.error(error.response?.data?.error || 'Échec du chargement du fichier');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    loadSharedFile(password);
  };

  const handleDownload = () => {
    setIsDownloading(true);
    window.location.href = shareService.getSharedFileDownloadUrl(
      token!,
      needsPassword ? password : undefined
    );
    setTimeout(() => setIsDownloading(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary-200 border-t-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Chargement du fichier...</p>
        </div>
      </div>
    );
  }

  if (needsPassword && !file) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 px-4">
        <div className="max-w-md w-full">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-6 text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Lock className="w-8 h-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-white">Fichier protégé</h2>
              <p className="text-primary-100 mt-2">Ce fichier nécessite un mot de passe</p>
            </div>
            <form onSubmit={handlePasswordSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Mot de passe
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Entrez le mot de passe"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                  required
                  autoFocus
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:from-primary-600 hover:to-primary-700 font-medium transition-all transform hover:scale-[1.02] active:scale-[0.98]"
              >
                Accéder au fichier
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (bundleInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 px-4 py-8 flex items-center justify-center">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-8 text-center">
            <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
              <Archive className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-white">Archive ZIP</h1>
            <p className="text-white/80 mt-2 text-sm">{bundleInfo.fileCount} fichier{bundleInfo.fileCount > 1 ? 's' : ''}</p>
          </div>
          <div className="p-6 space-y-4">
            {sharedBy && (
              <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <User className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Partagé par</p>
                  <p className="font-semibold text-gray-900 dark:text-white truncate">
                    {sharedBy.firstName || sharedBy.email?.split('@')[0]}
                  </p>
                </div>
              </div>
            )}
            <a
              href={`/api/share/${token}/download-bundle`}
              className="flex items-center justify-center space-x-3 w-full py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:from-primary-600 hover:to-primary-700 font-semibold transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg"
              download
            >
              <Download className="w-5 h-5" />
              <span>Télécharger l'archive</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 text-center">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
            <AlertCircle className="w-10 h-10 text-red-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Fichier introuvable
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Ce lien de partage a peut-être expiré, le nombre maximum de téléchargements a été atteint, ou le fichier a été supprimé.
          </p>
        </div>
      </div>
    );
  }

  const FileIcon = getFileIcon(file.mimeType);
  const gradientColor = getFileColor(file.mimeType);

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 px-4 py-8 flex items-center justify-center">
      <div className="max-w-2xl w-full">
        {/* Card principale */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          {/* Header avec icône */}
          <div className={`bg-gradient-to-r ${gradientColor} p-8 text-center relative overflow-hidden`}>
            <div className="absolute inset-0 bg-black/10"></div>
            <div className="relative">
              <div className="w-24 h-24 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                <FileIcon className="w-12 h-12 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white break-all px-4">
                {file.name}
              </h1>
              <p className="text-white/80 mt-2 text-sm uppercase tracking-wider">
                {file.mimeType.split('/')[1] || 'Fichier'}
              </p>
            </div>
          </div>

          {/* Prévisualisation pour les images */}
          {previewUrl && file.mimeType.startsWith('image/') && (
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <div className="rounded-xl overflow-hidden shadow-inner bg-white dark:bg-gray-800">
                <img
                  src={previewUrl}
                  alt={file.name}
                  className="w-full max-h-64 object-contain"
                  onError={() => setPreviewUrl(null)}
                />
              </div>
            </div>
          )}

          {/* Informations du fichier */}
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <HardDrive className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Taille</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{formatBytes(file.size)}</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Calendar className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Partagé le</p>
                  <p className="font-semibold text-gray-900 dark:text-white text-sm">{formatDate(file.createdAt)}</p>
                </div>
              </div>
              
              {sharedBy && (
                <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <User className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">Partagé par</p>
                    <p className="font-semibold text-gray-900 dark:text-white truncate">
                      {sharedBy.firstName || sharedBy.email.split('@')[0]}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Bouton de téléchargement */}
            <button
              onClick={handleDownload}
              disabled={isDownloading}
              className={`w-full flex items-center justify-center py-4 rounded-xl font-semibold text-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] ${
                isDownloading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : `bg-gradient-to-r ${gradientColor} hover:shadow-lg text-white`
              }`}
            >
              {isDownloading ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent mr-3"></div>
                  Téléchargement...
                </>
              ) : (
                <>
                  <Download className="w-6 h-6 mr-3" />
                  Télécharger le fichier
                </>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 dark:text-gray-400 text-sm mt-6">
          Partagé via <span className="font-semibold text-primary-600">SupFile</span>
        </p>
      </div>
    </div>
  );
}
