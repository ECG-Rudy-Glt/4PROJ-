import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Loader2, Key, ArrowLeft } from 'lucide-react';
import { mfaService } from '@/services/mfaService';
import { useAuthStore } from '@/stores/useAuthStore';
import toast from 'react-hot-toast';

export default function MFAVerificationPage() {
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
      toast.error('Le code doit contenir 6 chiffres');
      return;
    }

    setLoading(true);
    try {
      const result = await mfaService.verifyMFA(userId, code, rememberDevice);

      // Stocker le token
      localStorage.setItem('token', result.token);
      localStorage.removeItem('tempToken');

      // Charger l'utilisateur dans le store
      await loadUser();

      toast.success('Authentification réussie !');
      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Code invalide');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyBackupCode = async () => {
    if (backupCode.length !== 8) {
      toast.error('Le code de récupération doit contenir 8 caractères');
      return;
    }

    setLoading(true);
    try {
      const result = await mfaService.verifyBackupCode(userId, backupCode.toUpperCase(), rememberDevice);

      // Stocker le token
      localStorage.setItem('token', result.token);
      localStorage.removeItem('tempToken');

      // Charger l'utilisateur dans le store
      await loadUser();

      if (result.warning) {
        toast.success(result.warning, { duration: 5000 });
      } else {
        toast.success('Authentification réussie !');
      }

      navigate('/dashboard');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Code de récupération invalide');
      setBackupCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
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
            Vérification en deux étapes
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {useBackupCode
              ? 'Entrez un code de récupération'
              : 'Entrez le code de votre application d\'authentification'}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700">
          <form onSubmit={handleSubmit} className="space-y-6">
            {!useBackupCode ? (
              <>
                {/* Code TOTP */}
                <div>
                  <label htmlFor="code" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Code de vérification
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
                    Code de récupération
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
                    Chaque code ne peut être utilisé qu'une seule fois
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
                    Se souvenir de cet appareil pendant 30 jours
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Vous ne devrez pas saisir de code lors de vos prochaines connexions
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
                  Vérification...
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5 mr-2" />
                  Vérifier
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
                {useBackupCode ? 'Utiliser un code d\'authentification' : 'Utiliser un code de récupération'}
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
                Me déconnecter
              </button>
            </div>
          </form>
        </div>

        {/* Aide */}
        <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          <p>Vous ne pouvez pas accéder à votre application d'authentification ?</p>
          <p className="mt-1">Utilisez un code de récupération pour vous connecter.</p>
        </div>
      </div>
    </div>
  );
}
