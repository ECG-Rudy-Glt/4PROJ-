import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import toast from 'react-hot-toast';
import { HardDrive, Check, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { validatePasswordStrength } from '@/utils/validators';
import MFASetupModal from '@/components/MFASetupModal';
import BackupCodesModal from '@/components/BackupCodesModal';

export default function RegisterPage() {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  });
  const { register, isLoading, loadUser } = useAuthStore();
  const navigate = useNavigate();

  const [showMFASetupModal, setShowMFASetupModal] = useState(false);
  const [showBackupCodesModal, setShowBackupCodesModal] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      toast.error(t('common.password_mismatch'));
      return;
    }

    const pwdValidation = validatePasswordStrength(formData.password);
    if (!pwdValidation.valid) {
      toast.error(t('common.password_too_short'));
      return;
    }

    try {
      const result = await register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName,
        lastName: formData.lastName,
      });

      if (result?.mfaSetupRequired) {
        localStorage.setItem('tempToken', result.tempToken);
        setShowMFASetupModal(true);
        return;
      }

      toast.success(t('register.success'));
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.error || t('common.error_loading'));
    }
  };

  const handleMFASetupComplete = (codes: string[], token: string) => {
    setBackupCodes(codes);
    setShowMFASetupModal(false);
    setShowBackupCodesModal(true);

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
    toast.success(t('register.success'));
    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-2xl">
        <div className="text-center">
          <div className="flex justify-center">
            <HardDrive className="w-16 h-16 text-primary-600" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900 dark:text-white">
            {t('register.title')}
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {t('register.subtitle')}
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('register.first_name_label')}
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) =>
                    setFormData({ ...formData, firstName: e.target.value })
                  }
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  {t('register.last_name_label')}
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) =>
                    setFormData({ ...formData, lastName: e.target.value })
                  }
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('register.email_label')}
              </label>
              <input
                type="email"
                required
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('register.password_label')}
              </label>
              <input
                type="password"
                required
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
              />
              {formData.password.length > 0 && (
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('common.password_rules')}</p>
                  <ul className="text-xs space-y-1">
                    {[
                      { key: 'length', text: t('common.password_rule_length') },
                      { key: 'uppercase', text: t('common.password_rule_uppercase') },
                      { key: 'lowercase', text: t('common.password_rule_lowercase') },
                      { key: 'number', text: t('common.password_rule_number') },
                      { key: 'special', text: t('common.password_rule_special') },
                    ].map((rule) => {
                      const isValid = validatePasswordStrength(formData.password)[rule.key as keyof ReturnType<typeof validatePasswordStrength>];
                      return (
                        <li key={rule.key} className={`flex items-center gap-2 ${isValid ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                          {isValid ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                          {rule.text}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                {t('common.confirm_password')}
              </label>
              <input
                type="password"
                required
                value={formData.confirmPassword}
                onChange={(e) =>
                  setFormData({ ...formData, confirmPassword: e.target.value })
                }
                className="mt-1 block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
          >
            {isLoading ? t('register.button_loading') : t('register.button')}
          </button>

          <div className="text-center">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('register.already_have_account')}{' '}
              <Link to="/login" className="font-medium text-primary-600 hover:text-primary-500">
                {t('register.login_link')}
              </Link>
            </span>
          </div>
        </form>
      </div>

      <MFASetupModal
        isOpen={showMFASetupModal}
        onComplete={handleMFASetupComplete}
      />

      <BackupCodesModal
        isOpen={showBackupCodesModal}
        codes={backupCodes}
        onComplete={handleBackupCodesComplete}
      />
    </div>
  );
}
