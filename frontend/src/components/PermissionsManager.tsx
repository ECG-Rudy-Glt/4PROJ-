import { useState, useEffect } from 'react';
import { Shield, Eye, Edit3, Trash2, Share2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { shareService } from '@/services/shareService';

interface PermissionsManagerProps {
  shareId: string;
  initialPermissions: {
    canRead: boolean;
    canWrite: boolean;
    canDelete: boolean;
    canShare: boolean;
  };
  onUpdate?: () => void;
  readOnly?: boolean;
}

export default function PermissionsManager({
  shareId,
  initialPermissions,
  onUpdate,
  readOnly = false,
}: PermissionsManagerProps) {
  const [permissions, setPermissions] = useState(initialPermissions);
  const [isUpdating, setIsUpdating] = useState(false);

  // Update permissions when initialPermissions changes
  useEffect(() => {
    setPermissions(initialPermissions);
  }, [initialPermissions]);

  const handleToggle = async (permission: keyof typeof permissions) => {
    if (readOnly) return;

    const newPermissions = {
      ...permissions,
      [permission]: !permissions[permission],
    };

    // Validation: canRead doit toujours être true si d'autres permissions sont actives
    if (permission === 'canRead' && !newPermissions.canRead) {
      if (newPermissions.canWrite || newPermissions.canDelete || newPermissions.canShare) {
        toast.error('La permission de lecture est requise pour les autres permissions');
        return;
      }
    }

    setPermissions(newPermissions);

    setIsUpdating(true);
    try {
      await shareService.updateSharedFolderPermissions(shareId, {
        [permission]: newPermissions[permission],
      });
      toast.success('Permissions mises à jour');
      if (onUpdate) onUpdate();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Échec de la mise à jour');
      // Revert on error
      setPermissions(permissions);
    } finally {
      setIsUpdating(false);
    }
  };

  const permissionItems = [
    {
      key: 'canRead' as const,
      icon: Eye,
      label: 'Consulter',
      description: 'Peut voir les fichiers',
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-50 dark:bg-blue-900/20',
    },
    {
      key: 'canWrite' as const,
      icon: Edit3,
      label: 'Modifier',
      description: 'Peut uploader et modifier des fichiers',
      color: 'text-green-600 dark:text-green-400',
      bgColor: 'bg-green-50 dark:bg-green-900/20',
    },
    {
      key: 'canDelete' as const,
      icon: Trash2,
      label: 'Supprimer',
      description: 'Peut supprimer des fichiers',
      color: 'text-red-600 dark:text-red-400',
      bgColor: 'bg-red-50 dark:bg-red-900/20',
    },
    {
      key: 'canShare' as const,
      icon: Share2,
      label: 'Partager',
      description: 'Peut repartager avec d\'autres utilisateurs',
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-50 dark:bg-purple-900/20',
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Permissions
        </h3>
      </div>

      <div className="space-y-2">
        {permissionItems.map((item) => {
          const Icon = item.icon;
          const isEnabled = permissions[item.key];

          return (
            <div
              key={item.key}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
                isEnabled
                  ? `${item.bgColor} border-current ${item.color}`
                  : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700'
              } ${readOnly ? 'cursor-not-allowed' : 'cursor-pointer hover:shadow-sm'}`}
              onClick={() => !readOnly && handleToggle(item.key)}
            >
              <div
                className={`p-2 rounded-lg ${
                  isEnabled
                    ? item.bgColor
                    : 'bg-gray-100 dark:bg-gray-700'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isEnabled
                      ? item.color
                      : 'text-gray-400 dark:text-gray-500'
                  }`}
                />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p
                    className={`text-sm font-medium ${
                      isEnabled
                        ? 'text-gray-900 dark:text-white'
                        : 'text-gray-600 dark:text-gray-400'
                    }`}
                  >
                    {item.label}
                  </p>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {item.description}
                </p>
              </div>

              <div className="flex-shrink-0">
                <div
                  className={`relative inline-block w-11 h-6 transition-colors rounded-full ${
                    isEnabled
                      ? 'bg-primary-600'
                      : 'bg-gray-300 dark:bg-gray-600'
                  } ${isUpdating ? 'opacity-50' : ''}`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 inline-block w-5 h-5 bg-white rounded-full transition-transform ${
                      isEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!readOnly && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-xs text-blue-800 dark:text-blue-300">
            <strong>Info :</strong> La permission de lecture est requise pour activer les autres permissions.
          </p>
        </div>
      )}
    </div>
  );
}
