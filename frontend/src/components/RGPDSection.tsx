import { useState } from 'react';
import { Download, Shield, AlertCircle, Loader2, Trash2, X, Eye, EyeOff } from 'lucide-react';
import { authService } from '@/services/authService';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/useAuthStore';

export default function RGPDSection() {
  const { t } = useTranslation();
  const { user, deleteAccount } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [deleteForm, setDeleteForm] = useState({
    confirmationEmail: '',
    currentPassword: '',
    mfaCode: '',
  });

  const requiresPassword = user?.hasPassword !== false;
  const requiresMfa = Boolean(user?.mfaEnabled);
  const confirmationMatches = Boolean(
    user?.email
    && deleteForm.confirmationEmail.trim().toLowerCase() === user.email.toLowerCase()
  );
  const canDeleteAccount = confirmationMatches
    && (!requiresPassword || deleteForm.currentPassword.length > 0)
    && (!requiresMfa || deleteForm.mfaCode.trim().length >= 6);

  const handleExportData = async () => {
    setLoading(true);
    try {
      const blob = await authService.exportUserData();

      // Créer un lien de téléchargement
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `supfile-data-export-${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success(t('gdpr.export_success'));
    } catch (error: any) {
      console.error('Error exporting data:', error);
      toast.error(error.response?.data?.error || t('gdpr.error_export', { defaultValue: 'Erreur lors de l\'export des données' }));
    } finally {
      setLoading(false);
    }
  };

  const closeDeleteModal = () => {
    if (deleteLoading) return;
    setDeleteModalOpen(false);
    setDeleteForm({ confirmationEmail: '', currentPassword: '', mfaCode: '' });
    setShowPassword(false);
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canDeleteAccount) return;

    setDeleteLoading(true);
    try {
      await deleteAccount({
        confirmationEmail: deleteForm.confirmationEmail.trim(),
        currentPassword: requiresPassword ? deleteForm.currentPassword : undefined,
        mfaCode: requiresMfa ? deleteForm.mfaCode.trim() : undefined,
      });
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('gdpr.delete_error'));
      setDeleteLoading(false);
    }
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center space-x-3 mb-6">
          <Shield className="w-6 h-6 text-primary-600 dark:text-primary-400" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('gdpr.title')}
          </h2>
        </div>

        <div className="space-y-6">
          {/* Information RGPD */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex">
              <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  {t('gdpr.rights_title')}
                </h3>
                <div className="mt-2 text-sm text-blue-800 dark:text-blue-200">
                  <p>{t('gdpr.rights_desc')}</p>
                  <ul className="list-disc list-inside mt-2 space-y-1">
                    <li>{t('gdpr.rights_list.access')}</li>
                    <li>{t('gdpr.rights_list.rectify')}</li>
                    <li>{t('gdpr.rights_list.portability')}</li>
                    <li>{t('gdpr.rights_list.delete')}</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Export des données */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
              {t('gdpr.export_title')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {t('gdpr.export_desc')}
            </p>
            <button
              onClick={handleExportData}
              disabled={loading}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {t('gdpr.exporting')}
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  {t('gdpr.download_button')}
                </>
              )}
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {t('gdpr.export_format')}
            </p>
          </div>

          {/* Suppression du compte */}
          <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-red-600 dark:text-red-400 mb-3">
              {t('gdpr.danger_zone')}
            </h3>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
              <h4 className="text-sm font-medium text-red-900 dark:text-red-100 mb-2">
                {t('gdpr.delete_account_title')}
              </h4>
              <p className="text-sm text-red-800 dark:text-red-200 mb-4">
                {t('gdpr.delete_account_desc')}
              </p>
              <button
                type="button"
                onClick={() => setDeleteModalOpen(true)}
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-5 h-5 mr-2" />
                {t('gdpr.delete_account_button')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {deleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <form
            onSubmit={handleDeleteAccount}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
          >
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <Trash2 className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {t('gdpr.delete_modal_title')}
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {user?.email}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleteLoading}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 p-4">
                <p className="text-sm text-red-800 dark:text-red-200">
                  {t('gdpr.delete_modal_desc')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('gdpr.confirm_email_label')}
                </label>
                <input
                  type="email"
                  value={deleteForm.confirmationEmail}
                  onChange={(e) => setDeleteForm((prev) => ({ ...prev, confirmationEmail: e.target.value }))}
                  placeholder={user?.email || t('login.email_label')}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  autoComplete="email"
                  autoFocus
                />
              </div>

              {requiresPassword && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('gdpr.current_password_label')}
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={deleteForm.currentPassword}
                      onChange={(e) => setDeleteForm((prev) => ({ ...prev, currentPassword: e.target.value }))}
                      className="w-full pr-10 pl-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
              )}

              {requiresMfa && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('gdpr.mfa_code_label')}
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={deleteForm.mfaCode}
                    onChange={(e) => setDeleteForm((prev) => ({ ...prev, mfaCode: e.target.value.trim() }))}
                    placeholder="000000"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {t('gdpr.mfa_code_help')}
                  </p>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 bg-gray-50 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={closeDeleteModal}
                disabled={deleteLoading}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={!canDeleteAccount || deleteLoading}
                className="inline-flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {deleteLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('gdpr.deleting_account')}
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    {t('gdpr.confirm_delete_button')}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
