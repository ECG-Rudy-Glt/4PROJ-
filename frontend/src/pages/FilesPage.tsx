import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useFileStore } from '@/stores/useFileStore';
import { Upload, FolderPlus, Download, Trash2, Eye, Share2, Copy, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { fileService } from '@/services/fileService';
import { shareService } from '@/services/shareService';
import { File } from '@/types';
import FilePreviewModal from '@/components/FilePreviewModal';

export default function FilesPage() {
  const { folderId } = useParams();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search');
  const { files, folders, loadContent, uploadFile, createFolder, deleteFile } = useFileStore();
  const [searchResults, setSearchResults] = useState<File[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [shareLink, setShareLink] = useState('');
  const [sharePassword, setSharePassword] = useState('');
  const [shareExpiry, setShareExpiry] = useState('');
  const [shareMaxDownloads, setShareMaxDownloads] = useState('');
  const [newFolderName, setNewFolderName] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (searchQuery) {
      handleSearch(searchQuery);
    } else {
      loadContent(folderId);
      setSearchResults([]);
    }
  }, [folderId, searchQuery]);

  const handleSearch = async (query: string) => {
    setIsSearching(true);
    try {
      const result = await fileService.searchFiles(query);
      setSearchResults(result.files);
    } catch (error: any) {
      toast.error('Search failed');
    } finally {
      setIsSearching(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        await uploadFile(file, folderId);
      }
      toast.success('Files uploaded successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      await createFolder(newFolderName, folderId);
      toast.success('Folder created');
      setShowNewFolderModal(false);
      setNewFolderName('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create folder');
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm('Move to trash?')) return;

    try {
      await deleteFile(fileId);
      toast.success('Moved to trash');
    } catch (error: any) {
      toast.error('Failed to delete');
    }
  };

  const handleShareClick = (file: File) => {
    setSelectedFile(file);
    setShareLink('');
    setSharePassword('');
    setShareExpiry('');
    setShareMaxDownloads('');
    setShowShareModal(true);
  };

  const handlePreviewClick = (file: File) => {
    setPreviewFile(file);
    setShowPreviewModal(true);
  };

  const handleCreateShareLink = async () => {
    if (!selectedFile) return;

    try {
      const options: any = {};
      if (sharePassword) options.password = sharePassword;
      if (shareExpiry) options.expiresAt = new Date(shareExpiry).toISOString();
      if (shareMaxDownloads) options.maxDownloads = parseInt(shareMaxDownloads);

      const result = await shareService.createShareLink(selectedFile.id, options);
      setShareLink(result.shareLink.url);
      toast.success('Share link created!');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create share link');
    }
  };

  const handleCopyShareLink = () => {
    navigator.clipboard.writeText(shareLink);
    toast.success('Link copied to clipboard!');
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;

    setIsUploading(true);
    try {
      for (const file of files) {
        await uploadFile(file, folderId);
      }
      toast.success('Files uploaded successfully');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Upload failed');
    } finally {
      setIsUploading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const displayFiles = searchQuery ? searchResults : files;

  return (
    <div
      className="space-y-6 relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag and Drop Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 bg-primary-600 bg-opacity-90 flex items-center justify-center pointer-events-none">
          <div className="text-center text-white">
            <Upload className="w-20 h-20 mx-auto mb-4 animate-bounce" />
            <p className="text-2xl font-bold">Drop files to upload</p>
            <p className="text-lg mt-2">Release to start uploading</p>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {searchQuery ? `Search: "${searchQuery}"` : 'My Files'}
        </h1>
        {!searchQuery && (
          <div className="flex space-x-3">
            <button
              onClick={() => setShowNewFolderModal(true)}
              className="flex items-center px-4 py-2 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <FolderPlus className="w-5 h-5 mr-2" />
              New Folder
            </button>
            <label className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 cursor-pointer">
              <Upload className="w-5 h-5 mr-2" />
              {isUploading ? 'Uploading...' : 'Upload'}
              <input
                type="file"
                multiple
                onChange={handleFileUpload}
                className="hidden"
                disabled={isUploading}
                accept="*/*"
              />
            </label>
          </div>
        )}
      </div>

      {isSearching && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          Searching...
        </div>
      )}

      {/* Folders */}
      {!searchQuery && folders.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {folders.map((folder) => (
            <a
              key={folder.id}
              href={`/files/${folder.id}`}
              className="flex flex-col items-center p-4 bg-white dark:bg-gray-800 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <svg className="w-16 h-16 text-primary-600 mb-2" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              </svg>
              <span className="text-sm text-center text-gray-900 dark:text-white font-medium truncate w-full">
                {folder.name}
              </span>
            </a>
          ))}
        </div>
      )}

      {/* Files */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Size
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Modified
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {displayFiles.map((file) => (
              <tr key={file.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap">
                  <button
                    onClick={() => handlePreviewClick(file)}
                    className="flex items-center hover:bg-gray-50 dark:hover:bg-gray-700 rounded px-2 py-1 -mx-2 transition-colors"
                  >
                    <Eye className="w-5 h-5 text-gray-400 mr-3" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {file.name}
                    </span>
                  </button>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {formatBytes(Number(file.size))}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                  {new Date(file.updatedAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => handleShareClick(file)}
                    className="text-primary-600 hover:text-primary-900 mr-3"
                    title="Share"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => window.open(fileService.getDownloadUrl(file.id))}
                    className="text-primary-600 hover:text-primary-900 mr-3"
                    title="Download"
                  >
                    <Download className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(file.id)}
                    className="text-red-600 hover:text-red-900"
                    title="Delete"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {displayFiles.length === 0 && folders.length === 0 && !isSearching && (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            {searchQuery ? 'No files found' : 'No files or folders here'}
          </div>
        )}
      </div>

      {/* New Folder Modal */}
      {showNewFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Create New Folder
            </h3>
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
              onKeyPress={(e) => e.key === 'Enter' && handleCreateFolder()}
            />
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => {
                  setShowNewFolderModal(false);
                  setNewFolderName('');
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateFolder}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && selectedFile && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Share: {selectedFile.name}
              </h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {!shareLink ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Password (optional)
                  </label>
                  <input
                    type="password"
                    value={sharePassword}
                    onChange={(e) => setSharePassword(e.target.value)}
                    placeholder="Leave empty for no password"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Expiration Date (optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={shareExpiry}
                    onChange={(e) => setShareExpiry(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Max Downloads (optional)
                  </label>
                  <input
                    type="number"
                    value={shareMaxDownloads}
                    onChange={(e) => setShareMaxDownloads(e.target.value)}
                    placeholder="Unlimited"
                    min="1"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                  />
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    onClick={() => setShowShareModal(false)}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateShareLink}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                  >
                    Create Link
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <p className="text-sm text-green-800 dark:text-green-200 mb-2">
                    Share link created successfully!
                  </p>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={shareLink}
                      readOnly
                      className="flex-1 px-3 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm"
                    />
                    <button
                      onClick={handleCopyShareLink}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center"
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => setShowShareModal(false)}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* File Preview Modal */}
      {showPreviewModal && previewFile && (
        <FilePreviewModal
          file={previewFile}
          onClose={() => setShowPreviewModal(false)}
        />
      )}
    </div>
  );
}
