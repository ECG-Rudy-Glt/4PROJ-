import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '@/services/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const { t, i18n } = useTranslation();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await api.post('/auth/forgot-password', {
        email,
        lang: i18n.language
      });
      setIsSuccess(true);
      toast.success(t('login.forgot_password_success', 'Si un compte est associé à cette adresse e-mail, un lien de réinitialisation a été envoyé.'));
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('login.failed', 'Une erreur est survenue'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-2xl">
        <div className="text-center">
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-primary-600 dark:text-primary-400" />
            </div>
          </div>
          <h2 className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">
            {t('login.forgot_password_title', 'Mot de passe oublié')}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {t('login.forgot_password_desc', "Saisissez votre adresse e-mail pour recevoir un lien de réinitialisation.")}
          </p>
        </div>

        {!isSuccess ? (
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('login.email_label', 'Adresse e-mail')}
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
                placeholder="vous@exemple.com"
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !email}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {isLoading ? t('common.loading', 'Chargement...') : t('login.send_link', 'Envoyer le lien')}
            </button>
          </form>
        ) : (
          <div className="mt-8 text-center p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-lg border border-green-200 dark:border-green-800">
            {t('login.check_email', 'Veuillez vérifier votre boîte de réception (et vos spams) pour trouver le lien de réinitialisation.')}
          </div>
        )}

        <div className="mt-6 flex items-center justify-center">
          <Link to="/login" className="flex items-center text-sm font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t('login.back_to_login', 'Retour à la connexion')}
          </Link>
        </div>
      </div>
    </div>
  );
}
