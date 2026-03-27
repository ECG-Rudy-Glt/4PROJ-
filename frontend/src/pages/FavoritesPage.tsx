import { useEffect, useState } from 'react';
import { fileService } from '@/services/fileService';
import { File } from '@/types';
import {
  Star,
  Download,
  Eye,
  Trash2,
  Image,
  Video,
  Music,
  FileText,
  Archive,
  File as FileIcon,
  ArrowUpDown,
  FileSpreadsheet,
  Presentation
} from 'lucide-react';
import toast from 'react-hot-toast';
import FilePreviewModal from '@/components/FilePreviewModal';
import TagSelector from '@/components/TagSelector';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatBytes } from '@/utils/bytes';

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
  // PowerPoint - rouge
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint') || mimeType.includes('slide')) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
  if (mimeType.includes('pdf')) return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
  if (mimeType.includes('word') || mimeType.includes('document') || mimeType.includes('text')) return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
  if (mimeType.includes('zip') || mimeType.includes('rar')) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20';
  return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-900/20';
};


export default function FavoritesPage() {
  const [favoriteFiles, setFavoriteFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadFavoriteFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortOrder]);

  const loadFavoriteFiles = async () => {
    try {
      setIsLoading(true);
      const { files } = await fileService.getFavoriteFiles();

      // Tri local
      const sortedFiles = [...files].sort((a, b) => {
        let aVal: any = a[sortBy as keyof File];
        let bVal: any = b[sortBy as keyof File];

        if (sortBy === 'name') {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
        }

        if (sortOrder === 'asc') {
          return aVal > bVal ? 1 : -1;
        } else {
          return aVal < bVal ? 1 : -1;
        }
      });

      setFavoriteFiles(sortedFiles);
    } catch {
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
    } catch {
      toast.error('Échec de la modification');
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm('Déplacer ce fichier vers la corbeille ?')) return;

    try {
      await fileService.deleteFile(fileId, false);
      toast.success('Fichier déplacé vers la corbeille');
      loadFavoriteFiles();
    } catch {
      toast.error('Échec de la suppression du fichier');
    }
  };

  const handlePreview = (file: File) => {
    setSelectedFile(file);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [field, order] = e.target.value.split('-');
    setSortBy(field === 'date' ? 'createdAt' : field);
    setSortOrder(order as 'asc' | 'desc');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {/* Header simple comme FilesPage */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Favoris</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {favoriteFiles.length} fichier{favoriteFiles.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Tri */}
      {favoriteFiles.length > 0 && (
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-2">
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

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {favoriteFiles.length > 0 ? (
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
              {favoriteFiles.map((file) => {
                const Icon = getMimeTypeIcon(file.mimeType);
                const colorClass = getMimeTypeColor(file.mimeType);

                return (
                  <tr key={file.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handlePreview(file)}
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
                    <td className="px-6 py-4">
                      <TagSelector file={file} onTagsChanged={loadFavoriteFiles} />
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
                          onClick={() => handleToggleFavorite(file.id)}
                          className="p-2 rounded-lg transition-all text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                          title="Retirer des favoris"
                        >
                          <Star className="w-4 h-4" fill="currentColor" />
                        </button>
                        <button
                          onClick={() => handlePreview(file)}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                          title="Aperçu"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <a
                          href={fileService.getDownloadUrl(file.id)}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                          title="Télécharger"
                        >
                          <Download className="w-4 h-4" />
                        </a>
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
