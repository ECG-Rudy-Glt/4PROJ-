import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Loader2, Key, ArrowLeft } from 'lucide-react';
import { mfaService } from '@/services/mfaService';
import { useAuthStore } from '@/stores/useAuthStore';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

export default function MFAVerificationPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { userId, tempToken } = location.state || {};
  const { loadUser } = useAuthStore();

  const [code, setCode] = useState('');
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [backupCode, setBackupCode] = useState('');
  const [rememberDevice, setRememberDevice] = useState(true);
  const [loading, setLoading] = useState(false);

  // Rediriger si pas de userId/tempToken
  if (!userId || !tempToken) {
    navigate('/login');
    return null;
  }

  const handleVerifyTOTP = async () => {
    if (code.length !== 6) {
      toast.error(t('mfa_verify.error_invalid'));
      return;
    }

    setLoading(true);
    try {
      const result = await mfaService.verifyMFA(code, rememberDevice) as {
        token: string;
        refreshToken?: string;
      };

      // Stocker le token
      localStorage.setItem('token', result.token);
      if (result.refreshToken) {
        localStorage.setItem('refreshToken', result.refreshToken);
      }
      localStorage.removeItem('tempToken');

      // Charger l'utilisateur dans le store
      await loadUser();

      toast.success(t('mfa_verify.success'));
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('mfa_verify.error_invalid'));
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyBackupCode = async () => {
    if (backupCode.length !== 8) {
      toast.error(t('mfa_verify.error_backup_invalid'));
      return;
    }

    setLoading(true);
    try {
      const result = await mfaService.verifyBackupCode(backupCode.toUpperCase(), rememberDevice) as {
        token: string;
        refreshToken?: string;
        warning?: string;
      };

      // Stocker le token
      localStorage.setItem('token', result.token);
      if (result.refreshToken) {
        localStorage.setItem('refreshToken', result.refreshToken);
      }
      localStorage.removeItem('tempToken');

      // Charger l'utilisateur dans le store
      await loadUser();

      if (result.warning) {
        toast.success(result.warning, { duration: 5000 });
      } else {
        toast.success(t('mfa_verify.success'));
      }

      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('mfa_verify.error_backup_invalid'));
      setBackupCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('tempToken');
    localStorage.removeItem('user');
    navigate('/login');
  };

  const handleCodeChange = (value: string) => {
    // N'accepter que les chiffres
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 6);
    setCode(numericValue);
  };

  const handleBackupCodeChange = (value: string) => {
    // N'accepter que les caractères alphanumériques
    const alphanumericValue = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8);
    setBackupCode(alphanumericValue);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (useBackupCode) {
      handleVerifyBackupCode();
    } else {
      handleVerifyTOTP();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 dark:bg-primary-900 rounded-full mb-4">
            <Shield className="w-8 h-8 text-primary-600 dark:text-primary-300" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            {t('mfa_verify.title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {useBackupCode
              ? t('mfa_verify.subtitle_backup')
              : t('mfa_verify.subtitle_totp')}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
          <form onSubmit={handleSubmit} className="space-y-6">
            {!useBackupCode ? (
              <>
                {/* Code TOTP */}
                <div>
                  <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('mfa_verify.code_label')}
                  </label>
                  <input
                    id="code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={code}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    placeholder="000000"
                    className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:text-white"
                    autoFocus
                    disabled={loading}
                  />
                </div>
              </>
            ) : (
              <>
                {/* Code de récupération */}
                <div>
                  <label htmlFor="backupCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('mfa_verify.backup_code_label')}
                  </label>
                  <input
                    id="backupCode"
                    type="text"
                    maxLength={8}
                    value={backupCode}
                    onChange={(e) => handleBackupCodeChange(e.target.value)}
                    placeholder="XXXXXXXX"
                    className="w-full px-4 py-3 text-center text-xl font-mono tracking-widest bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:text-white uppercase"
                    autoFocus
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                    {t('mfa_verify.backup_code_hint')}
                  </p>
                </div>
              </>
            )}

            {/* Remember device */}
            <div>
              <label className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberDevice}
                  onChange={(e) => setRememberDevice(e.target.checked)}
                  className="mt-1 w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                  disabled={loading}
                />
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {t('mfa_verify.remember_device')}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('mfa_verify.remember_device_hint')}
                  </p>
                </div>
              </label>
            </div>

            {/* Bouton de vérification */}
            <button
              type="submit"
              disabled={loading || (!useBackupCode && code.length !== 6) || (useBackupCode && backupCode.length !== 8)}
              className="w-full flex items-center justify-center px-4 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  {t('mfa_verify.button_loading')}
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5 mr-2" />
                  {t('mfa_verify.button')}
                </>
              )}
            </button>

            {/* Toggle backup code */}
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setUseBackupCode(!useBackupCode);
                  setCode('');
                  setBackupCode('');
                }}
                className="inline-flex items-center text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
                disabled={loading}
              >
                <Key className="w-4 h-4 mr-1" />
                {useBackupCode ? t('mfa_verify.use_totp_code') : t('mfa_verify.use_backup_code')}
              </button>
            </div>

            {/* Bouton retour */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center justify-center px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                disabled={loading}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('mfa_verify.logout_button')}
              </button>
            </div>
          </form>
        </div>

        {/* Aide */}
        <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>{t('mfa_verify.help_title')}</p>
          <p className="mt-1">{t('mfa_verify.help_desc')}</p>
        </div>
      </div>
    </div>
  );
}
