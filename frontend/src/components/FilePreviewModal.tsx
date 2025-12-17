import { X, Download, MessageCircle, History, Edit3 } from 'lucide-react';
import { File } from '@/types';
import { fileService } from '@/services/fileService';
import { useState, useEffect } from 'react';
import CommentsPanel from './CommentsPanel';
import VersionHistory from './VersionHistory';
import { commentService } from '@/services/commentService';
import { DocumentEditor } from './DocumentEditor';
import { OfficePreview } from './OfficePreview';
import MarkdownPreview from './MarkdownPreview';

interface FilePreviewModalProps {
  file: File;
  onClose: () => void;
  isShared?: boolean;
}

// Liste des types MIME éditables avec OnlyOffice
const editableMimeTypes = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc
  'application/vnd.oasis.opendocument.text', // .odt
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
  'application/vnd.oasis.opendocument.spreadsheet', // .ods
  'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
  'application/vnd.ms-powerpoint', // .ppt
  'application/vnd.oasis.opendocument.presentation', // .odp
];

const canEditDocument = (mimeType: string) => editableMimeTypes.includes(mimeType);

export default function FilePreviewModal({ file, onClose, isShared = false }: FilePreviewModalProps) {
  const [activePanel, setActivePanel] = useState<'comments' | 'versions'>('comments'); // Onglet actif
  const [commentCount, setCommentCount] = useState(0);
  const [showDocumentEditor, setShowDocumentEditor] = useState(false);
  
  // Get actual write permissions from file object (set by parent component for shared files)
  const canWrite = isShared && (file as any).canWrite !== undefined ? (file as any).canWrite : !isShared;

  useEffect(() => {
    loadCommentCount();
  }, [file.id]);

  const loadCommentCount = async () => {
    try {
      const { count } = await commentService.countFileComments(file.id);
      setCommentCount(count);
    } catch (error) {
      console.error('Erreur chargement nombre commentaires:', error);
    }
  };

  const getFileType = (mimeType: string): string => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType === 'application/pdf') return 'pdf';
    if (mimeType === 'text/markdown' || mimeType === 'text/x-markdown') return 'markdown';
    if (mimeType.startsWith('text/') ||
        mimeType === 'application/json' ||
        mimeType === 'application/javascript' ||
        mimeType === 'application/xml') return 'text';
    return 'other';
  };

  // Also check file extension for markdown
  const isMarkdownFile = file.name.toLowerCase().endsWith('.md') || 
                         file.name.toLowerCase().endsWith('.markdown');

  const fileType = isMarkdownFile ? 'markdown' : getFileType(file.mimeType);
  const streamUrl = isShared ? fileService.getSharedFileStreamUrl(file.id) : fileService.getStreamUrl(file.id);
  const downloadUrl = isShared ? fileService.getSharedFileDownloadUrl(file.id) : fileService.getDownloadUrl(file.id);

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

      case 'markdown':
        return <MarkdownPreview file={file} isShared={isShared} />;

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
        // Pour les documents Office, afficher la prévisualisation avec OnlyOffice
        if (canEditDocument(file.mimeType)) {
          return <OfficePreview file={file} />;
        }
        
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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl w-full max-w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
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
            {canEditDocument(file.mimeType) && (
              <button
                onClick={() => setShowDocumentEditor(true)}
                className="p-2 text-gray-600 dark:text-gray-300 hover:bg-primary-100 dark:hover:bg-primary-900/30 hover:text-primary-600 dark:hover:text-primary-300 rounded-lg"
                title="Éditer le document"
              >
                <Edit3 className="w-5 h-5" />
              </button>
            )}
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

        {/* Content with Preview and Side Panel */}
        <div className="flex-1 overflow-hidden flex">
          {/* Preview Content */}
          <div className="w-2/3 overflow-auto p-4 border-r border-gray-200 dark:border-gray-700">
            {renderPreview()}
          </div>

          {/* Right Side Panel with Tabs */}
          <div className="w-1/3 overflow-hidden flex flex-col">
            {/* Tab Headers */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setActivePanel('comments')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                  activePanel === 'comments'
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  <span>Commentaires</span>
                  {commentCount > 0 && (
                    <span className="bg-primary-600 text-white text-xs font-bold rounded-full px-2 py-0.5">
                      {commentCount > 9 ? '9+' : commentCount}
                    </span>
                  )}
                </div>
                {activePanel === 'comments' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400" />
                )}
              </button>
              <button
                onClick={() => setActivePanel('versions')}
                className={`flex-1 px-4 py-3 text-sm font-medium transition-colors relative ${
                  activePanel === 'versions'
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <History className="w-4 h-4" />
                  <span>Versions</span>
                </div>
                {activePanel === 'versions' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400" />
                )}
              </button>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-hidden">
              {activePanel === 'comments' ? (
                <CommentsPanel 
                  fileId={file.id} 
                  onCommentCountChange={loadCommentCount}
                  isShared={isShared}
                  canWrite={canWrite}
                />
              ) : (
                <div className="h-full overflow-y-auto p-4">
                  <VersionHistory 
                    fileId={file.id} 
                    onVersionRestored={() => window.location.reload()}
                    isShared={isShared}
                    canWrite={canWrite}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Document Editor Modal */}
      {showDocumentEditor && (
        <DocumentEditor
          file={file}
          onClose={() => setShowDocumentEditor(false)}
        />
      )}
    </div>
  );
}
