import { X, Upload, CheckCircle, XCircle, File as FileIcon } from 'lucide-react';
import { formatBytes } from '@/utils/bytes';

export interface UploadingFile {
  id: string;
  file: globalThis.File;
  progress: number;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
  targetFolderId?: string;
}

interface UploadModalProps {
  isOpen: boolean;
  files: UploadingFile[];
  onClose: () => void;
  onCancel: () => void;
}


export default function UploadModal({ isOpen, files, onClose, onCancel }: UploadModalProps) {
  if (!isOpen) return null;

  const totalFiles = files.length;
  const completedFiles = files.filter(f => f.status === 'success').length;
  const failedFiles = files.filter(f => f.status === 'error').length;
  const isUploading = files.some(f => f.status === 'uploading' || f.status === 'pending');
  const allDone = !isUploading;

  const overallProgress = totalFiles > 0 
    ? Math.round(files.reduce((acc, f) => acc + f.progress, 0) / totalFiles)
    : 0;

  const getStatusIcon = (status: UploadingFile['status']) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'uploading':
        return (
          <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        );
      default:
        return <div className="w-5 h-5 border-2 border-gray-300 rounded-full" />;
    }
  };

  const getStatusColor = (status: UploadingFile['status']) => {
    switch (status) {
      case 'success':
        return 'bg-green-500';
      case 'error':
        return 'bg-red-500';
      case 'uploading':
        return 'bg-primary-500';
      default:
        return 'bg-gray-300';
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 !mt-0" 
      style={{ marginTop: 0 }}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 w-full max-w-lg !mt-0" 
        style={{ marginTop: 0 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <Upload className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {isUploading ? 'Téléversement en cours...' : 'Téléversement terminé'}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {completedFiles}/{totalFiles} fichier{totalFiles > 1 ? 's' : ''} 
                {failedFiles > 0 && ` • ${failedFiles} erreur${failedFiles > 1 ? 's' : ''}`}
              </p>
            </div>
          </div>
          {allDone && (
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-all"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Overall Progress */}
        {isUploading && (
          <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Progression globale
              </span>
              <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                {overallProgress}%
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* File List */}
        <div className="max-h-80 overflow-y-auto p-4 space-y-3">
          {files.map((uploadingFile) => (
            <div 
              key={uploadingFile.id} 
              className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
            >
              <div className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
                <FileIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate pr-2">
                    {uploadingFile.file.name}
                  </p>
                  {getStatusIcon(uploadingFile.status)}
                </div>
                
                <div className="flex items-center space-x-2">
                  <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-300 ease-out ${getStatusColor(uploadingFile.status)}`}
                      style={{ width: `${uploadingFile.progress}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {uploadingFile.status === 'error' 
                      ? 'Erreur' 
                      : uploadingFile.status === 'success'
                        ? formatBytes(uploadingFile.file.size)
                        : `${uploadingFile.progress}%`
                    }
                  </span>
                </div>
                
                {uploadingFile.error && (
                  <p className="text-xs text-red-500 mt-1 truncate">
                    {uploadingFile.error}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-4 border-t border-gray-200 dark:border-gray-700">
          {isUploading ? (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              Annuler
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Fermer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
