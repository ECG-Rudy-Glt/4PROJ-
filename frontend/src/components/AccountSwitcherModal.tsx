import { useEffect, useState } from 'react';
import { X, RefreshCw, UserPlus, Shield, ArrowRightLeft, Undo2, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { accountAccessService, AccountSwitchLink, DelegationRecord } from '@/services/accountAccessService';
import { useAuthStore } from '@/stores/useAuthStore';

interface AccountSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function AccountSwitcherModal({ isOpen, onClose }: AccountSwitcherModalProps) {
  const { user, sessionContext, setAuthToken } = useAuthStore();

  const [isLoading, setIsLoading] = useState(false);
  const [links, setLinks] = useState<AccountSwitchLink[]>([]);
  const [delegationsGiven, setDelegationsGiven] = useState<DelegationRecord[]>([]);
  const [delegationsReceived, setDelegationsReceived] = useState<DelegationRecord[]>([]);
  const [form, setForm] = useState({
    email: '',
    password: '',
    mfaCode: '',
    backupCode: '',
    label: '',
  });
  const [grantForm, setGrantForm] = useState({
    delegateEmail: '',
    canWrite: false,
    canDelete: false,
    canShare: false,
    expiresAt: '',
  });

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [switchData, delegationData] = await Promise.all([
        accountAccessService.listSwitchLinks(),
        accountAccessService.listDelegations(),
      ]);
      setLinks(switchData.links || []);
      setDelegationsGiven(delegationData.given || []);
      setDelegationsReceived(delegationData.received || []);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Impossible de charger les données de switch');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void loadData();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLinkAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await accountAccessService.addSwitchLink({
        email: form.email.trim(),
        password: form.password,
        mfaCode: form.mfaCode.trim() || undefined,
        backupCode: form.backupCode.trim() || undefined,
        label: form.label.trim() || undefined,
      });
      toast.success('Compte lié avec succès');
      setForm({ email: '', password: '', mfaCode: '', backupCode: '', label: '' });
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Échec de liaison du compte');
    }
  };

  const handleSwitch = async (linkId: string) => {
    try {
      const { token, user: nextUser } = await accountAccessService.switchToLinkedAccount(linkId);
      await setAuthToken(token);
      toast.success(`Session active: ${nextUser.email}`);
      onClose();
    } catch (error: any) {
      if (error.response?.data?.code === 'REAUTH_REQUIRED') {
        toast.error('Re-authentification requise: reliez à nouveau ce compte');
        return;
      }
      toast.error(error.response?.data?.error || 'Échec du switch de compte');
    }
  };

  const handleSwitchBack = async () => {
    try {
      const { token, user: nextUser } = await accountAccessService.switchBack();
      await setAuthToken(token);
      toast.success(`Retour sur ${nextUser.email}`);
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Impossible de revenir au compte principal');
    }
  };

  const handleRevokeLink = async (linkId: string) => {
    try {
      await accountAccessService.revokeSwitchLink(linkId);
      toast.success('Lien de switch supprimé');
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Échec de suppression');
    }
  };

  const handleGrantDelegation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await accountAccessService.grantDelegation({
        delegateEmail: grantForm.delegateEmail.trim(),
        permissions: {
          canRead: true,
          canWrite: grantForm.canWrite,
          canDelete: grantForm.canDelete,
          canShare: grantForm.canShare,
        },
        expiresAt: grantForm.expiresAt ? new Date(grantForm.expiresAt).toISOString() : null,
      });
      toast.success('Délégation accordée');
      setGrantForm({
        delegateEmail: '',
        canWrite: false,
        canDelete: false,
        canShare: false,
        expiresAt: '',
      });
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Échec de création de délégation');
    }
  };

  const handleRevokeDelegation = async (delegationId: string) => {
    try {
      await accountAccessService.revokeDelegation(delegationId);
      toast.success('Délégation révoquée');
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Échec de révocation');
    }
  };

  const handleAssumeDelegation = async (delegationId: string) => {
    try {
      const { token, user: nextUser } = await accountAccessService.assumeDelegation(delegationId);
      await setAuthToken(token);
      toast.success(`Vous agissez maintenant au nom de ${nextUser.email}`);
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Échec de prise de délégation');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary-600 dark:text-primary-300" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Switch de comptes & délégation</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500"
            aria-label="Fermer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-8">
          <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/30">
            <p className="text-sm text-gray-600 dark:text-gray-300">
              Compte actif: <span className="font-semibold text-gray-900 dark:text-white">{user?.email}</span>
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Mode session: <span className="font-medium">{sessionContext?.authType || 'DIRECT'}</span>
            </p>
            {sessionContext?.authType !== 'DIRECT' && (
              <button
                onClick={handleSwitchBack}
                className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-primary-600 text-white text-sm hover:bg-primary-700"
              >
                <Undo2 className="w-4 h-4" />
                Revenir au compte principal
              </button>
            )}
          </div>

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary-600 dark:text-primary-300" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Comptes liés</h3>
            </div>

            {isLoading ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Chargement...</p>
            ) : links.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">Aucun compte lié pour le moment.</p>
            ) : (
              <div className="space-y-2">
                {links.map((link) => (
                  <div
                    key={link.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {link.targetUser.firstName || link.targetUser.email}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{link.targetUser.email}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Réauth: {new Date(link.lastAuthenticatedAt).toLocaleString('fr-FR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleSwitch(link.id)}
                        className="px-3 py-2 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700"
                      >
                        Switch
                      </button>
                      <button
                        onClick={() => handleRevokeLink(link.id)}
                        className="px-3 py-2 text-sm rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <form onSubmit={handleLinkAccount} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-white">
                <UserPlus className="w-4 h-4" />
                Ajouter un compte lié
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="Email du compte à lier"
                  required
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                />
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                  placeholder="Mot de passe"
                  required
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                />
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.mfaCode}
                  onChange={(e) => setForm((prev) => ({ ...prev, mfaCode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  placeholder="Code MFA (optionnel)"
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                />
                <input
                  type="text"
                  value={form.backupCode}
                  onChange={(e) => setForm((prev) => ({ ...prev, backupCode: e.target.value.toUpperCase().slice(0, 8) }))}
                  placeholder="Code de récupération (optionnel)"
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                />
              </div>
              <input
                type="text"
                value={form.label}
                onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
                placeholder="Libellé (optionnel)"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm hover:bg-primary-700"
              >
                Lier le compte
              </button>
            </form>
          </section>

          <section className="space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary-600 dark:text-primary-300" />
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">Délégations</h3>
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Délégations reçues</p>
              {delegationsReceived.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Aucune délégation reçue.</p>
              ) : (
                delegationsReceived.map((delegation) => (
                  <div
                    key={delegation.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {delegation.ownerUser?.email || delegation.ownerUserId}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Permissions: R={delegation.canRead ? 'Y' : 'N'} W={delegation.canWrite ? 'Y' : 'N'} D={delegation.canDelete ? 'Y' : 'N'} S={delegation.canShare ? 'Y' : 'N'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleAssumeDelegation(delegation.id)}
                      className="px-3 py-2 text-sm rounded-lg bg-primary-600 text-white hover:bg-primary-700"
                    >
                      Assumer
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Délégations accordées</p>
              {delegationsGiven.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">Aucune délégation accordée.</p>
              ) : (
                delegationsGiven.map((delegation) => (
                  <div
                    key={delegation.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {delegation.delegateUser?.email || delegation.delegateUserId}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Permissions: R={delegation.canRead ? 'Y' : 'N'} W={delegation.canWrite ? 'Y' : 'N'} D={delegation.canDelete ? 'Y' : 'N'} S={delegation.canShare ? 'Y' : 'N'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleRevokeDelegation(delegation.id)}
                      className="px-3 py-2 text-sm rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      Révoquer
                    </button>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleGrantDelegation} className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
              <p className="text-sm font-medium text-gray-900 dark:text-white">Accorder une délégation</p>
              <input
                type="email"
                value={grantForm.delegateEmail}
                onChange={(e) => setGrantForm((prev) => ({ ...prev, delegateEmail: e.target.value }))}
                placeholder="Email du délégataire"
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
              />
              <div className="flex flex-wrap gap-4 text-sm text-gray-700 dark:text-gray-300">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={grantForm.canWrite}
                    onChange={(e) => setGrantForm((prev) => ({ ...prev, canWrite: e.target.checked }))}
                  />
                  Écriture
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={grantForm.canDelete}
                    onChange={(e) => setGrantForm((prev) => ({ ...prev, canDelete: e.target.checked }))}
                  />
                  Suppression
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={grantForm.canShare}
                    onChange={(e) => setGrantForm((prev) => ({ ...prev, canShare: e.target.checked }))}
                  />
                  Partage
                </label>
              </div>
              <input
                type="datetime-local"
                value={grantForm.expiresAt}
                onChange={(e) => setGrantForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
              />
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-primary-600 text-white text-sm hover:bg-primary-700"
              >
                Créer la délégation
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
