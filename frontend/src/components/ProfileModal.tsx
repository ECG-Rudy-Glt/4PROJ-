import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Upload, User, Calendar, HardDrive } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import toast from 'react-hot-toast';
import { formatBytes } from '@/utils/bytes';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_AVATARS = [
  '/avatars/bonhomme_pp.png',
  '/avatars/escargot de course (2).png',
  '/avatars/pigeon_phot_de_prrofil.png',
  '/avatars/shrek.png',
];

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { t, i18n } = useTranslation();
  const { user, updateProfile } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || DEFAULT_AVATARS[0]);
  const [isUploading, setIsUploading] = useState(false);
  const [profile, setProfile] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
  });

  // Sync profile state when user data is available
  useEffect(() => {
    if (user) {
      setProfile({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
      });
      setSelectedAvatar(user.avatar || DEFAULT_AVATARS[0]);
    }
  }, [user]);

  if (!isOpen || !user) return null;

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return t('common.unknown_date');
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return t('common.invalid_date');

    return date.toLocaleDateString(i18n.language === 'fr' ? 'fr-FR' : 'en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };
  const quotaUsed = user.quotaUsed || 0;
  const quotaLimit = user.quotaLimit || 32212254720;
  const quotaPercentage = (quotaUsed / quotaLimit) * 100;

  const handleAvatarSelect = (avatar: string) => {
    setSelectedAvatar(avatar);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error(t('profile.image_only'));
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('profile.file_too_large'));
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await fetch('/api/auth/avatar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to upload avatar');

      const data = await response.json();
      setSelectedAvatar(data.avatarUrl);
      toast.success(t('profile.upload_success'));
    } catch (error) {
      console.error('Avatar upload error:', error);
      toast.error(t('profile.upload_error'));
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      await updateProfile({
        firstName: profile.firstName,
        lastName: profile.lastName,
        avatar: selectedAvatar,
      });
      toast.success(t('profile.update_success'));
      onClose();
    } catch (error) {
      console.error('Profile update error:', error);
      toast.error(t('profile.update_error'));
    }
  };

  const handleSaveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleSave();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('common.profile')}</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSaveSubmit} className="p-6 space-y-6">
          {/* Avatar Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <User className="w-5 h-5" />
              {t('profile.avatar')}
            </h3>

            {/* Current Avatar */}
            <div className="flex justify-center">
              <img
                src={selectedAvatar}
                alt={t('profile.avatar')}
                className="w-32 h-32 rounded-full border-4 border-primary-500 dark:border-primary-300 object-cover shadow-inner flex-shrink-0 aspect-square"
              />
            </div>

            {/* Default Avatars */}
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{t('profile.choose_default')}</p>
              <div className="grid grid-cols-4 gap-3">
                {DEFAULT_AVATARS.map((avatar, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => handleAvatarSelect(avatar)}
                    className={`w-full aspect-square rounded-full border-2 transition-all hover:scale-110 ${selectedAvatar === avatar
                      ? 'border-primary-500 dark:border-primary-300 ring-2 ring-primary-500/50'
                      : 'border-gray-300 dark:border-gray-600'
                      }`}
                  >
                    <img src={avatar} alt={`Avatar ${index + 1}`} className="w-full h-full rounded-full object-cover aspect-square flex-shrink-0" />
                  </button>
                ))}
              </div>
            </div>

            {/* Upload Custom Avatar */}
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{t('profile.upload_custom')}</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="w-full px-4 py-3 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-300 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Upload className="w-5 h-5" />
                {isUploading ? t('profile.uploading') : t('profile.upload_button')}
              </button>
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">{t('profile.upload_constraints')}</p>
            </div>
          </div>

          {/* Personal Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('settings.personal_info')}</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings.first_name')}
                </label>
                <input
                  type="text"
                  value={profile.firstName}
                  onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-300 focus:border-transparent text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings.last_name')}
                </label>
                <input
                  type="text"
                  value={profile.lastName}
                  onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-300 focus:border-transparent text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={user.email}
                disabled
                className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-700/50 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 cursor-not-allowed"
              />
            </div>
          </div>

          {/* Account Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t('profile.account_info')}</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400 mb-2">
                  <Calendar className="w-5 h-5" />
                  <span className="text-sm font-medium">{t('profile.member_since')}</span>
                </div>
                <p className="text-gray-900 dark:text-white font-semibold">
                  {formatDate(user.createdAt)}
                </p>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-lg">
                <div className="flex items-center gap-3 text-gray-600 dark:text-gray-400 mb-2">
                  <HardDrive className="w-5 h-5" />
                  <span className="text-sm font-medium">{t('common.storage_used')}</span>
                </div>
                <p className="text-gray-900 dark:text-white font-semibold">
                  {formatBytes(quotaUsed)} / {formatBytes(quotaLimit)}
                </p>
                <div className="mt-2 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 dark:bg-primary-300 transition-all duration-300"
                    style={{ width: `${Math.min(quotaPercentage, 100)}%` }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              {t('settings.cancel')}
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary-600 dark:bg-primary-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-600 transition-colors"
            >
              {t('settings.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
