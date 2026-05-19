import { useState, useEffect, useRef } from 'react';
import { X, Mail, Users, Eye, EyeOff, Edit3, Trash2, Share2, Shield, Copy, Check, Link as LinkIcon, Lock, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { shareService } from '@/services/shareService';
import { SharedFolder } from '@/types';
import PermissionsManager from './PermissionsManager';
import api from '@/services/api';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/useAuthStore';
import { getApiErrorMessage } from '@/utils/getApiErrorMessage';
import { setFolderShareAccessToken } from '@/utils/shareAccessTokens';

interface ShareFolderModalProps {
  folderId: string;
  folderName: string;
  isOpen: boolean;
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

export default function ShareFolderModal({
  folderId,
  folderName,
  isOpen,
  onClose,
}: ShareFolderModalProps) {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [sharedWith, setSharedWith] = useState<SharedFolder[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<PermissionTemplate>('viewer');
  const [customPermissions, setCustomPermissions] = useState({
    canRead: true,
    canWrite: false,
    canDelete: false,
    canShare: false,
  });
  const [inviteLink, setInviteLink] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [sharePassword, setSharePassword] = useState('');
  const [showSharePassword, setShowSharePassword] = useState(false);
  const [sharePasswordEdits, setSharePasswordEdits] = useState<Record<string, string>>({});
  const [visibleSharePasswords, setVisibleSharePasswords] = useState<Record<string, boolean>>({});
  const [updatingPasswordShareId, setUpdatingPasswordShareId] = useState<string | null>(null);
  const { user } = useAuthStore();
  const isPro = user?.plan && user.plan !== 'FREE';

  const searchTimeoutRef = useRef<number | undefined>();

  useEffect(() => {
    if (isOpen) {
      loadSharedWith();
      generateInviteLink();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, folderId]);

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
      const { sharedFolders } = await shareService.listSharedByMe();
      const filtered = sharedFolders.filter((sf) => sf.folderId === folderId);
      setSharedWith(filtered);
    } catch (error: any) {
      console.error('Erreur chargement partages:', error);
    }
  };

  const generateInviteLink = () => {
    // Générer un lien d'invitation unique (pour l'instant, un lien simple)
    const link = `${window.location.origin}/invite/folder/${folderId}`;
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
      toast.error(t('share_modal.error_email'));
      return;
    }

    setIsSharing(true);
    try {
      const response = await shareService.shareFolder(folderId, email.trim(), customPermissions, sharePassword || undefined);
      if (response && response.isNewUser) {
        toast.success(t('share_modal.invite_success', { email }));
      } else {
        toast.success(t('share_modal.share_success', { email }));
      }
      setEmail('');
      setSuggestions([]);
      setShowSuggestions(false);
      setSharePassword('');
      loadSharedWith();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('share_modal.error_sharing'));
    } finally {
      setIsSharing(false);
    }
  };

  const handleUpdateSharePassword = async (share: SharedFolder) => {
    const password = sharePasswordEdits[share.id]?.trim();
    if (!password) {
      toast.error(t('share_modal.password_required'));
      return;
    }

    setUpdatingPasswordShareId(share.id);
    try {
      await shareService.updateSharedFolderPermissions(share.id, {
        canRead: share.canRead,
        canWrite: share.canWrite,
        canDelete: share.canDelete,
        canShare: share.canShare,
        password,
      });
      toast.success(t('share_modal.password_update_success'));
      setFolderShareAccessToken(folderId, null);
      setSharePasswordEdits((prev) => {
        const next = { ...prev };
        delete next[share.id];
        return next;
      });
      await loadSharedWith();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('share_modal.password_update_error')));
    } finally {
      setUpdatingPasswordShareId(null);
    }
  };

  const handleClearSharePassword = async (share: SharedFolder) => {
    if (!confirm(t('share_modal.password_clear_confirm'))) return;

    setUpdatingPasswordShareId(share.id);
    try {
      await shareService.updateSharedFolderPermissions(share.id, {
        canRead: share.canRead,
        canWrite: share.canWrite,
        canDelete: share.canDelete,
        canShare: share.canShare,
        clearPassword: true,
      });
      toast.success(t('share_modal.password_clear_success'));
      setFolderShareAccessToken(folderId, null);
      await loadSharedWith();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('share_modal.password_update_error')));
    } finally {
      setUpdatingPasswordShareId(null);
    }
  };

  const handleShareSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSharing) {
      void handleShare();
    }
  };

  const handleRemoveShare = async (shareId: string, userEmail: string) => {
    if (!confirm(t('share_modal.remove_access_confirm', { email: userEmail }))) return;

    try {
      await shareService.removeSharedFolder(shareId);
      toast.success(t('share_modal.remove_success'));
      loadSharedWith();
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('share_modal.error_removing'));
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
    toast.success(t('share_modal.copied'));
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const getUserDisplayName = (user: any) => {
    if (user.firstName || user.lastName) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim();
    }
    return user.email.split('@')[0];
  };

  if (!isOpen) return null;

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
                {t('share_modal.title', { name: folderName })}
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('share_modal.subtitle')}
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
              {t('share_modal.templates_title')}
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
                <p className="text-sm font-medium text-gray-900 dark:text-white">{t('share_modal.viewer.title')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('share_modal.viewer.desc')}</p>
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
                <p className="text-sm font-medium text-gray-900 dark:text-white">{t('share_modal.editor.title')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('share_modal.editor.desc')}</p>
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
                <p className="text-sm font-medium text-gray-900 dark:text-white">{t('share_modal.admin.title')}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{t('share_modal.admin.desc')}</p>
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

          {/* Section 3: Mot de passe (PRO) */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Lock className="w-4 h-4" />
                {t('share_modal.password_title')}
                <span className="ml-1 px-1.5 py-0.5 bg-gradient-to-r from-amber-400 to-orange-400 text-white text-xs font-bold rounded">
                  PRO
                </span>
              </h3>
            </div>
            {isPro ? (
              <div className="relative">
                <input
                  id="share-folder-password"
                  type={showSharePassword ? 'text' : 'password'}
                  value={sharePassword}
                  onChange={(e) => setSharePassword(e.target.value)}
                  placeholder={t('share_modal.password_placeholder')}
                  className="w-full pr-10 pl-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowSharePassword(!showSharePassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  tabIndex={-1}
                >
                  {showSharePassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                <Zap className="w-5 h-5 text-amber-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{t('share_modal.password_upgrade_title')}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t('share_modal.password_upgrade_desc')}</p>
                </div>
                <a
                  href="/plans"
                  className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-lg hover:opacity-90 transition-opacity whitespace-nowrap"
                >
                  {t('share_modal.upgrade_cta')}
                </a>
              </div>
            )}
          </div>

          {/* Section 4: Inviter par email avec autocomplete */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              {t('share_modal.invite_email')}
            </h3>
            <form className="relative" onSubmit={handleShareSubmit}>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('share_modal.email_placeholder')}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                  />

                  {/* Autocomplete suggestions */}
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                      {suggestions.map((user) => (
                        <button
                          type="button"
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
                  type="submit"
                  disabled={isSharing || !email.trim()}
                  className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isSharing ? t('share_modal.inviting_button') : t('share_modal.invite_button')}
                </button>
              </div>
            </form>
          </div>

          {/* Section 5: Lien d'invitation */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              {t('share_modal.share_via_link')}
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
                    <span className="text-green-600">{t('share_modal.copied')}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-5 h-5" />
                    <span>{t('file_modals.share_link.copy')}</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {t('share_modal.link_hint_folder')}
            </p>
          </div>

          {/* Section 6: Liste des personnes ayant accès */}
          {sharedWith.length > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                {t('share_modal.people_with_access', { count: sharedWith.length })}
              </h3>
              <div className="space-y-2">
                {sharedWith.map((share) => (
                  <div
                    key={share.id}
                    className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center">
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
                          {share.canDelete && <Trash2 className="w-3 h-3" />}
                          {share.canShare && <Share2 className="w-3 h-3" />}
                        </div>
                        <button
                          onClick={() => handleRemoveShare(share.id, share.sharedWith?.email || '')}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title={t('share_modal.remove_access_title')}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400 sm:w-36">
                        <Lock className={`w-3.5 h-3.5 ${share.passwordProtected ? 'text-amber-500' : 'text-gray-400'}`} />
                        <span>
                          {share.passwordProtected ? t('share_modal.password_enabled') : t('share_modal.password_disabled')}
                        </span>
                      </div>
                      {isPro && (
                        <>
                          <div className="relative flex-1">
                            <input
                              type={visibleSharePasswords[share.id] ? 'text' : 'password'}
                              value={sharePasswordEdits[share.id] || ''}
                              onChange={(e) => setSharePasswordEdits((prev) => ({ ...prev, [share.id]: e.target.value }))}
                              placeholder={share.passwordProtected ? t('share_modal.password_new_placeholder') : t('share_modal.password_placeholder')}
                              className="w-full pr-10 pl-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-600 focus:border-transparent"
                            />
                            <button
                              type="button"
                              onClick={() => setVisibleSharePasswords((prev) => ({ ...prev, [share.id]: !prev[share.id] }))}
                              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                              tabIndex={-1}
                            >
                              {visibleSharePasswords[share.id] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleUpdateSharePassword(share)}
                            disabled={updatingPasswordShareId === share.id || !sharePasswordEdits[share.id]?.trim()}
                            className="px-3 py-2 text-sm font-medium bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                          >
                            {t('share_modal.password_save')}
                          </button>
                          {share.passwordProtected && (
                            <button
                              type="button"
                              onClick={() => handleClearSharePassword(share)}
                              disabled={updatingPasswordShareId === share.id}
                              className="px-3 py-2 text-sm font-medium border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {t('share_modal.password_clear')}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            {t('file_modals.share_link.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
