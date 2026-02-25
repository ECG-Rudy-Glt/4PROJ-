import { useEffect, useRef, useState } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { File } from '@/types';
import api from '@/services/api';
import toast from 'react-hot-toast';

interface DocumentEditorProps {
  file: File;
  onClose: () => void;
}

declare global {
  interface Window {
    DocsAPI?: any;
  }
}

export const DocumentEditor: React.FC<DocumentEditorProps> = ({ file, onClose }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const docEditorRef = useRef<any>(null);

  useEffect(() => {
    let isMounted = true;

    const initEditor = async () => {
      if (isMounted) {
        await loadEditor();
      }
    };

    initEditor();

    return () => {
      isMounted = false;
      // Cleanup: destroy editor on unmount
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
  }, [file.id]);

  const loadEditor = async () => {
    try {
      // Ne pas recharger si déjà en cours
      if (docEditorRef.current) {
        console.log('Editor already exists, skipping reload');
        return;
      }

      setLoading(true);
      setError(null);

      // Vérifier si le fichier peut être édité
      const canEditResponse = await api.get(`/onlyoffice/can-edit/${file.id}`);
      const { canEdit, mode } = canEditResponse.data;

      if (!canEdit) {
        setError('Ce type de fichier ne peut pas être édité');
        setLoading(false);
        return;
      }

      // Charger la configuration OnlyOffice
      const configResponse = await api.get(`/onlyoffice/config/${file.id}`, {
        params: { mode },
      });

      const { config, token, onlyofficeUrl } = configResponse.data;

      // Charger le script OnlyOffice si ce n'est pas déjà fait
      if (!window.DocsAPI) {
        await loadOnlyOfficeScript(onlyofficeUrl);
      }

      // Attendre un peu pour s'assurer que le script est bien chargé
      await new Promise(resolve => setTimeout(resolve, 100));

      // Créer l'éditeur OnlyOffice
      if (editorRef.current && window.DocsAPI && !docEditorRef.current) {
        // Ajouter le token à la configuration
        const editorConfig = {
          ...config,
          token,
          events: {
            onDocumentReady: () => {
              console.log('Document ready');
              setLoading(false);
            },
            onError: (event: any) => {
              console.error('OnlyOffice error:', event);
              setError('Erreur lors du chargement de l\'éditeur');
              setLoading(false);
            },
            onWarning: (event: any) => {
              console.warn('OnlyOffice warning:', event);
            },
            onInfo: (event: any) => {
              console.log('OnlyOffice info:', event);
            },
          },
        };

        console.log('Creating OnlyOffice editor');
        docEditorRef.current = new window.DocsAPI.DocEditor(editorRef.current.id, editorConfig);
      }
    } catch (err: any) {
      console.error('Error loading editor:', err);
      setError(err.response?.data?.error || 'Erreur lors du chargement de l\'éditeur');
      setLoading(false);
      toast.error('Impossible de charger l\'éditeur');
    }
  };

  const loadOnlyOfficeScript = (scriptUrl: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = scriptUrl;
      script.type = 'text/javascript';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load OnlyOffice script'));
      document.head.appendChild(script);
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-90 flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 px-3 py-1.5 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <h2 className="text-sm font-medium text-white truncate max-w-md">{file.name}</h2>
          {loading && (
            <div className="flex items-center gap-1 text-gray-400">
              <Loader2 className="w-3 h-3 animate-spin" />
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          title="Fermer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Editor Container */}
      <div className="flex-1 relative overflow-hidden">
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
            <div className="text-center max-w-md px-6">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Erreur</h3>
              <p className="text-gray-400 mb-6">{error}</p>
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        ) : (
          <div
            id="onlyoffice-editor"
            ref={editorRef}
            className="w-full h-full"
            style={{ minHeight: '100%' }}
          />
        )}

        {loading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 bg-opacity-75">
            <div className="text-center">
              <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
              <p className="text-white text-lg">Chargement de l'éditeur...</p>
              <p className="text-gray-400 text-sm mt-2">Veuillez patienter</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
