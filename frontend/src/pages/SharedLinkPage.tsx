import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { shareService } from '@/services/shareService';
import { Download, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SharedLinkPage() {
  const { token } = useParams<{ token: string }>();
  const [file, setFile] = useState<any>(null);
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (token) {
      loadSharedFile();
    }
  }, [token]);

  const loadSharedFile = async (pwd?: string) => {
    try {
      const data = await shareService.getSharedFile(token!, pwd);
      setFile(data.file);
      setNeedsPassword(false);
    } catch (error: any) {
      if (error.response?.data?.error === 'Password required') {
        setNeedsPassword(true);
      } else {
        toast.error(error.response?.data?.error || 'Failed to load file');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadSharedFile(password);
  };

  const handleDownload = () => {
    window.location.href = shareService.getSharedFileDownloadUrl(
      token!,
      needsPassword ? password : undefined
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (needsPassword && !file) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg">
          <div className="text-center mb-6">
            <Lock className="w-12 h-12 text-primary-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              Password Required
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              This file is password protected
            </p>
          </div>
          <form onSubmit={handlePasswordSubmit} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
              required
            />
            <button
              type="submit"
              className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Access File
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!file) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            File not found
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            This link may have expired or been deleted
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="max-w-2xl w-full bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg">
        <div className="text-center mb-6">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {file.name}
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Shared file • {(file.size / 1024 / 1024).toFixed(2)} MB
          </p>
        </div>
        <button
          onClick={handleDownload}
          className="w-full flex items-center justify-center py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Download className="w-5 h-5 mr-2" />
          Download File
        </button>
      </div>
    </div>
  );
}
