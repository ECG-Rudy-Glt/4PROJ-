import { useState, useEffect } from 'react';
import { X, Check, XCircle, File, Folder } from 'lucide-react';
import { shareService } from '@/services/shareService';
import toast from 'react-hot-toast';

interface PendingShare {
  id: string;
  type: 'file' | 'folder';
  name: string;
  sharedBy: {
    email: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
  };
  file?: {
    size: number;
    mimeType: string;
  };
  createdAt: string;
}

interface PendingSharesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept?: () => void;
}

export default function PendingSharesModal({ isOpen, onClose, onAccept }: PendingSharesModalProps) {
  const [pendingShares, setPendingShares] = useState<PendingShare[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadPendingShares();
    }
  }, [isOpen]);

  const loadPendingShares = async () => {
    try {
      const data = await shareService.getPendingShares();
      const shares: PendingShare[] = [];

      // Add files
      if (data.files) {
        shares.push(
          ...data.files.map((f: any) => ({
            id: f.id,
            type: 'file' as const,
            name: f.file.name,
            sharedBy: f.sharedBy,
            file: {
              size: Number(f.file.size),
              mimeType: f.file.mimeType,
            },
            createdAt: f.createdAt,
          }))
        );
      }

      // Add folders
      if (data.folders) {
        shares.push(
          ...data.folders.map((f: any) => ({
            id: f.id,
            type: 'folder' as const,
            name: f.folder.name,
            sharedBy: f.sharedBy,
            createdAt: f.createdAt,
          }))
        );
      }

      setPendingShares(shares);
    } catch {
      toast.error('Erreur au chargement des partages');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (share: PendingShare) => {
    setAccepting(share.id);
    try {
      if (share.type === 'file') {
        await shareService.acceptSharedFile(share.id);
      } else {
        await shareService.acceptSharedFolder(share.id);
      }
      toast.success('Partage accepté');
      setPendingShares(pendingShares.filter((s) => s.id !== share.id));
      onAccept?.();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de l\'acceptation');
    } finally {
      setAccepting(null);
    }
  };

  const handleReject = async (share: PendingShare) => {
    try {
      if (share.type === 'file') {
        await shareService.rejectSharedFile(share.id);
      } else {
        await shareService.rejectSharedFolder(share.id);
      }
      toast.success('Partage rejeté');
      setPendingShares(pendingShares.filter((s) => s.id !== share.id));
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors du rejet');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-96 overflow-y-auto">
        <div className="sticky top-0 bg-white dark:bg-gray-800 px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Partages en attente</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : pendingShares.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">Aucun partage en attente</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {pendingShares.map((share) => (
              <div key={share.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                <div className="flex items-start gap-4">
                  {/* Icône */}
                  <div className="p-2.5 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-300 flex-shrink-0">
                    {share.type === 'file' ? (
                      <File className="w-5 h-5" />
                    ) : (
                      <Folder className="w-5 h-5" />
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">{share.name}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      Partagé par {share.sharedBy.firstName} {share.sharedBy.lastName} ({share.sharedBy.email})
                    </p>
                    {share.file && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                        {(share.file.size / 1024 / 1024).toFixed(2)} MB • {share.file.mimeType}
                      </p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => handleAccept(share)}
                      disabled={accepting === share.id}
                      className="p-2 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors disabled:opacity-50"
                      title="Accepter"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleReject(share)}
                      className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Rejeter"
                    >
                      <XCircle className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
