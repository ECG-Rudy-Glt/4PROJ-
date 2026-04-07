import { useState } from 'react';
import { Download, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { authService } from '@/services/authService';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

export default function RGPDSection() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);

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

  return (
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
              disabled
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={t('gdpr.delete_account_hint')}
            >
              {t('gdpr.delete_account_button')}
            </button>
            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
              {t('gdpr.contact_support')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
