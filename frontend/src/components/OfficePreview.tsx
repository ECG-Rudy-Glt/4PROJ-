import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, Download, FileText, FileSpreadsheet, Presentation } from 'lucide-react';
import { File } from '@/types';
import api from '@/services/api';

interface OfficePreviewProps {
  file: File;
  isDelegatedSession?: boolean;
  onDownload?: () => void;
}

declare global {
  interface Window {
    DocsAPI?: any;
  }
}

// Erreurs OnlyOffice connues sur ARM64 (Mac Apple Silicon)
const ARM64_ERROR_CODES = [-85, -88, -4];

export const OfficePreview: React.FC<OfficePreviewProps> = ({ file, isDelegatedSession = false, onDownload }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isArm64Error, setIsArm64Error] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const docEditorRef = useRef<any>(null);
  const editorId = `office-preview-${file.id}`;

  const getFileIcon = () => {
    if (file.mimeType.includes('spreadsheet') || file.mimeType.includes('excel')) {
      return <FileSpreadsheet className="w-16 h-16 text-green-500" />;
    }
    if (file.mimeType.includes('presentation') || file.mimeType.includes('powerpoint')) {
      return <Presentation className="w-16 h-16 text-orange-500" />;
    }
    return <FileText className="w-16 h-16 text-blue-500" />;
  };

  const handleDownload = async () => {
    try {
      const response = await api.get(`/files/${file.id}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
    }
  };

  // All hooks must be declared before any conditional return (React rules of hooks)
  useEffect(() => {
    // Skip OnlyOffice init entirely in delegated sessions
    if (isDelegatedSession) return;

    let isMounted = true;

    const initViewer = async () => {
      if (isMounted) {
        await loadViewer();
      }
    };

    initViewer();

    return () => {
      isMounted = false;
      if (docEditorRef.current) {
        try {
          docEditorRef.current.destroyEditor();
        } catch (e) {
          console.log('Editor cleanup error:', e);
        }
        docEditorRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id, isDelegatedSession]);

  // Delegated/switch sessions never carry the owner's DEK → OnlyOffice always returns 401.
  // Show a clear UX message instead of crashing.
  if (isDelegatedSession) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-100 dark:bg-gray-900 rounded-lg p-8">
        {getFileIcon()}
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">
          Aperçu Office indisponible
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-center mb-1 max-w-md">
          Ce document est chiffré et ne peut pas être prévisualisé dans une session déléguée.
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-500 text-center mb-5 max-w-md">
          Connectez-vous directement au compte propriétaire pour accéder à la prévisualisation OnlyOffice.
        </p>
        {onDownload && (
          <button
            onClick={onDownload}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Download className="w-5 h-5" />
            Télécharger le fichier
          </button>
        )}
      </div>
    );
  }

  const loadViewer = async () => {
    try {
      // Ne pas recharger si déjà en cours
      if (docEditorRef.current) {
        console.log('Editor already exists, skipping reload');
        return;
      }

      setLoading(true);
      setError(null);

      // Charger la configuration OnlyOffice en mode VIEW
      const configResponse = await api.get(`/onlyoffice/config/${file.id}`, {
        params: { mode: 'view' },
      });

      const { config, token, onlyofficeUrl } = configResponse.data;

      // Charger le script OnlyOffice si ce n'est pas déjà fait
      if (!window.DocsAPI) {
        await loadOnlyOfficeScript(onlyofficeUrl);
      }

      // Attendre un peu pour s'assurer que le script est bien chargé
      await new Promise(resolve => setTimeout(resolve, 100));

      // Créer l'éditeur OnlyOffice - utiliser la config telle quelle (le token est signé avec)
      if (editorRef.current && window.DocsAPI && !docEditorRef.current) {
        const viewConfig = {
          ...config,
          token,
          events: {
            onDocumentReady: () => {
              console.log('Document preview ready');
              setLoading(false);
            },
            onError: (event: any) => {
              console.error('OnlyOffice preview error:', event);
              const errorCode = event?.data?.errorCode;

              // Vérifier si c'est une erreur ARM64 connue
              if (ARM64_ERROR_CODES.includes(errorCode)) {
                setIsArm64Error(true);
                setError('Ce type de fichier ne peut pas être prévisualisé sur cette architecture (ARM64/Apple Silicon).');
              } else {
                setError(event?.data?.errorDescription || 'Erreur lors du chargement de la prévisualisation');
              }
              setLoading(false);
            },
          },
        };

        console.log('Creating OnlyOffice editor with config:', editorId);
        docEditorRef.current = new window.DocsAPI.DocEditor(editorId, viewConfig);
      }
    } catch (err: any) {
      console.error('Error loading preview:', err);
      setError(err.response?.data?.error || 'Erreur lors du chargement de la prévisualisation');
      setLoading(false);
    }
  };

  const loadOnlyOfficeScript = (scriptUrl: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (window.DocsAPI) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = scriptUrl;
      script.type = 'text/javascript';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load OnlyOffice script'));
      document.head.appendChild(script);
    });
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-100 dark:bg-gray-900 rounded-lg p-8">
        {isArm64Error ? (
          <>
            {getFileIcon()}
            <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">
              Prévisualisation non disponible
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-center mb-4 max-w-md">
              Les fichiers Excel et PowerPoint ne peuvent pas être prévisualisés sur Mac Apple Silicon.
              <br />
              <span className="text-sm text-gray-500">
                (Limitation connue d'OnlyOffice sur architecture ARM64)
              </span>
            </p>
            <button
              onClick={handleDownload}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Download className="w-5 h-5" />
              Télécharger le fichier
            </button>
          </>
        ) : (
          <>
            <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
            <p className="text-gray-700 dark:text-gray-300 text-center">{error}</p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="relative w-full h-[70vh] bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900 z-10">
          <div className="text-center">
            <Loader2 className="w-10 h-10 text-primary-600 animate-spin mx-auto mb-3" />
            <p className="text-gray-600 dark:text-gray-400">Chargement du document...</p>
          </div>
        </div>
      )}
      <div
        id={editorId}
        ref={editorRef}
        className="w-full h-full"
      />
    </div>
  );
};
