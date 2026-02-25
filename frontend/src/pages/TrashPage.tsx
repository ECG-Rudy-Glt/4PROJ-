import { useEffect, useState } from 'react';
import { fileService } from '@/services/fileService';
import { useAuthStore } from '@/stores/useAuthStore';
import { File } from '@/types';
import {
  RotateCcw,
  Trash2,
  Image,
  Video,
  Music,
  FileText,
  Archive,
  File as FileIcon,
  ArrowUpDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import TagSelector from '@/components/TagSelector';
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

export default function TrashPage() {
  const { loadUser } = useAuthStore();
  const [deletedFiles, setDeletedFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<string>('deletedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadDeletedFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortOrder]);

  const loadDeletedFiles = async () => {
    try {
      setIsLoading(true);
      const { files } = await fileService.getDeletedFiles();

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

      setDeletedFiles(sortedFiles);
    } catch {
      toast.error('Échec du chargement de la corbeille');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (fileId: string) => {
    try {
      await fileService.restoreFile(fileId);
      toast.success('Fichier restauré');
      loadDeletedFiles();
    } catch {
      toast.error('Échec de la restauration du fichier');
    }
  };

  const handlePermanentDelete = async (fileId: string) => {
    if (!confirm('Supprimer définitivement ce fichier ? Cette action est irréversible.')) return;

    try {
      await fileService.deleteFile(fileId, true);
      toast.success('Fichier supprimé définitivement');
      loadDeletedFiles();
    } catch {
      toast.error('Échec de la suppression du fichier');
    }
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [field, order] = e.target.value.split('-');
    setSortBy(field === 'date' ? 'deletedAt' : field);
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Corbeille</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {deletedFiles.length} fichier{deletedFiles.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Tri */}
      {deletedFiles.length > 0 && (
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
            <option value="date-desc">Plus récemment supprimés</option>
            <option value="date-asc">Moins récemment supprimés</option>
            <option value="size-desc">Plus volumineux</option>
            <option value="size-asc">Plus petits</option>
          </select>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        {deletedFiles.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Nom</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Tags</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Taille</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Supprimé</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {deletedFiles.map((file) => {
                const Icon = getMimeTypeIcon(file.mimeType);
                const colorClass = getMimeTypeColor(file.mimeType);

                return (
                  <tr key={file.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-lg ${colorClass}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                          {file.name}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <TagSelector file={file} onTagsChanged={loadDeletedFiles} />
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {formatBytes(Number(file.size))}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {file.deletedAt && format(new Date(file.deletedAt), 'dd MMM yyyy', { locale: fr })}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => handleRestore(file.id)}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                          title="Restaurer"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handlePermanentDelete(file.id)}
                          className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                          title="Supprimer définitivement"
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
            <Trash2 className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
            <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
              La corbeille est vide
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-2">
              Les fichiers supprimés apparaissent ici et sont automatiquement purgés après 90 jours
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
