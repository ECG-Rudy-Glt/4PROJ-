import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/useAuthStore';
import { authService } from '@/services/authService';
import { User, Lock, HardDrive, Moon, Sun, Calendar, Shield, Languages, LogOut, Check, X, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import MFASettingsSection from '@/components/MFASettingsSection';
import RGPDSection from '@/components/RGPDSection';
import { vaultService, VaultStatus } from '@/services/vaultService';
import { formatBytes } from '@/utils/bytes';
import { isFeatureAvailableForPlan, isVaultAvailableForPlan } from '@/constants/plans';
import { useVaultStore } from '@/stores/useVaultStore';
import ActivityLog from '@/components/ActivityLog';
import AccountSwitcherModal from '@/components/AccountSwitcherModal';
import { validatePasswordStrength } from '@/utils/validators';
import { getApiErrorMessage } from '@/utils/getApiErrorMessage';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const { user, updateProfile, logout } = useAuthStore();
  const [isDark, setIsDark] = useState(user?.theme === 'dark');
  const [profile, setProfile] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
  });
  const [password, setPassword] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
    mfaCode: '',
  });
  const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(null);
  const [vaultSetup, setVaultSetup] = useState({ password: '', totpCode: '' });
  const [vaultUnlock, setVaultUnlock] = useState({ password: '', totpCode: '' });
  const [vaultRotate, setVaultRotate] = useState({ oldPassword: '', newPassword: '', totpCode: '' });
  const [isAccountSwitcherOpen, setIsAccountSwitcherOpen] = useState(false);

  const quotaUsed = user?.quotaUsed || 0;
  const quotaLimit = user?.quotaLimit || 32212254720; // 30GB default
  const quotaPercentage = quotaLimit > 0 ? (quotaUsed / quotaLimit) * 100 : 0;
  const currentPlan = user?.plan || 'FREE';
  const isVaultEligible = isVaultAvailableForPlan(currentPlan);
  const auditAvailable = isFeatureAvailableForPlan(currentPlan, 'auditLogs');
  const refreshGlobalVaultStatus = useVaultStore((state) => state.refreshStatus);

  useEffect(() => {
    setIsDark(user?.theme === 'dark');
    const loadVaultStatus = async () => {
      if (!isVaultEligible) {
        setVaultStatus(null);
        return;
      }
      try {
        const data = await vaultService.getStatus();
        setVaultStatus(data.status);
      } catch (error) {
        console.error('Failed to load vault status', error);
      }
    };
    void loadVaultStatus();
  }, [user?.theme, isVaultEligible]);

  useEffect(() => {
    if (user) {
      setProfile({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        email: user.email || '',
      });
    }
  }, [user]);

  const handleThemeToggle = async () => {
    const newTheme = isDark ? 'light' : 'dark';
    setIsDark(!isDark);

    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    try {
      await updateProfile({ theme: newTheme });
      toast.success(t('settings.theme_success', { theme: t(`settings.theme_${newTheme}`) }));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('settings.theme_error')));
      setIsDark(isDark); // Revert on error
      // Revert DOM class on error
      if (isDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile(profile);
      toast.success(t('profile.update_success'));
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('profile.update_error')));
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.newPassword !== password.confirmPassword) {
      toast.error(t('settings.confirm_password_placeholder')); 
      return;
    }

    const pwdValidation = validatePasswordStrength(password.newPassword);
    if (!pwdValidation.valid) {
      toast.error(t('common.password_too_short'));
      return;
    }

    try {
      await authService.changePassword(
        password.oldPassword,
        password.newPassword,
        password.mfaCode.trim() || undefined
      );
      toast.success(t('settings.change_password')); // Simplified
      setPassword({ oldPassword: '', newPassword: '', confirmPassword: '', mfaCode: '' });
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('common.error')));
    }
  };

  const refreshVaultStatus = async () => {
    if (!isVaultEligible) return;
    const data = await vaultService.getStatus();
    setVaultStatus(data.status);
    await useAuthStore.getState().refreshProfile();
    await refreshGlobalVaultStatus();
  };

  const accountStatus = user?.accountStatus || 'ACTIVE';
  const accountStatusLabel =
    accountStatus === 'ACTIVE' ? t('settings.account.active') : accountStatus === 'INACTIVE' ? t('settings.account.inactive') : t('settings.account.suspended');
  
  const accountStatusClasses =
    accountStatus === 'ACTIVE'
      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
      : accountStatus === 'INACTIVE'
        ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400';
  const accountDotClass =
    accountStatus === 'ACTIVE'
      ? 'bg-green-500'
      : accountStatus === 'INACTIVE'
        ? 'bg-amber-500'
        : 'bg-red-500';

  const handleVaultSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    const pwdValidation = validatePasswordStrength(vaultSetup.password);
    if (!pwdValidation.valid) {
        toast.error(t('common.password_too_short'));
        return;
    }
    try {
      await vaultService.setup(vaultSetup.password, vaultSetup.totpCode);
      setVaultSetup({ password: '', totpCode: '' });
      toast.success(t('settings.vault.activate')); 
      await refreshVaultStatus();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('common.error')));
    }
  };

  const handleVaultUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await vaultService.unlock(vaultUnlock.password, vaultUnlock.totpCode);
      setVaultUnlock({ password: '', totpCode: '' });
      toast.success(t('settings.vault.unlocked')); 
      await refreshVaultStatus();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('common.error')));
    }
  };

  const handleVaultLock = async () => {
    try {
      await vaultService.lock();
      toast.success(t('settings.vault.locked')); 
      await refreshVaultStatus();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('common.error')));
    }
  };

  const handleVaultRotatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const pwdValidation = validatePasswordStrength(vaultRotate.newPassword);
    if (!pwdValidation.valid) {
        toast.error(t('common.password_too_short'));
        return;
    }
    try {
      await vaultService.rotatePassword(
        vaultRotate.oldPassword,
        vaultRotate.newPassword,
        vaultRotate.totpCode
      );
      setVaultRotate({ oldPassword: '', newPassword: '', totpCode: '' });
      toast.success(t('settings.vault.update_password')); 
      await refreshVaultStatus();
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('common.error')));
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-lg">
          <User className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('settings.title')}</h1>
          <p className="text-gray-500 dark:text-gray-400">{t('settings.subtitle')}</p>
        </div>
      </div>

      {/* Language Selection Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Languages className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {t('settings.language')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {t('settings.language_choice')}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                i18n.changeLanguage('fr');
                updateProfile({ language: 'fr' }).catch(console.error);
              }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                i18n.language.startsWith('fr')
                  ? 'bg-primary-500 text-white shadow-md'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
               Français
            </button>
            <button
              onClick={() => {
                i18n.changeLanguage('en');
                updateProfile({ language: 'en' }).catch(console.error);
              }}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                i18n.language.startsWith('en')
                  ? 'bg-primary-500 text-white shadow-md'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              English
            </button>
          </div>
        </div>
      </div>

      {/* Storage Quota Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <HardDrive className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('settings.storage')}
          </h2>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {formatBytes(quotaUsed)} {t('settings.storage_used_text')}
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              {formatBytes(quotaLimit)} {t('settings.storage_total_text')}
            </span>
          </div>

          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${quotaPercentage > 90
                ? 'bg-gradient-to-r from-red-500 to-red-600'
                : quotaPercentage > 70
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                  : 'bg-gradient-to-r from-primary-500 to-primary-600'
                }`}
              style={{ width: `${Math.min(quotaPercentage, 100)}%` }}
            />
          </div>

          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('settings.storage_usage', { percentage: quotaPercentage.toFixed(1) })}
            {quotaPercentage > 90 && (
              <span className="text-red-500 font-medium ml-2">
                {t('settings.storage_full')}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Theme Toggle Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              {isDark ? (
                <Moon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              ) : (
                <Sun className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {t('settings.theme')}
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isDark ? t('settings.theme_dark') : t('settings.theme_light')}
              </p>
            </div>
          </div>

          <button
            onClick={handleThemeToggle}
            className={`relative w-16 h-8 rounded-full transition-all duration-300 ${isDark
              ? 'bg-primary-600'
              : 'bg-gray-300 dark:bg-gray-600'
              }`}
          >
            <div
              className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 flex items-center justify-center ${isDark ? 'left-9' : 'left-1'
                }`}
            >
              {isDark ? (
                <Moon className="w-4 h-4 text-primary-600" />
              ) : (
                <Sun className="w-4 h-4 text-yellow-500" />
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Profile Information Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <User className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('settings.personal_info')}
          </h2>
        </div>

        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('settings.first_name')}
              </label>
              <input
                type="text"
                value={profile.firstName}
                onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                placeholder={t('settings.first_name_placeholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('settings.last_name')}
              </label>
              <input
                type="text"
                value={profile.lastName}
                onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                placeholder={t('settings.last_name_placeholder')}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('settings.email')}
            </label>
            <input
              type="email"
              value={profile.email}
              disabled
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 dark:text-gray-400 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {t('settings.email_locked')}
            </p>
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all shadow-md hover:shadow-lg font-medium"
          >
            {t('settings.save')}
          </button>
        </form>
      </div>

      {/* Security Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <Lock className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('settings.security')}
          </h2>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('settings.current_password')}
            </label>
            <input
              type="password"
              value={password.oldPassword}
              onChange={(e) => setPassword({ ...password, oldPassword: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
              placeholder={t('settings.current_password_placeholder')}
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('settings.new_password')}
              </label>
              <input
                type="password"
                value={password.newPassword}
                onChange={(e) => setPassword({ ...password, newPassword: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                placeholder={t('settings.new_password_placeholder')}
                required
              />
              {password.newPassword.length > 0 && (
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
                      const isValid = validatePasswordStrength(password.newPassword)[rule.key as keyof ReturnType<typeof validatePasswordStrength>];
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('settings.confirm_password')}
              </label>
              <input
                type="password"
                value={password.confirmPassword}
                onChange={(e) => setPassword({ ...password, confirmPassword: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                placeholder={t('settings.confirm_password_placeholder')}
                required
              />
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {t('settings.password_hint')}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('settings.mfa_code')}
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={password.mfaCode}
              onChange={(e) => setPassword({ ...password, mfaCode: e.target.value.trim() })}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
              placeholder={t('settings.mfa_code_placeholder')}
            />
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all shadow-md hover:shadow-lg font-medium"
          >
            {t('settings.change_password')}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            {t('settings.active_sessions')}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            {t('settings.logout_all_desc')}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                logout();
              }}
              className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors text-sm font-medium flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              {t('common.logout')}
            </button>
            <button
              onClick={async () => {
                if (confirm(t('common.confirm'))) {
                  try {
                    await authService.logoutAll();
                    toast.success(t('settings.logout_all_button')); // Simplified
                    setTimeout(() => {
                      window.location.href = '/login';
                    }, 1000);
                  } catch (error) {
                    toast.error(getApiErrorMessage(error, t('common.error')));
                  }
                }
              }}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium flex items-center gap-2"
            >
              <Shield className="w-4 h-4" />
              {t('settings.logout_all_button')}
            </button>
          </div>
        </div>
      </div>

      {/* Vault Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
            <Shield className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('settings.vault.title')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('settings.vault.description')}
            </p>
          </div>
        </div>

        {!isVaultEligible ? (
          <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-900/20 p-4 space-y-3">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              {t('settings.vault.not_eligible')}
            </p>
            <Link
              to="/plans"
              className="inline-flex px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700"
            >
              {t('settings.vault.see_plans')}
            </Link>
          </div>
        ) : !vaultStatus?.enabled ? (
          <form onSubmit={handleVaultSetup} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <input
                  type="password"
                  value={vaultSetup.password}
                  onChange={(e) => setVaultSetup((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder={t('settings.vault.password')}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                  required
                />
                {vaultSetup.password.length > 0 && (
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
                        const isValid = validatePasswordStrength(vaultSetup.password)[rule.key as keyof ReturnType<typeof validatePasswordStrength>];
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
              <input
                type="text"
                inputMode="numeric"
                value={vaultSetup.totpCode}
                onChange={(e) => setVaultSetup((prev) => ({ ...prev, totpCode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                placeholder={t('settings.vault.mfa_placeholder')}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {t('settings.vault.setup_hint')}
            </p>
            <button
              type="submit"
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md font-medium"
            >
              {t('settings.vault.activate')}
            </button>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40">
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  {t('settings.vault.status')}: <span className="font-semibold">{vaultStatus.unlocked ? t('settings.vault.unlocked') : t('settings.vault.locked')}</span>
                </p>
                {vaultStatus.unlockUntil && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {t('settings.vault.access_until', { date: new Date(vaultStatus.unlockUntil).toLocaleString(i18n.language === 'fr' ? 'fr-FR' : 'en-US') })}
                  </p>
                )}
              </div>
              {vaultStatus.unlocked ? (
                <button
                  onClick={handleVaultLock}
                  className="px-4 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 text-sm font-medium"
                >
                  {t('settings.vault.lock_now')}
                </button>
              ) : null}
            </div>

            {!vaultStatus.unlocked && (
              <form onSubmit={handleVaultUnlock} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <input
                    type="password"
                    value={vaultUnlock.password}
                    onChange={(e) => setVaultUnlock((prev) => ({ ...prev, password: e.target.value }))}
                    placeholder={t('settings.vault.password')}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={vaultUnlock.totpCode}
                    onChange={(e) => setVaultUnlock((prev) => ({ ...prev, totpCode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                    placeholder={t('settings.vault.mfa_placeholder')}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md font-medium"
                >
                  {t('settings.vault.unlock')}
                </button>
              </form>
            )}

            <form onSubmit={handleVaultRotatePassword} className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('settings.vault.rotation_title')}</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="password"
                  value={vaultRotate.oldPassword}
                  onChange={(e) => setVaultRotate((prev) => ({ ...prev, oldPassword: e.target.value }))}
                  placeholder={t('settings.current_password')}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                  required
                />
                <div className="space-y-2">
                  <input
                    type="password"
                    value={vaultRotate.newPassword}
                    onChange={(e) => setVaultRotate((prev) => ({ ...prev, newPassword: e.target.value }))}
                    placeholder={t('settings.new_password')}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                  {vaultRotate.newPassword.length > 0 && (
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
                          const isValid = validatePasswordStrength(vaultRotate.newPassword)[rule.key as keyof ReturnType<typeof validatePasswordStrength>];
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
                <input
                  type="text"
                  inputMode="numeric"
                  value={vaultRotate.totpCode}
                  onChange={(e) => setVaultRotate((prev) => ({ ...prev, totpCode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  placeholder={t('settings.vault.mfa_placeholder')}
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium"
              >
                {t('settings.vault.update_password')}
              </button>
            </form>
          </div>
        )}
      </div>

      {/* MFA Section */}
      <MFASettingsSection />

      {/* RGPD Section */}
      <RGPDSection />

      {/* Account Info Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
            <Calendar className="w-5 h-5 text-primary-600 dark:text-primary-300" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {t('settings.account.title')}
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{t('settings.account.id')}</p>
            <p className="font-mono text-sm text-gray-900 dark:text-white truncate">
              {user?.id || 'N/A'}
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{t('settings.account.status')}</p>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${accountStatusClasses}`}>
              <span className={`w-2 h-2 rounded-full ${accountDotClass} ${accountStatus === 'ACTIVE' ? 'animate-pulse' : ''}`}></span>
              {accountStatusLabel}
            </span>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              {t('settings.account.status_desc')}
            </p>
          </div>
        </div>
      </div>

      {/* Account Access (Delegation/Switch) Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
            <User className="w-5 h-5 text-indigo-600 dark:text-indigo-300" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('account_access.title')}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Gérez les délégations et les comptes liés (basculer entre vos comptes).
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsAccountSwitcherOpen(true)}
          className="px-6 py-3 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all font-medium"
        >
          Ouvrir le gestionnaire d'accès
        </button>
      </div>

      {/* Activity Log Section */}
      {auditAvailable ? (
        <ActivityLog />
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6 text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <Activity className="w-7 h-7 text-primary-600 dark:text-primary-300" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
            {t('plan_upgrade.audit_title')}
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
            {t('plan_upgrade.audit_description')}
          </p>
          <Link
            to="/plans"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
          >
            {t('plan_upgrade.cta')}
          </Link>
        </div>
      )}

      <AccountSwitcherModal
        isOpen={isAccountSwitcherOpen}
        onClose={() => setIsAccountSwitcherOpen(false)}
      />
    </div>
  );
}
