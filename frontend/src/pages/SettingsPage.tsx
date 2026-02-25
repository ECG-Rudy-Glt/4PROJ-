import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/stores/useAuthStore';
import { authService } from '@/services/authService';
import { User, Lock, HardDrive, Moon, Sun, Calendar, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import MFASettingsSection from '@/components/MFASettingsSection';
import RGPDSection from '@/components/RGPDSection';
import { vaultService, VaultStatus } from '@/services/vaultService';
import { formatBytes } from '@/utils/bytes';
import { isVaultAvailableForPlan } from '@/constants/plans';

export default function SettingsPage() {
  const { user, updateProfile } = useAuthStore();
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
  });
  const [vaultStatus, setVaultStatus] = useState<VaultStatus | null>(null);
  const [vaultSetup, setVaultSetup] = useState({ password: '', totpCode: '' });
  const [vaultUnlock, setVaultUnlock] = useState({ password: '', totpCode: '' });
  const [vaultRotate, setVaultRotate] = useState({ oldPassword: '', newPassword: '', totpCode: '' });

  const quotaUsed = user?.quotaUsed || 0;
  const quotaLimit = user?.quotaLimit || 32212254720; // 30GB default
  const quotaPercentage = quotaLimit > 0 ? (quotaUsed / quotaLimit) * 100 : 0;
  const currentPlan = user?.plan || 'FREE';
  const isVaultEligible = isVaultAvailableForPlan(currentPlan);

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
      toast.success(`Mode ${newTheme === 'dark' ? 'sombre' : 'clair'} activé`);
    } catch (error) {
      toast.error('Échec de la mise à jour du thème');
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
      toast.success('Profil mis à jour');
    } catch (error) {
      toast.error('Échec de la mise à jour du profil');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.newPassword !== password.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      return;
    }

    if (password.newPassword.length < 6) {
      toast.error('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    try {
      await authService.changePassword(password.oldPassword, password.newPassword);
      toast.success('Mot de passe modifié');
      setPassword({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Échec de la modification du mot de passe');
    }
  };

  const refreshVaultStatus = async () => {
    if (!isVaultEligible) return;
    const data = await vaultService.getStatus();
    setVaultStatus(data.status);
    await useAuthStore.getState().refreshProfile();
  };

  const handleVaultSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await vaultService.setup(vaultSetup.password, vaultSetup.totpCode);
      setVaultSetup({ password: '', totpCode: '' });
      toast.success('Coffre-fort activé');
      await refreshVaultStatus();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Activation du coffre-fort échouée');
    }
  };

  const handleVaultUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await vaultService.unlock(vaultUnlock.password, vaultUnlock.totpCode);
      setVaultUnlock({ password: '', totpCode: '' });
      toast.success('Coffre-fort déverrouillé');
      await refreshVaultStatus();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Déverrouillage du coffre-fort échoué');
    }
  };

  const handleVaultLock = async () => {
    try {
      await vaultService.lock();
      toast.success('Coffre-fort verrouillé');
      await refreshVaultStatus();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Verrouillage du coffre-fort échoué');
    }
  };

  const handleVaultRotatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await vaultService.rotatePassword(
        vaultRotate.oldPassword,
        vaultRotate.newPassword,
        vaultRotate.totpCode
      );
      setVaultRotate({ oldPassword: '', newPassword: '', totpCode: '' });
      toast.success('Mot de passe coffre-fort mis à jour');
      await refreshVaultStatus();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Rotation du mot de passe échouée');
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Mon Profil</h1>
          <p className="text-gray-500 dark:text-gray-400">Gérez les paramètres de votre compte</p>
        </div>
      </div>

      {/* Storage Quota Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <HardDrive className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Stockage
          </h2>
        </div>

        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {formatBytes(quotaUsed)} utilisés
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              {formatBytes(quotaLimit)} au total
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
            {quotaPercentage.toFixed(1)}% de votre stockage est utilisé
            {quotaPercentage > 90 && (
              <span className="text-red-500 font-medium ml-2">
                ⚠️ Stockage presque plein !
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
                Apparence
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isDark ? 'Mode sombre activé' : 'Mode clair activé'}
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
            Informations du profil
          </h2>
        </div>

        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Prénom
              </label>
              <input
                type="text"
                value={profile.firstName}
                onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                placeholder="Entrez votre prénom"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nom
              </label>
              <input
                type="text"
                value={profile.lastName}
                onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                placeholder="Entrez votre nom"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Adresse e-mail
            </label>
            <input
              type="email"
              value={profile.email}
              disabled
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 dark:text-gray-400 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              L'adresse e-mail ne peut pas être modifiée
            </p>
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all shadow-md hover:shadow-lg font-medium"
          >
            Enregistrer les modifications
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
            Sécurité
          </h2>
        </div>

        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Mot de passe actuel
            </label>
            <input
              type="password"
              value={password.oldPassword}
              onChange={(e) => setPassword({ ...password, oldPassword: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
              placeholder="Entrez votre mot de passe actuel"
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nouveau mot de passe
              </label>
              <input
                type="password"
                value={password.newPassword}
                onChange={(e) => setPassword({ ...password, newPassword: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                placeholder="Entrez le nouveau mot de passe"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Confirmer le nouveau mot de passe
              </label>
              <input
                type="password"
                value={password.confirmPassword}
                onChange={(e) => setPassword({ ...password, confirmPassword: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                placeholder="Confirmez le nouveau mot de passe"
                required
              />
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Le mot de passe doit contenir au moins 6 caractères
            </p>
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all shadow-md hover:shadow-lg font-medium"
          >
            Modifier le mot de passe
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-gray-100 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            Sessions actives
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Si vous pensez que votre compte est compromis, vous pouvez vous déconnecter de tous les autres appareils.
          </p>
          <button
            onClick={async () => {
              if (confirm('Êtes-vous sûr de vouloir vous déconnecter de tous les appareils ?')) {
                try {
                  await authService.logoutAll();
                  toast.success('Déconnecté de tous les appareils');
                  setTimeout(() => {
                    window.location.href = '/login';
                  }, 1000);
                } catch (error) {
                  toast.error('Erreur lors de la déconnexion globale');
                }
              }
            }}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm font-medium flex items-center gap-2"
          >
            <Shield className="w-4 h-4" />
            Se déconnecter de tous les appareils
          </button>
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
              Coffre-fort
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Protection renforcée par mot de passe dédié + MFA à chaque déverrouillage.
            </p>
          </div>
        </div>

        {!isVaultEligible ? (
          <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-900/20 p-4 space-y-3">
            <p className="text-sm text-amber-800 dark:text-amber-300">
              Le coffre-fort est disponible à partir du plan PRO.
            </p>
            <Link
              to="/plans"
              className="inline-flex px-4 py-2 rounded-lg bg-amber-600 text-white text-sm font-medium hover:bg-amber-700"
            >
              Voir les plans
            </Link>
          </div>
        ) : !vaultStatus?.enabled ? (
          <form onSubmit={handleVaultSetup} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="password"
                value={vaultSetup.password}
                onChange={(e) => setVaultSetup((prev) => ({ ...prev, password: e.target.value }))}
                placeholder="Mot de passe coffre-fort"
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                required
              />
              <input
                type="text"
                inputMode="numeric"
                value={vaultSetup.totpCode}
                onChange={(e) => setVaultSetup((prev) => ({ ...prev, totpCode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                placeholder="Code MFA (6 chiffres)"
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                required
              />
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Le mot de passe doit contenir 12+ caractères avec majuscule, minuscule, chiffre et symbole.
            </p>
            <button
              type="submit"
              className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md font-medium"
            >
              Activer le coffre-fort
            </button>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/40">
              <div>
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Statut: <span className="font-semibold">{vaultStatus.unlocked ? 'Déverrouillé' : 'Verrouillé'}</span>
                </p>
                {vaultStatus.unlockUntil && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Accès jusqu&apos;au {new Date(vaultStatus.unlockUntil).toLocaleString('fr-FR')}
                  </p>
                )}
              </div>
              {vaultStatus.unlocked ? (
                <button
                  onClick={handleVaultLock}
                  className="px-4 py-2 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 text-sm font-medium"
                >
                  Verrouiller maintenant
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
                    placeholder="Mot de passe coffre-fort"
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={vaultUnlock.totpCode}
                    onChange={(e) => setVaultUnlock((prev) => ({ ...prev, totpCode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                    placeholder="Code MFA (6 chiffres)"
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all shadow-md font-medium"
                >
                  Déverrouiller
                </button>
              </form>
            )}

            <form onSubmit={handleVaultRotatePassword} className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Rotation du mot de passe coffre-fort</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <input
                  type="password"
                  value={vaultRotate.oldPassword}
                  onChange={(e) => setVaultRotate((prev) => ({ ...prev, oldPassword: e.target.value }))}
                  placeholder="Mot de passe actuel"
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                  required
                />
                <input
                  type="password"
                  value={vaultRotate.newPassword}
                  onChange={(e) => setVaultRotate((prev) => ({ ...prev, newPassword: e.target.value }))}
                  placeholder="Nouveau mot de passe"
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                  required
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={vaultRotate.totpCode}
                  onChange={(e) => setVaultRotate((prev) => ({ ...prev, totpCode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  placeholder="Code MFA"
                  className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
                  required
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 text-sm font-medium"
              >
                Mettre à jour le mot de passe coffre-fort
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
            Informations du compte
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">ID du compte</p>
            <p className="font-mono text-sm text-gray-900 dark:text-white truncate">
              {user?.id || 'N/A'}
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Statut du compte</p>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-medium">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Actif
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
