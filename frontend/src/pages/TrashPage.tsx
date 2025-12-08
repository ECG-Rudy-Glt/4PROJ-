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
      toast.error('Failed to load trash');
    }
  };

  const handleRestore = async (fileId: string) => {
    try {
      await fileService.restoreFile(fileId);
      toast.success('File restored');
      loadDeletedFiles();
    } catch (error) {
      toast.error('Failed to restore file');
    }
  };

  const handlePermanentDelete = async (fileId: string) => {
    if (!confirm('Permanently delete this file? This cannot be undone.')) return;

    try {
      await fileService.deleteFile(fileId, true);
      toast.success('File permanently deleted');
      loadDeletedFiles();
    } catch (error) {
      toast.error('Failed to delete file');
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Trash</h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {deletedFiles.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Size
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Deleted
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
                      title="Restore"
                    >
                      <RotateCcw className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handlePermanentDelete(file.id)}
                      className="text-red-600 hover:text-red-900"
                      title="Delete permanently"
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
            Trash is empty
          </div>
        )}
      </div>
    </div>
  );
}
