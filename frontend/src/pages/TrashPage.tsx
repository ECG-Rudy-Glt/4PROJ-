import { useEffect, useState } from 'react';
import { fileService } from '@/services/fileService';
import { File } from '@/types';
import { RotateCcw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function TrashPage() {
  const [deletedFiles, setDeletedFiles] = useState<File[]>([]);

  useEffect(() => {
    loadDeletedFiles();
  }, []);

  const loadDeletedFiles = async () => {
    try {
      const { files } = await fileService.getDeletedFiles();
      setDeletedFiles(files);
    } catch (error) {
      toast.error('Échec du chargement de la corbeille');
    }
  };

  const handleRestore = async (fileId: string) => {
    try {
      await fileService.restoreFile(fileId);
      toast.success('Fichier restauré');
      loadDeletedFiles();
    } catch (error) {
      toast.error('Échec de la restauration du fichier');
    }
  };

  const handlePermanentDelete = async (fileId: string) => {
    if (!confirm('Supprimer définitivement ce fichier ? Cette action est irréversible.')) return;

    try {
      await fileService.deleteFile(fileId, true);
      toast.success('Fichier supprimé définitivement');
      loadDeletedFiles();
    } catch (error) {
      toast.error('Échec de la suppression du fichier');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 o';
    const k = 1024;
    const sizes = ['o', 'Ko', 'Mo', 'Go'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Corbeille</h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {deletedFiles.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Nom
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Taille
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Supprimé
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {deletedFiles.map((file) => (
                <tr key={file.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {file.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatBytes(Number(file.size))}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {file.deletedAt && new Date(file.deletedAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleRestore(file.id)}
                      className="text-green-600 hover:text-green-900 mr-3"
                      title="Restaurer"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(file.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Supprimer définitivement"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            La corbeille est vide
          </div>
        )}
      </div>
    </div>
  );
}
