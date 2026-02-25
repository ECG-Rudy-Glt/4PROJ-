import { useState, useEffect, useRef } from 'react';
import { X, Mail, Users, Eye, Edit3, Shield, Copy, Check, Link as LinkIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { shareService } from '@/services/shareService';
import { File as FileType, SharedFile } from '@/types';
import PermissionsManager from './PermissionsManager';
import api from '@/services/api';

interface ShareFileModalProps {
  file: FileType;
  onClose: () => void;
}

interface UserSuggestion {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

type PermissionTemplate = 'viewer' | 'editor' | 'admin';

export const ShareFileModal: React.FC<ShareFileModalProps> = ({ file, onClose }) => {
  const [email, setEmail] = useState('');
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [sharedWith, setSharedWith] = useState<SharedFile[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PermissionTemplate>('viewer');
  const [customPermissions, setCustomPermissions] = useState({
    canRead: true,
    canWrite: false,
    canDelete: false,
    canShare: false,
  });
  const [inviteLink, setInviteLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  const searchTimeoutRef = useRef<number | undefined>();

  useEffect(() => {
    loadSharedWith();
    generateInviteLink();
  }, [file.id]);

  useEffect(() => {
    if (email.length >= 2) {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }

      searchTimeoutRef.current = window.setTimeout(() => {
        searchUsers(email);
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [email]);

  const searchUsers = async (query: string) => {
    try {
      const { data } = await api.get(`/users/search?query=${encodeURIComponent(query)}&limit=5`);
      setSuggestions(data.users || []);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Erreur recherche utilisateurs:', error);
    }
  };

  const loadSharedWith = async () => {
    try {
      const { shares } = await shareService.getFileShares(file.id);
      setSharedWith(shares);
    } catch (error: any) {
      console.error('Erreur chargement partages:', error);
    }
  };

  const generateInviteLink = () => {
    const link = `${window.location.origin}/files/${file.id}`;
    setInviteLink(link);
  };

  const applyTemplate = (template: PermissionTemplate) => {
    setSelectedTemplate(template);
    switch (template) {
      case 'viewer':
        setCustomPermissions({
          canRead: true,
          canWrite: false,
          canDelete: false,
          canShare: false,
        });
        break;
      case 'editor':
        setCustomPermissions({
          canRead: true,
          canWrite: true,
          canDelete: false,
          canShare: false,
        });
        break;
      case 'admin':
        setCustomPermissions({
          canRead: true,
          canWrite: true,
          canDelete: true,
          canShare: true,
        });
        break;
    }
  };

  const handleShare = async () => {
    if (!email.trim()) {
      toast.error('Veuillez entrer un email');
      return;
    }

    setIsSharing(true);
    try {
      const response = await shareService.shareFile(file.id, email.trim(), customPermissions);
      if (response && response.isNewUser) {
        toast.success(`Invitation envoyée à ${email}`);
      } else {
        toast.success(`Fichier partagé avec ${email}`);
      }
      setEmail('');
      setSuggestions([]);
      setShowSuggestions(false);
      loadSharedWith();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Échec du partage');
    } finally {
      setIsSharing(false);
    }
  };

  const handleRemoveShare = async (shareId: string, userEmail: string) => {
    if (!confirm(`Retirer l'accès de ${userEmail} ?`)) return;

    try {
      await shareService.removeSharedFile(shareId);
      toast.success('Accès retiré');
      loadSharedWith();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Échec de la suppression');
    }
  };

  const handleSelectSuggestion = (user: UserSuggestion) => {
    setEmail(user.email);
    setShowSuggestions(false);
    setSuggestions([]);
  };

  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink);
    setLinkCopied(true);
    toast.success('Lien copié !');
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const getUserDisplayName = (user: any) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email.split('@')[0];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm !mt-0">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
              <Users className="w-6 h-6 text-primary-600 dark:text-primary-300" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Partager "{file.name}"
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Invitez des personnes à collaborer
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {/* Section 1: Templates de permissions rapides */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Templates rapides
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => applyTemplate('viewer')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  selectedTemplate === 'viewer'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-blue-300'
                }`}
              >
                <Eye className="w-5 h-5 mx-auto mb-1 text-blue-600 dark:text-blue-400" />
                <p className="text-sm font-medium text-gray-900 dark:text-white">Lecteur</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Lecture seule</p>
              </button>

              <button
                onClick={() => applyTemplate('editor')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  selectedTemplate === 'editor'
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-green-300'
                }`}
              >
                <Edit3 className="w-5 h-5 mx-auto mb-1 text-green-600 dark:text-green-400" />
                <p className="text-sm font-medium text-gray-900 dark:text-white">Éditeur</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Modifier fichier</p>
              </button>

              <button
                onClick={() => applyTemplate('admin')}
                className={`p-3 rounded-lg border-2 transition-all ${
                  selectedTemplate === 'admin'
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                }`}
              >
                <Shield className="w-5 h-5 mx-auto mb-1 text-purple-600 dark:text-purple-400" />
                <p className="text-sm font-medium text-gray-900 dark:text-white">Admin</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">Contrôle total</p>
              </button>
            </div>
          </div>

          {/* Section 2: Permissions personnalisées */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <PermissionsManager
              shareId=""
              initialPermissions={customPermissions}
              onUpdate={() => {}}
              readOnly={true}
            />
          </div>

          {/* Section 3: Inviter par email avec autocomplete */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Inviter par email
            </h3>
            <div className="relative">
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleShare()}
                    placeholder="nom@exemple.com"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                  />

                  {/* Autocomplete suggestions */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {suggestions.map((user) => (
                        <button
                          key={user.id}
                          onClick={() => handleSelectSuggestion(user)}
                          className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors flex items-center gap-3"
                        >
                          <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
                            <span className="text-sm font-medium text-primary-600 dark:text-primary-300">
                              {user.email[0].toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                              {getUserDisplayName(user)}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                              {user.email}
                            </p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={handleShare}
                  disabled={isSharing || !email.trim()}
                  className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isSharing ? 'Envoi...' : 'Inviter'}
                </button>
              </div>
            </div>
          </div>

          {/* Section 4: Lien d'invitation */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              Ou partager via lien
            </h3>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={inviteLink}
                  readOnly
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm"
                />
              </div>
              <button
                onClick={copyInviteLink}
                className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium flex items-center gap-2"
              >
                {linkCopied ? (
                  <>
                    <Check className="w-5 h-5 text-green-600" />
                    <span className="text-green-600">Copié</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    <span>Copier</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Toute personne avec ce lien pourra accéder au fichier
            </p>
          </div>

          {/* Section 5: Liste des personnes ayant accès */}
          {sharedWith.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Personnes ayant accès ({sharedWith.length})
              </h3>
              <div className="space-y-2">
                {sharedWith.map((share) => (
                  <div
                    key={share.id}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                        <span className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
                          {share.sharedWith?.email[0].toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {getUserDisplayName(share.sharedWith)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {share.sharedWith?.email}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
                        {share.canWrite && <Edit3 className="w-3 h-3" />}
                        {share.canDelete && <X className="w-3 h-3" />}
                        {share.canShare && <Users className="w-3 h-3" />}
                      </div>
                      <button
                        onClick={() => handleRemoveShare(share.id, share.sharedWith?.email || '')}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Retirer l'accès"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gray-50 dark:bg-gray-800 px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
