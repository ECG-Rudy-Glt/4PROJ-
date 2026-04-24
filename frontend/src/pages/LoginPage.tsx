import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import toast from 'react-hot-toast';
import { Github } from 'lucide-react';
import MFASetupModal from '@/components/MFASetupModal';
import BackupCodesModal from '@/components/BackupCodesModal';
import { useTranslation } from 'react-i18next';

export default function LoginPage() {
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

  const handleMFASetupComplete = (codes: string[], token: string) => {
    setBackupCodes(codes);
    setShowMFASetupModal(false);
    setShowBackupCodesModal(true);

    // Stocker le token permanent
    localStorage.setItem('token', token);
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

  const handleOAuthLogin = (provider: string) => {
    window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/${provider}`;
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
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300"
              >
                {t('login.password_label')}
              </label>
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

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">
                {t('login.or_continue_with')}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleOAuthLogin('google')}
              className="flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Google
            </button>
            <button
              type="button"
              onClick={() => handleOAuthLogin('github')}
              className="flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              <Github className="w-5 h-5 mr-2" />
              GitHub
            </button>
          </div>

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
