import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import toast from 'react-hot-toast';
import MFASetupModal from '@/components/MFASetupModal';
import BackupCodesModal from '@/components/BackupCodesModal';
import OAuthButtons from '@/components/OAuthButtons';
import { useTranslation } from 'react-i18next';
import { useMobileRedirect } from '@/hooks/useMobileRedirect';

export default function LoginPage() {
  useMobileRedirect();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, loadUser, isLoading } = useAuthStore();
  const navigate = useNavigate();

  // États pour le MFA Setup
  const [showMFASetupModal, setShowMFASetupModal] = useState(false);
  const [showBackupCodesModal, setShowBackupCodesModal] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('expired') === 'true') {
      toast.error(t('login.session_expired'));
      // Clean URL
      window.history.replaceState({}, '', '/login');
    } else if (params.get('accountDeleted') === 'true') {
      toast.success(t('login.account_deleted'));
      window.history.replaceState({}, '', '/login');
    }
  }, [t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await login(email, password);

      // Cas 1 : MFA setup requis (première connexion ou MFA jamais activé)
      if (result && 'mfaSetupRequired' in result && result.mfaSetupRequired) {
        localStorage.setItem('tempToken', result.tempToken);
        setShowMFASetupModal(true);
        return;
      }

      // Cas 2 : MFA requis (appareil non trusté)
      if (result && 'mfaRequired' in result && result.mfaRequired) {
        localStorage.setItem('tempToken', result.tempToken);
        navigate('/mfa-verify', {
          state: {
            userId: result.userId,
            tempToken: result.tempToken
          }
        });
        return;
      }

      // Cas 3 : Connexion directe (appareil trusté ou MFA désactivé - ne devrait pas arriver car MFA obligatoire)
      if (result) {
        toast.success(t('login.welcome_back'));
        navigate('/dashboard');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('login.failed'));
    }
  };

  const handleMFASetupComplete = (codes: string[], token: string, refreshToken?: string) => {
    setBackupCodes(codes);
    setShowMFASetupModal(false);
    setShowBackupCodesModal(true);

    // Stocker le token permanent
    localStorage.setItem('token', token);
    if (refreshToken) {
      localStorage.setItem('refreshToken', refreshToken);
    }
    localStorage.removeItem('tempToken');
  };

  const handleBackupCodesComplete = async () => {
    setShowBackupCodesModal(false);
    try {
      await loadUser();
    } catch (error) {
      console.error('Failed to refresh user profile after MFA setup', error);
    }
    toast.success(t('login.mfa_setup_success'));
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-2xl">
        <div className="text-center">
          <div className="flex justify-center">
            <img src="/icon-full.svg" alt="SupFile Logo" className="w-48 h-auto dark:hidden" />
            <img src="/icon-full-light.svg" alt="SupFile Logo" className="w-48 h-auto hidden dark:block" />
          </div>
          <h2 className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {t('login.title')}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {t('login.subtitle')}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {t('login.email_label')}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {t('login.password_label')}
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300 hover:underline underline-offset-2"
                >
                  {t('login.forgot_password', 'Mot de passe oublié ?')}
                </Link>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {isLoading ? t('login.button_loading') : t('login.button')}
          </button>

          <OAuthButtons />

          <div className="text-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('login.no_account')}{' '}
              <Link
                to="/register"
                className="font-medium text-primary-600 hover:text-primary-500"
              >
                {t('login.register_link')}
              </Link>
            </span>
          </div>
        </form>
      </div>

      {/* MFA Setup Modal */}
      <MFASetupModal
        isOpen={showMFASetupModal}
        onComplete={handleMFASetupComplete}
      />

      {/* Backup Codes Modal */}
      <BackupCodesModal
        isOpen={showBackupCodesModal}
        codes={backupCodes}
        onComplete={handleBackupCodesComplete}
      />
    </div>
  );
}
