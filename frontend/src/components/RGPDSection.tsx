import { useState } from 'react';
import { Download, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { authService } from '@/services/authService';
import toast from 'react-hot-toast';

export default function RGPDSection() {
  const [loading, setLoading] = useState(false);

  const handleExportData = async () => {
    setLoading(true);
    try {
      const blob = await authService.exportUserData();

      // Créer un lien de téléchargement
      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `supfile-data-export-${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Vos données ont été exportées avec succès');
    } catch (error: any) {
      console.error('Error exporting data:', error);
      toast.error(error.response?.data?.error || 'Erreur lors de l\'export des données');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center space-x-3 mb-6">
        <Shield className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Protection des données (RGPD)
        </h2>
      </div>

      <div className="space-y-6">
        {/* Information RGPD */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex">
            <AlertCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Vos droits selon le RGPD
              </h3>
              <div className="mt-2 text-sm text-blue-800 dark:text-blue-200">
                <p>Conformément au Règlement Général sur la Protection des Données (RGPD), vous avez le droit de :</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Accéder à vos données personnelles</li>
                  <li>Rectifier vos données personnelles</li>
                  <li>Obtenir une copie de vos données (portabilité)</li>
                  <li>Supprimer votre compte et vos données</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Export des données */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
            Exporter mes données
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Téléchargez une copie complète de toutes vos données personnelles stockées sur SUPFILE, incluant votre profil, vos fichiers, vos dossiers et vos paramètres de sécurité.
          </p>
          <button
            onClick={handleExportData}
            disabled={loading}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Exportation en cours...
              </>
            ) : (
              <>
                <Download className="w-5 h-5 mr-2" />
                Télécharger mes données
              </>
            )}
          </button>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Format : JSON • Taille : Variable selon vos données
          </p>
        </div>

        {/* Suppression du compte */}
        <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-red-600 dark:text-red-400 mb-3">
            Zone dangereuse
          </h3>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <h4 className="text-sm font-medium text-red-900 dark:text-red-100 mb-2">
              Supprimer mon compte
            </h4>
            <p className="text-sm text-red-800 dark:text-red-200 mb-4">
              Une fois votre compte supprimé, toutes vos données seront définitivement effacées. Cette action est irréversible.
            </p>
            <button
              disabled
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title="Fonctionnalité à venir"
            >
              Supprimer mon compte
            </button>
            <p className="text-xs text-red-600 dark:text-red-400 mt-2">
              Pour supprimer votre compte, veuillez contacter le support
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
