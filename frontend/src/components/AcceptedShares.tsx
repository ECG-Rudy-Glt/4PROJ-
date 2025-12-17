import { useEffect, useState } from 'react';
import { File as FileIcon, Folder, Share2, MoreVertical } from 'lucide-react';
import { shareService } from '@/services/shareService';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface AcceptedShare {
  id: string;
  type: 'file' | 'folder';
  name: string;
  sharedBy: {
    email: string;
    firstName?: string;
    lastName?: string;
  };
  size?: number;
  mimeType?: string;
  createdAt: string;
  canWrite?: boolean;
  canDelete?: boolean;
}

interface AcceptedSharesProps {
  onFileSelect?: (fileId: string) => void;
  onFolderSelect?: (folderId: string) => void;
}

export default function AcceptedShares({ onFileSelect, onFolderSelect }: AcceptedSharesProps) {
  const [shares, setShares] = useState<AcceptedShare[]>([]);

  useEffect(() => {
    loadAcceptedShares();
  }, []);

  const loadAcceptedShares = async () => {
    try {
      const data = await shareService.getAcceptedShares();
      const allShares: AcceptedShare[] = [];

      // Add folders
      if (data.folders) {
        allShares.push(
          ...data.folders.map((f: any) => ({
            id: f.folder.id,
            type: 'folder' as const,
            name: f.folder.name,
            sharedBy: f.sharedBy,
            createdAt: f.createdAt,
            canWrite: f.canWrite,
            canDelete: f.canDelete,
          }))
        );
      }

      // Add files
      if (data.files) {
        allShares.push(
          ...data.files.map((f: any) => ({
            id: f.file.id,
            type: 'file' as const,
            name: f.file.name,
            sharedBy: f.sharedBy,
            size: Number(f.file.size),
            mimeType: f.file.mimeType,
            createdAt: f.createdAt,
            canWrite: f.canWrite,
            canDelete: f.canDelete,
          }))
        );
      }

      setShares(allShares);
    } catch (error: any) {
      console.error('Erreur au chargement des partages acceptés', error);
    }
  };

  if (shares.length === 0) {
    return null;
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 o';
    const k = 1024;
    const sizes = ['o', 'Ko', 'Mo', 'Go'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
        <Share2 className="w-5 h-5 text-primary-600 dark:text-primary-300" />
        Fichiers et dossiers partagés
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {shares.map((share) => (
          <div
            key={`${share.type}-${share.id}`}
            className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => {
              if (share.type === 'file') {
                onFileSelect?.(share.id);
              } else {
                onFolderSelect?.(share.id);
              }
            }}
          >
            <div className="flex items-start gap-3">
              {/* Icône */}
              <div className="p-2.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-300 flex-shrink-0">
                {share.type === 'file' ? (
                  <FileIcon className="w-5 h-5" />
                ) : (
                  <Folder className="w-5 h-5" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-white truncate">{share.name}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                  {share.sharedBy.firstName} {share.sharedBy.lastName} ({share.sharedBy.email})
                </p>

                <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
                  {share.size && <span>{formatBytes(share.size)}</span>}
                  {share.canWrite && (
                    <span className="px-2 py-0.5 bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 rounded text-xs">
                      ✏️ Édition
                    </span>
                  )}
                </div>

                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  {format(new Date(share.createdAt), 'dd MMM yyyy', { locale: fr })}
                </p>
              </div>

              <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors flex-shrink-0">
                <MoreVertical className="w-4 h-4 text-gray-500" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
