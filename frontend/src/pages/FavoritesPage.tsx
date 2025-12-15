import { useEffect, useState } from 'react';
import { fileService } from '@/services/fileService';
import { File } from '@/types';
import { Star, Download, Eye, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import FilePreviewModal from '@/components/FilePreviewModal';

export default function FavoritesPage() {
  const [favoriteFiles, setFavoriteFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    loadFavoriteFiles();
  }, []);

  const loadFavoriteFiles = async () => {
    try {
      setIsLoading(true);
      const { files } = await fileService.getFavoriteFiles();
      setFavoriteFiles(files);
    } catch (error) {
      toast.error('Échec du chargement des favoris');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFavorite = async (fileId: string) => {
    try {
      await fileService.toggleFavorite(fileId);
      toast.success('Retiré des favoris');
      loadFavoriteFiles();
    } catch (error) {
      toast.error('Échec de la modification');
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm('Déplacer ce fichier vers la corbeille ?')) return;

    try {
      await fileService.deleteFile(fileId, false);
      toast.success('Fichier déplacé vers la corbeille');
      loadFavoriteFiles();
    } catch (error) {
      toast.error('Échec de la suppression du fichier');
    }
  };

  const handlePreview = (file: File) => {
    setSelectedFile(file);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 o';
    const k = 1024;
    const sizes = ['o', 'Ko', 'Mo', 'Go'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎥';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType.includes('pdf')) return '📄';
    if (mimeType.includes('zip') || mimeType.includes('rar')) return '📦';
    if (mimeType.includes('document') || mimeType.includes('word')) return '📝';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return '📊';
    return '📎';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-3 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-xl shadow-lg">
          <Star className="w-8 h-8 text-white" fill="white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Favoris</h1>
          <p className="text-gray-500 dark:text-gray-400">
            {favoriteFiles.length} fichier{favoriteFiles.length !== 1 ? 's' : ''} favori{favoriteFiles.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {favoriteFiles.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Nom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Taille
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Modifié
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {favoriteFiles.map((file) => (
                <tr key={file.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <span className="text-2xl mr-3">{getFileIcon(file.mimeType)}</span>
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {file.name}
                        </div>
                        {file.folder && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {file.folder.name}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatBytes(Number(file.size))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {file.mimeType.split('/')[1]?.toUpperCase()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {new Date(file.updatedAt).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handlePreview(file)}
                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                        title="Aperçu"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      <a
                        href={fileService.getDownloadUrl(file.id)}
                        className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                        title="Télécharger"
                      >
                        <Download className="w-5 h-5" />
                      </a>
                      <button
                        onClick={() => handleToggleFavorite(file.id)}
                        className="text-yellow-600 hover:text-yellow-900 dark:text-yellow-400 dark:hover:text-yellow-300"
                        title="Retirer des favoris"
                      >
                        <Star className="w-5 h-5" fill="currentColor" />
                      </button>
                      <button
                        onClick={() => handleDelete(file.id)}
                        className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                        title="Supprimer"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-12">
            <Star className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
              Aucun fichier favori
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
              Marquez vos fichiers importants comme favoris pour y accéder rapidement
            </p>
          </div>
        )}
      </div>

      {selectedFile && (
        <FilePreviewModal
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </div>
  );
}
