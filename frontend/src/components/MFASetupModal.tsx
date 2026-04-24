import { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Smartphone, Copy, Check } from 'lucide-react';
import { mfaService } from '@/services/mfaService';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface MFASetupModalProps {
  isOpen: boolean;
  onComplete: (backupCodes: string[], token: string) => void;
  onCancel?: () => void;
}

export default function MFASetupModal({ isOpen, onComplete, onCancel }: MFASetupModalProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [secret, setSecret] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [verificationCode, setVerificationCode] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [secretCopied, setSecretCopied] = useState(false);

  const loadMFASetup = useCallback(async () => {
    setLoading(true);
    try {
      const data = await mfaService.setupMFA();
      setQrCode(data.qrCodeDataUrl);
      setSecret(data.secret);
      setBackupCodes(data.backupCodes);
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('mfa_setup.error_generate'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (isOpen) {
      loadMFASetup();
    }
  }, [isOpen, loadMFASetup]);

  const handleVerify = async () => {
    if (verificationCode.length !== 6) {
      toast.error(t('mfa_setup.error_length'));
      return;
    }

    setLoading(true);
    try {
      const result = await mfaService.verifySetup(
        verificationCode,
        secret,
        backupCodes,
        rememberDevice
      );

      toast.success(t('mfa_setup.success'));
      onComplete(backupCodes, result.token);
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('mfa_setup.error_invalid'));
    } finally {
      setLoading(false);
    }
  };

  const handleCopySecret = () => {
    navigator.clipboard.writeText(secret);
    setSecretCopied(true);
    toast.success(t('mfa_setup.secret_copied'));
    setTimeout(() => setSecretCopied(false), 2000);
  };

  const handleCodeChange = (value: string) => {
    // N'accepter que les chiffres
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 6);
    setVerificationCode(numericValue);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('mfa_setup.title')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {t('mfa_setup.subtitle')}
            </p>
          </div>
          {onCancel && (
            <button
              onClick={onCancel}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && !qrCode ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
              <span className="ml-3 text-gray-600 dark:text-gray-400">{t('mfa_setup.loading')}</span>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Étape 1 : Scanner le QR code */}
              <div>
                <div className="flex items-center space-x-2 mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-300 font-bold">
                    1
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t('mfa_setup.step1_title')}
                  </h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 ml-10">
                  {t('mfa_setup.step1_desc')}
                </p>

                <div className="flex items-center justify-center bg-white p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700">
                  {qrCode && (
                    <img
                      src={qrCode}
                      alt="QR Code"
                      className="w-64 h-64"
                    />
                  )}
                </div>
              </div>

              {/* Code secret manuel */}
              <div className="ml-10">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('mfa_setup.manual_code_query')}
                </p>
                <div className="flex items-center space-x-2">
                  <code className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm font-mono">
                    {secret}
                  </code>
                  <button
                    onClick={handleCopySecret}
                    className="p-2 text-gray-600 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    title={t('mfa_setup.copy')}
                  >
                    {secretCopied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Étape 2 : Vérifier le code */}
              <div>
                <div className="flex items-center space-x-2 mb-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-300 font-bold">
                    2
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t('mfa_setup.step2_title')}
                  </h3>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 ml-10">
                  {t('mfa_setup.step2_desc')}
                </p>

                <div className="ml-10">
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={verificationCode}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    placeholder="000000"
                    className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:text-white"
                    autoFocus
                  />
                </div>
              </div>

              {/* Remember device */}
              <div className="ml-10">
                <label className="flex items-start space-x-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberDevice}
                    onChange={(e) => setRememberDevice(e.target.checked)}
                    className="mt-1 w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {t('mfa_setup.remember_device')}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('mfa_setup.remember_device_desc')}
                    </p>
                  </div>
                </label>
              </div>

              {/* Bouton de vérification */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                {onCancel && (
                  <button
                    onClick={onCancel}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                  >
                    {t('mfa_setup.cancel')}
                  </button>
                )}
                <button
                  onClick={handleVerify}
                  disabled={loading || verificationCode.length !== 6}
                  className="flex items-center px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('mfa_setup.verifying')}
                    </>
                  ) : (
                    <>
                      <Smartphone className="w-4 h-4 mr-2" />
                      {t('mfa_setup.verify_and_enable')}
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
