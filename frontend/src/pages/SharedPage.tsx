import { useEffect, useState } from 'react';
import { shareService } from '@/services/shareService';
import { SharedLink, SharedFolder } from '@/types';
import { Link2, Trash2, Users } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SharedPage() {
  const [shareLinks, setShareLinks] = useState<SharedLink[]>([]);
  const [sharedFolders, setSharedFolders] = useState<SharedFolder[]>([]);

  useEffect(() => {
    loadShared();
  }, []);

  const loadShared = async () => {
    try {
      const [linksData, foldersData] = await Promise.all([
        shareService.listShareLinks(),
        shareService.listSharedWithMe(),
      ]);
      setShareLinks(linksData.shareLinks);
      setSharedFolders(foldersData.sharedFolders);
    } catch (error) {
      toast.error('Failed to load shared items');
    }
  };

  const handleDeleteLink = async (linkId: string) => {
    if (!confirm('Delete this share link?')) return;

    try {
      await shareService.deleteShareLink(linkId);
      toast.success('Share link deleted');
      loadShared();
    } catch (error) {
      toast.error('Failed to delete link');
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Shared</h1>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Link2 className="w-5 h-5 mr-2" />
          My Share Links
        </h2>
        <div className="space-y-3">
          {shareLinks.length > 0 ? (
            shareLinks.map((link) => (
              <div
                key={link.id}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {link.fileName}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {link.url}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Downloads: {link.downloads}
                    {link.maxDownloads && ` / ${link.maxDownloads}`}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteLink(link.id)}
                  className="ml-4 p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900 rounded-lg"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No share links yet
            </p>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
          <Users className="w-5 h-5 mr-2" />
          Shared With Me
        </h2>
        <div className="space-y-3">
          {sharedFolders.length > 0 ? (
            sharedFolders.map((folder) => (
              <div
                key={folder.id}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Folder from {folder.sharedBy?.email}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {folder.canEdit ? 'Can edit' : 'View only'}
                  </p>
                </div>
              </div>
            ))
          ) : (
            <p className="text-gray-500 dark:text-gray-400 text-center py-8">
              No folders shared with you
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
