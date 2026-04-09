import { useState } from 'react';
import { AlertTriangle, Download, Copy, Check, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';

interface BackupCodesModalProps {
  isOpen: boolean;
  codes: string[];
  onComplete: () => void;
}

export default function BackupCodesModal({ isOpen, codes, onComplete }: BackupCodesModalProps) {
  const { t, i18n } = useTranslation();
  const [codesCopied, setCodesCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleDownload = () => {
    const headerRow = t('backup_codes_modal.file_header').replace(/\\n/g, '\n');
    const generatedOnStr = t('backup_codes_modal.file_generated_on', {
      date: new Date().toLocaleString(i18n.language === 'fr' ? 'fr-FR' : 'en-US')
    }).replace(/\\n/g, '\n');

    const content = `${headerRow}${codes.map((code, index) => `${index + 1}. ${code}`).join('\n')}

${generatedOnStr}`;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `supfile-backup-codes-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast.success(t('backup_codes_modal.download_success'));
  };

  const handleCopy = () => {
    const content = codes.join('\n');
    navigator.clipboard.writeText(content);
    setCodesCopied(true);
    toast.success(t('backup_codes_modal.copy_success'));
    setTimeout(() => setCodesCopied(false), 2000);
  };

  const handleContinue = () => {
    if (!confirmed) {
      toast.error(t('backup_codes_modal.confirm_error'));
      return;
    }
    onComplete();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="relative w-full max-w-2xl bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header avec warning */}
        <div className="px-6 py-4 bg-orange-50 dark:bg-orange-900/20 border-b border-orange-200 dark:border-orange-800">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 mt-0.5">
              <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-orange-900 dark:text-orange-100">
                {t('backup_codes_modal.title')}
              </h2>
              <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                {t('backup_codes_modal.subtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Informations importantes */}
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900 dark:text-blue-100">
                <p className="font-semibold mb-1">{t('backup_codes_modal.what_are_these')}</p>
                <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-300">
                  <li>{t('backup_codes_modal.reason_1')}</li>
                  <li>{t('backup_codes_modal.reason_2')}</li>
                  <li>{t('backup_codes_modal.reason_3')}</li>
                </ul>
                <p className="mt-2 font-medium">
                  {t('backup_codes_modal.warning_once')}
                </p>
              </div>
            </div>
          </div>

          {/* Liste des codes */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              {t('backup_codes_modal.your_codes', { count: codes.length })}
            </h3>
            <div className="grid grid-cols-2 gap-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
              {codes.map((code, index) => (
                <div
                  key={index}
                  className="flex items-center space-x-2 px-3 py-2 bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-600"
                >
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-6">
                    {index + 1}.
                  </span>
                  <code className="flex-1 text-sm font-mono font-semibold text-gray-900 dark:text-white tracking-wider">
                    {code}
                  </code>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-center space-x-3 mb-6">
            <button
              onClick={handleDownload}
              className="flex items-center px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              {t('backup_codes_modal.download')}
            </button>
            <button
              onClick={handleCopy}
              className="flex items-center px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              {codesCopied ? (
                <>
                  <Check className="w-4 h-4 mr-2 text-green-600" />
                  {t('backup_codes_modal.copied')}
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" />
                  {t('backup_codes_modal.copy')}
                </>
              )}
            </button>
          </div>

          {/* Confirmation */}
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1 w-5 h-5 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {t('backup_codes_modal.checkbox_label')}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {t('backup_codes_modal.checkbox_desc')}
                </p>
              </div>
            </label>
          </div>

          {/* Bouton continuer */}
          <div className="flex items-center justify-end">
            <button
              onClick={handleContinue}
              disabled={!confirmed}
              className="px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {t('backup_codes_modal.continue')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
