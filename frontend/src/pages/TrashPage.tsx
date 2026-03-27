import { useEffect, useState } from 'react';
import { fileService } from '@/services/fileService';
import { folderService } from '@/services/folderService';
import { File, Folder } from '@/types';
import {
  RotateCcw,
  Trash2,
  Image,
  Video,
  Music,
  FileText,
  Archive,
  File as FileIcon,
  Folder as FolderIcon,
  ArrowUpDown,
  ChevronRight,
  ChevronDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import TagSelector from '@/components/TagSelector';
import { formatBytes } from '@/utils/bytes';

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


const getRemainingDays = (deletedAt: string | Date | undefined) => {
  if (!deletedAt) return null;
  const deletedDate = new Date(deletedAt);
  const now = new Date();
  const diffTime = (deletedDate.getTime() + 90 * 24 * 60 * 60 * 1000) - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
};

export default function TrashPage() {
  const [deletedFiles, setDeletedFiles] = useState<File[]>([]);
  const [deletedFolders, setDeletedFolders] = useState<Folder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<string>('deletedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [folderContents, setFolderContents] = useState<Record<string, { files: File[], folders: Folder[] }>>({});

  useEffect(() => {
    loadTrash();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, sortOrder]);

  const loadTrash = async () => {
    try {
      setIsLoading(true);
      const [{ files }, { folders }] = await Promise.all([
        fileService.getDeletedFiles(),
        folderService.getDeletedFolders()
      ]);

      const sortItems = (items: any[]) => {
        return [...items].sort((a, b) => {
          let aVal: any = a[sortBy === 'date' ? 'deletedAt' : sortBy];
          let bVal: any = b[sortBy === 'date' ? 'deletedAt' : sortBy];

          if (sortBy === 'name') {
            aVal = aVal?.toLowerCase() || '';
            bVal = bVal?.toLowerCase() || '';
          }

          if (sortOrder === 'asc') {
            return aVal > bVal ? 1 : -1;
          } else {
            return aVal < bVal ? 1 : -1;
          }
        });
      };

      setDeletedFiles(sortItems(files));
      setDeletedFolders(sortItems(folders));
    } catch {
      toast.error('Échec du chargement de la corbeille');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (id: string, type: 'file' | 'folder') => {
    try {
      if (type === 'file') {
        await fileService.restoreFile(id);
      } else {
        await folderService.restoreFolder(id);
      }
      toast.success(type === 'file' ? 'Fichier restauré' : 'Dossier restauré');
      loadTrash();
    } catch {
      toast.error('Échec de la restauration');
    }
  };

  const handlePermanentDelete = async (id: string, type: 'file' | 'folder') => {
    if (!confirm(`Supprimer définitivement ce ${type === 'file' ? 'fichier' : 'dossier'} ? Cette action est irréversible.`)) return;

    try {
      if (type === 'file') {
        await fileService.deleteFile(id, true);
      } else {
        await folderService.deleteFolder(id, true);
      }
      toast.success(type === 'file' ? 'Fichier supprimé définitivement' : 'Dossier supprimé définitivement');
      loadTrash();
    } catch {
      toast.error('Échec de la suppression');
    }
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [field, order] = e.target.value.split('-');
    setSortBy(field === 'date' ? 'deletedAt' : field);
    setSortOrder(order as 'asc' | 'desc');
  };

  const toggleFolder = async (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
        if (!folderContents[folderId]) {
          // Fetch contents in background
          folderService.getFolderTrashContents(folderId).then(contents => {
            setFolderContents(curr => ({ ...curr, [folderId]: contents }));
          }).catch(() => {
            toast.error('Impossible de charger le contenu');
          });
        }
      }
      return next;
    });
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
          {deletedFolders.length} dossier{deletedFolders.length !== 1 ? 's' : ''} · {deletedFiles.length} fichier{deletedFiles.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Tri */}
      {(deletedFiles.length > 0 || deletedFolders.length > 0) && (
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
        {(deletedFiles.length > 0 || deletedFolders.length > 0) ? (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Nom</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Tags</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Taille</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase italic text-amber-600 dark:text-amber-400">Temps restant</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {/* Dossiers et Fichiers racine */}
              {(() => {
                const renderRows = (items: (File | Folder)[], type: 'file' | 'folder', depth = 0): JSX.Element[] => {
                  return items.flatMap((item: any) => {
                    const isFolder = type === 'folder';
                    const isExpanded = isFolder && expandedFolders.has(item.id);
                    const contents = isFolder ? folderContents[item.id] : null;
                    const Icon = isFolder ? FolderIcon : getMimeTypeIcon(item.mimeType);
                    const colorClass = isFolder ? 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20' : getMimeTypeColor(item.mimeType);

                    const row = (
                      <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center" style={{ paddingLeft: `${depth * 1.5}rem` }}>
                            {isFolder && (
                              <button 
                                onClick={() => toggleFolder(item.id)}
                                className="p-1 mr-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="w-4 h-4 text-gray-500" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-gray-500" />
                                )}
                              </button>
                            )}
                            {!isFolder && <div className="w-6 mr-1" />} {/* Spacer to align with folders */}
                            <div className="flex items-center space-x-3">
                              <div className={`p-2 rounded-lg ${colorClass}`}>
                                <Icon className="w-5 h-5" />
                              </div>
                              <span className="text-sm font-medium text-gray-900 dark:text-white">
                                {item.name}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {!isFolder ? (
                            <TagSelector file={item} onTagsChanged={loadTrash} />
                          ) : (
                            <span className="text-sm text-gray-400 italic">--</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {!isFolder ? formatBytes(Number(item.size)) : '--'}
                        </td>
                        <td className="px-6 py-4 text-sm font-medium">
                          {item.deletedAt ? (
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs ${
                              (getRemainingDays(item.deletedAt) || 0) < 10 
                                ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 animate-pulse' 
                                : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                            }`}>
                              {getRemainingDays(item.deletedAt)} jours
                            </span>
                          ) : (
                            <span className="text-gray-400 italic text-xs">Hérité</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleRestore(item.id, type)}
                              className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                              title="Restaurer"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handlePermanentDelete(item.id, type)}
                              className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
                              title="Supprimer définitivement"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );

                    if (isExpanded && contents) {
                      return [
                        row,
                        ...renderRows(contents.folders, 'folder', depth + 1),
                        ...renderRows(contents.files, 'file', depth + 1)
                      ];
                    }

                    return [row];
                  });
                };

                return [
                  ...renderRows(deletedFolders, 'folder'),
                  ...renderRows(deletedFiles, 'file')
                ];
              })()}
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
