import { useState, useEffect } from 'react';
import { versionService, FileVersion } from '@/services/versionService';
import { History, RotateCcw, Trash2, Clock, User } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { formatBytes } from '@/utils/bytes';

interface VersionHistoryProps {
  fileId: string;
  onVersionRestored?: () => void;
  isShared?: boolean;
  canWrite?: boolean;
}

export default function VersionHistory({ fileId, onVersionRestored, isShared = false, canWrite = true }: VersionHistoryProps) {
  const [versions, setVersions] = useState<FileVersion[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    loadVersions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileId]);

  const loadVersions = async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const { versions } = await versionService.getFileVersions(fileId);
      setVersions(versions);
    } catch (error: any) {
      console.error('Erreur chargement versions:', error);
      setHasError(true);
      // Don't show toast for shared files
      if (!isShared) {
        toast.error('Échec du chargement des versions');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestore = async (versionId: string, versionNumber: number) => {
    if (!confirm(`Restaurer la version ${versionNumber} ? Le fichier actuel sera sauvegardé comme nouvelle version.`)) {
      return;
    }

    try {
      await versionService.restoreVersion(fileId, versionId);
      toast.success('Version restaurée');
      loadVersions();
      if (onVersionRestored) {
        onVersionRestored();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Échec de la restauration');
    }
  };

  const handleDelete = async (versionId: string, versionNumber: number) => {
    if (!confirm(`Supprimer définitivement la version ${versionNumber} ?`)) {
      return;
    }

    try {
      await versionService.deleteVersion(fileId, versionId);
      toast.success('Version supprimée');
      loadVersions();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Échec de la suppression');
    }
  };

  const getUserDisplayName = (version: FileVersion) => {
    if (version.createdBy.firstName || version.createdBy.lastName) {
      return `${version.createdBy.firstName || ''} ${version.createdBy.lastName || ''}`.trim();
    }
    return version.createdBy.email.split('@')[0];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (hasError) {
    return (
      <div className="text-center py-8">
        <History className="w-12 h-12 mx-auto text-red-300 dark:text-red-600 mb-2" />
        <p className="text-red-600 dark:text-red-400">Impossible de charger l'historique</p>
        {isShared && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            L'historique des versions n'est pas disponible pour ce fichier partagé
          </p>
        )}
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="text-center py-8">
        <History className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
        <p className="text-gray-500 dark:text-gray-400">Aucune version antérieure</p>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
          Les versions précédentes apparaîtront ici lors des modifications
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Historique des versions
        </h3>
        <span className="ml-auto text-sm text-gray-500 dark:text-gray-400">
          {versions.length} version{versions.length > 1 ? 's' : ''}
        </span>
      </div>

      {isShared && !canWrite && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            Lecture seule - Vous ne pouvez pas restaurer ou supprimer des versions
          </p>
        </div>
      )}

      <div className="space-y-2">
        {versions.map((version) => (
          <div
            key={version.id}
            className="flex items-start gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {/* Version number badge */}
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                <span className="text-sm font-bold text-primary-600 dark:text-primary-300">
                  v{version.versionNumber}
                </span>
              </div>
            </div>

            {/* Version info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between mb-1">
                <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {version.name}
                </h4>
                <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap ml-2">
                  {formatBytes(Number(version.size))}
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-1">
                  <User className="w-3 h-3" />
                  <span>{getUserDisplayName(version)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{format(new Date(version.createdAt), 'dd MMM yyyy à HH:mm', { locale: fr })}</span>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => handleRestore(version.id, version.versionNumber)}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-all"
                title="Restaurer cette version"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleDelete(version.id, version.versionNumber)}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                title="Supprimer cette version"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg border border-primary-200 dark:border-primary-800">
        <p className="text-xs text-primary-800 dark:text-primary-300">
          <strong>Info :</strong> Les 10 dernières versions sont conservées automatiquement.
          Les versions comptent dans votre quota de stockage.
        </p>
      </div>
    </div>
  );
}
