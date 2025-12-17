import { X, Copy } from 'lucide-react';
import { File } from '@/types';

interface NewFolderModalProps {
  isOpen: boolean;
  folderName: string;
  onClose: () => void;
  onChange: (name: string) => void;
  onCreate: () => void;
}

export function NewFolderModal({ isOpen, folderName, onClose, onChange, onCreate }: NewFolderModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 !mt-0" style={{ marginTop: 0 }}>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-md w-full !mt-0" style={{ marginTop: 0 }}>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Créer un nouveau dossier
        </h3>
        <input
          type="text"
          value={folderName}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Nom du dossier"
          className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
          onKeyPress={(e) => e.key === 'Enter' && onCreate()}
          autoFocus
        />
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Annuler
          </button>
          <button
            onClick={onCreate}
            disabled={!folderName.trim()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Créer
          </button>
        </div>
      </div>
    </div>
  );
}

interface ShareModalProps {
  isOpen: boolean;
  file: File | null;
  shareLink: string;
  password: string;
  expiry: string;
  maxDownloads: string;
  onClose: () => void;
  onPasswordChange: (password: string) => void;
  onExpiryChange: (expiry: string) => void;
  onMaxDownloadsChange: (max: string) => void;
  onCreateLink: () => void;
  onCopyLink: () => void;
}

export function ShareModal({
  isOpen,
  file,
  shareLink,
  password,
  expiry,
  maxDownloads,
  onClose,
  onPasswordChange,
  onExpiryChange,
  onMaxDownloadsChange,
  onCreateLink,
  onCopyLink,
}: ShareModalProps) {
  if (!isOpen || !file) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 !mt-0" style={{ marginTop: 0 }}>
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 max-w-lg w-full !mt-0" style={{ marginTop: 0 }}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            Partager : {file.name}
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!shareLink ? (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Mot de passe (optionnel)
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => onPasswordChange(e.target.value)}
                placeholder="Laisser vide pour aucun mot de passe"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Date d'expiration (optionnel)
              </label>
              <input
                type="datetime-local"
                value={expiry}
                onChange={(e) => onExpiryChange(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nombre maximum de téléchargements (optionnel)
              </label>
              <input
                type="number"
                value={maxDownloads}
                onChange={(e) => onMaxDownloadsChange(e.target.value)}
                placeholder="Illimité"
                min="1"
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={onCreateLink}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Créer le lien
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-200 mb-3 font-medium">
                Lien de partage créé avec succès !
              </p>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  value={shareLink}
                  readOnly
                  className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                />
                <button
                  onClick={onCopyLink}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center transition-colors"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copier
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
