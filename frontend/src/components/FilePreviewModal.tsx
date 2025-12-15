import { X, Download } from 'lucide-react';
import { File } from '@/types';
import { fileService } from '@/services/fileService';

interface FilePreviewModalProps {
  file: File;
  onClose: () => void;
}

export default function FilePreviewModal({ file, onClose }: FilePreviewModalProps) {
  const getFileType = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType.startsWith('text/') ||
        mimeType === 'application/json' ||
        mimeType === 'application/javascript' ||
        mimeType === 'application/xml') return 'text';
    return 'other';
  };

  const fileType = getFileType(file.mimeType);
  const streamUrl = fileService.getStreamUrl(file.id);
  const downloadUrl = fileService.getDownloadUrl(file.id);

  const renderPreview = () => {
    switch (fileType) {
      case 'image':
        return (
          <div className="flex items-center justify-center p-4 bg-gray-100 dark:bg-gray-900 rounded-lg">
            <img
              src={streamUrl}
              alt={file.name}
              className="max-w-full max-h-[70vh] object-contain rounded"
            />
          </div>
        );

      case 'video':
        return (
          <div className="bg-black rounded-lg overflow-hidden">
            <video
              controls
              className="w-full max-h-[70vh]"
              preload="metadata"
            >
              <source src={streamUrl} type={file.mimeType} />
              Votre navigateur ne supporte pas la balise vidéo.
            </video>
          </div>
        );

      case 'audio':
        return (
          <div className="flex flex-col items-center justify-center p-8 bg-gray-100 dark:bg-gray-900 rounded-lg">
            <div className="w-full max-w-md">
              <div className="mb-4 p-6 bg-white dark:bg-gray-800 rounded-lg text-center">
                <svg
                  className="w-20 h-20 mx-auto mb-3 text-primary-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                </svg>
                <p className="text-lg font-medium text-gray-900 dark:text-white">
                  {file.name}
                </p>
              </div>
              <audio controls className="w-full">
                <source src={streamUrl} type={file.mimeType} />
                Votre navigateur ne supporte pas la balise audio.
              </audio>
            </div>
          </div>
        );

      case 'pdf':
        return (
          <div className="bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
            <iframe
              src={`${streamUrl}#toolbar=1`}
              className="w-full h-[70vh]"
              title={file.name}
            />
          </div>
        );

      case 'text':
        return (
          <div className="bg-gray-100 dark:bg-gray-900 rounded-lg p-4">
            <iframe
              src={streamUrl}
              className="w-full h-[70vh] bg-white dark:bg-gray-800 rounded"
              title={file.name}
            />
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center p-12 bg-gray-100 dark:bg-gray-900 rounded-lg">
            <svg
              className="w-24 h-24 mb-4 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Aperçu non disponible
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              {file.mimeType}
            </p>
            <button
              onClick={() => window.open(downloadUrl)}
              className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Download className="w-4 h-4 mr-2" />
              Télécharger le fichier
            </button>
          </div>
        );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75 p-4 !mt-0" style={{ marginTop: 0 }}>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">
              {file.name}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {(Number(file.size) / (1024 * 1024)).toFixed(2)} Mo • {file.mimeType}
            </p>
          </div>
          <div className="flex items-center space-x-2 ml-4">
            <button
              onClick={() => window.open(downloadUrl)}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              title="Télécharger"
            >
              <Download className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              title="Fermer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-auto p-4">
          {renderPreview()}
        </div>
      </div>
    </div>
  );
}
