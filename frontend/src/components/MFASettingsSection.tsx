import { useState, useCallback, useEffect } from 'react';
import { Shield, Smartphone, Trash2, RefreshCw, AlertCircle, Check, Loader2 } from 'lucide-react';
import { mfaService, TrustedDevice } from '@/services/mfaService';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import BackupCodesModal from './BackupCodesModal';
import { useTranslation } from 'react-i18next';
import { getApiErrorMessage } from '@/utils/getApiErrorMessage';

export default function MFASettingsSection() {
  const { t, i18n } = useTranslation();
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerateCode, setRegenerateCode] = useState('');
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [newBackupCodes, setNewBackupCodes] = useState<string[]>([]);
  const [showBackupCodesModal, setShowBackupCodesModal] = useState(false);

  useEffect(() => {
    loadTrustedDevices();
  }, [loadTrustedDevices]);

  const loadTrustedDevices = useCallback(async () => {
    setLoading(true);
    try {
      const devices = await mfaService.getTrustedDevices();
      setTrustedDevices(devices);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('mfa.error_loading_devices', { defaultValue: 'Erreur lors du chargement des appareils' })));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const handleRevokeDevice = async (deviceId: string, deviceName: string) => {
    if (!confirm(t('mfa.revoke_confirm', { name: deviceName }))) return;

    try {
      await mfaService.revokeTrustedDevice(deviceId);
      toast.success(t('mfa.revoke_success'));
      loadTrustedDevices();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('common.error')));
    }
  };

  const handleRegenerateCodes = async () => {
    if (regenerateCode.length !== 6) {
      toast.error(t('account_access.mfa_invalid', { defaultValue: 'Code invalide' }));
      return;
    }

    setRegenerating(true);
    try {
      const result = await mfaService.regenerateBackupCodes(regenerateCode);
      setNewBackupCodes(result.backupCodes);
      setShowRegenerateModal(false);
      setShowBackupCodesModal(true);
      setRegenerateCode('');
      toast.success(t('mfa.regenerate_success'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('common.error')));
    } finally {
      setRegenerating(false);
    }
  };

  const handleRegenerateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!regenerating) {
      void handleRegenerateCodes();
    }
  };

  const handleCodeChange = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 6);
    setRegenerateCode(numericValue);
  };

  const dateLocale = i18n.language === 'fr' ? fr : enUS;

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('mfa.title')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('mfa.subtitle')}
            </p>
          </div>
        </div>

        {/* Statut MFA */}
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="flex-1">
              <p className="font-medium text-green-900 dark:text-green-100">
                {t('mfa.enabled_title')}
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                {t('mfa.enabled_desc')}
              </p>
            </div>
          </div>
        </div>

        {/* Codes de récupération */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
            <RefreshCw className="w-5 h-5 mr-2" />
            {t('mfa.backup_codes')}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {t('mfa.backup_codes_desc')}
          </p>
          <button
            onClick={() => setShowRegenerateModal(true)}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            {t('mfa.regenerate_button')}
          </button>
        </div>

        {/* Appareils de confiance */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
            <Smartphone className="w-5 h-5 mr-2" />
            {t('mfa.trusted_devices')} ({trustedDevices.length})
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            {t('mfa.trusted_devices_desc')}
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
            </div>
          ) : trustedDevices.length === 0 ? (
            <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
              <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600 dark:text-gray-400">{t('mfa.no_trusted_devices')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {trustedDevices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-primary-600 dark:text-primary-300" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {device.deviceName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        IP: {device.ipAddress}
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span>
                          {t('mfa.added_on', { date: format(new Date(device.createdAt), 'dd MMM yyyy', { locale: dateLocale }) })}
                        </span>
                        <span>
                          {t('mfa.expires_on', { date: format(new Date(device.expiresAt), 'dd MMM yyyy', { locale: dateLocale }) })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevokeDevice(device.id, device.deviceName)}
                    className="ml-4 p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title={t('mfa.revoke')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de régénération */}
      {showRegenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <form onSubmit={handleRegenerateSubmit} className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {t('mfa.regenerate_modal_title')}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              {t('mfa.regenerate_modal_desc')}
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('mfa.auth_code_label')}
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={regenerateCode}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="000000"
                className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:text-white"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowRegenerateModal(false);
                  setRegenerateCode('');
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                disabled={regenerating}
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={regenerating || regenerateCode.length !== 6}
                className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {regenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {t('mfa.regenerating')}
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    {t('mfa.regenerate_button')}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal des nouveaux codes */}
      <BackupCodesModal
        isOpen={showBackupCodesModal}
        codes={newBackupCodes}
        onComplete={() => setShowBackupCodesModal(false)}
      />
    </>
  );
}
