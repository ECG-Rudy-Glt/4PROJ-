import { useState, useEffect } from 'react';
import { Shield, Smartphone, Trash2, RefreshCw, AlertCircle, Check, Loader2 } from 'lucide-react';
import { mfaService, TrustedDevice } from '@/services/mfaService';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import BackupCodesModal from './BackupCodesModal';

export default function MFASettingsSection() {
  const [trustedDevices, setTrustedDevices] = useState<TrustedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerateCode, setRegenerateCode] = useState('');
  const [showRegenerateModal, setShowRegenerateModal] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [newBackupCodes, setNewBackupCodes] = useState<string[]>([]);
  const [showBackupCodesModal, setShowBackupCodesModal] = useState(false);

  useEffect(() => {
    loadTrustedDevices();
  }, []);

  const loadTrustedDevices = async () => {
    setLoading(true);
    try {
      const devices = await mfaService.getTrustedDevices();
      setTrustedDevices(devices);
    } catch {
      toast.error('Erreur lors du chargement des appareils');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeDevice = async (deviceId: string, deviceName: string) => {
    if (!confirm(`Révoquer l'appareil "${deviceName}" ?`)) return;

    try {
      await mfaService.revokeTrustedDevice(deviceId);
      toast.success('Appareil révoqué');
      loadTrustedDevices();
    } catch {
      toast.error('Erreur lors de la révocation');
    }
  };

  const handleRegenerateCodes = async () => {
    if (regenerateCode.length !== 6) {
      toast.error('Code invalide');
      return;
    }

    setRegenerating(true);
    try {
      const result = await mfaService.regenerateBackupCodes(regenerateCode);
      setNewBackupCodes(result.backupCodes);
      setShowRegenerateModal(false);
      setShowBackupCodesModal(true);
      setRegenerateCode('');
      toast.success('Codes de récupération régénérés');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Erreur lors de la régénération');
    } finally {
      setRegenerating(false);
    }
  };

  const handleCodeChange = (value: string) => {
    const numericValue = value.replace(/[^0-9]/g, '').slice(0, 6);
    setRegenerateCode(numericValue);
  };

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <Shield className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Authentification à deux facteurs
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Sécurisez votre compte avec un code de vérification
            </p>
          </div>
        </div>

        {/* Statut MFA */}
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                <Check className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <div className="flex-1">
              <p className="font-medium text-green-900 dark:text-green-100">
                Authentification à deux facteurs activée
              </p>
              <p className="text-sm text-green-700 dark:text-green-300">
                Votre compte est sécurisé avec la vérification en deux étapes
              </p>
            </div>
          </div>
        </div>

        {/* Codes de récupération */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
            <RefreshCw className="w-5 h-5 mr-2" />
            Codes de récupération
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Régénérez vos codes de récupération si vous les avez perdus ou si vous pensez qu'ils ont été compromis.
          </p>
          <button
            onClick={() => setShowRegenerateModal(true)}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Régénérer les codes
          </button>
        </div>

        {/* Appareils de confiance */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3 flex items-center">
            <Smartphone className="w-5 h-5 mr-2" />
            Appareils de confiance ({trustedDevices.length})
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Ces appareils ne nécessitent pas de code lors de la connexion pendant 30 jours
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
            </div>
          ) : trustedDevices.length === 0 ? (
            <div className="p-6 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-center">
              <AlertCircle className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600 dark:text-gray-400">Aucun appareil de confiance</p>
            </div>
          ) : (
            <div className="space-y-3">
              {trustedDevices.map((device) => (
                <div
                  key={device.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="flex-shrink-0">
                      <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center">
                        <Smartphone className="w-5 h-5 text-primary-600 dark:text-primary-300" />
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">
                        {device.deviceName}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        IP: {device.ipAddress}
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400 mt-1">
                        <span>
                          Ajouté le {format(new Date(device.createdAt), 'dd MMM yyyy', { locale: fr })}
                        </span>
                        <span>
                          Expire le {format(new Date(device.expiresAt), 'dd MMM yyyy', { locale: fr })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRevokeDevice(device.id, device.deviceName)}
                    className="ml-4 p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Révoquer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal de régénération */}
      {showRegenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              Régénérer les codes de récupération
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Pour des raisons de sécurité, veuillez entrer votre code d'authentification pour régénérer vos codes de récupération.
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Code d'authentification
              </label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={regenerateCode}
                onChange={(e) => handleCodeChange(e.target.value)}
                placeholder="000000"
                className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:text-white"
                autoFocus
              />
            </div>
            <div className="flex items-center justify-end space-x-3">
              <button
                onClick={() => {
                  setShowRegenerateModal(false);
                  setRegenerateCode('');
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                disabled={regenerating}
              >
                Annuler
              </button>
              <button
                onClick={handleRegenerateCodes}
                disabled={regenerating || regenerateCode.length !== 6}
                className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {regenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Régénération...
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Régénérer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal des nouveaux codes */}
      <BackupCodesModal
        isOpen={showBackupCodesModal}
        codes={newBackupCodes}
        onComplete={() => setShowBackupCodesModal(false)}
      />
    </>
  );
}
