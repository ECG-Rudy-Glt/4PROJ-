import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { Lock, ShieldCheck, CheckCircle } from 'lucide-react';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfaRequired, setMfaRequired] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');

  useEffect(() => {
    const checkToken = async () => {
      if (!token) {
        setError(t('login.reset_password_missing_token', 'Token manquant.'));
        setIsLoading(false);
        return;
      }

      try {
        const response = await api.get(`/auth/reset-password-info?token=${token}`);
        setMfaRequired(response.data.mfaEnabled);
      } catch (err: any) {
        setError(err.response?.data?.error || t('login.reset_password_invalid_link', 'Le lien de réinitialisation est invalide ou a expiré.'));
      } finally {
        setIsLoading(false);
      }
    };

    void checkToken();
  }, [token, t]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t('common.password_mismatch', 'Les mots de passe ne correspondent pas'));
      return;
    }
    if (newPassword.length < 6) {
      toast.error(t('common.password_too_short', 'Le mot de passe doit contenir au moins 6 caractères'));
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/auth/reset-password', {
        token,
        newPassword,
        mfaCode: mfaRequired ? mfaCode : undefined
      });
      setIsSuccess(true);
      toast.success(t('login.reset_password_success', 'Votre mot de passe a été réinitialisé avec succès.'));
      setTimeout(() => navigate('/login'), 3000);
    } catch (err: any) {
      const apiError = err.response?.data?.error as string | undefined;
      if (apiError?.toLowerCase().includes('mfa')) {
        toast.error(t('login.reset_password_mfa_invalid', 'Code MFA invalide. Veuillez réessayer.'));
      } else {
        toast.error(apiError || t('login.failed', 'Une erreur est survenue'));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 p-8 rounded-xl shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Lien invalide</h2>
          <p className="text-gray-600 dark:text-gray-400">{error}</p>
          <button
            onClick={() => navigate('/forgot-password')}
            className="w-full py-2 px-4 border border-transparent rounded-lg text-sm font-medium text-white bg-primary-600 hover:bg-primary-700"
          >
            {t('login.send_link', 'Demander un nouveau lien')}
          </button>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 p-8 rounded-xl shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('login.reset_password_done_title', 'Mot de passe réinitialisé !')}</h2>
          <p className="text-gray-600 dark:text-gray-400">
            {t('login.reset_password_done_desc', 'Votre mot de passe a été modifié avec succès. Vous allez être redirigé vers la page de connexion...')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-2xl">
        <div className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
              <Lock className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            </div>
          </div>
          <h2 className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {t('login.reset_password_title', 'Nouveau mot de passe')}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {t('login.reset_password_desc', 'Veuillez entrer votre nouveau mot de passe.')}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('settings.new_password', 'Nouveau mot de passe')}
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                placeholder={t('settings.password_hint', 'Au moins 6 caractères')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('common.confirm_password', 'Confirmer le mot de passe')}
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            {mfaRequired && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center">
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  {t('login.reset_password_mfa_required', 'Code MFA requis')}
                </label>
                <input
                  type="text"
                  required
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white font-mono tracking-widest text-center text-lg"
                  placeholder="123456"
                  maxLength={10} // Permet les codes TOTP (6) ou de backup (ex: 8-10)
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {t('login.reset_password_mfa_help', 'Entrez votre code 2FA ou un de vos codes de récupération.')}
                </p>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !newPassword || !confirmPassword || (mfaRequired && !mfaCode)}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {isSubmitting ? t('login.reset_password_loading', 'Réinitialisation...') : t('settings.change_password', 'Enregistrer le mot de passe')}
          </button>
        </form>
      </div>
    </div>
  );
}
