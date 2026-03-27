import { useEffect, useState } from 'react';
import {
  X, RefreshCw, UserPlus, Shield, ArrowRightLeft, Undo2, Trash2,
  Eye, Pencil, Trash, Share2, Clock, ChevronRight, Plus, Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { accountAccessService, AccountSwitchLink, DelegationRecord } from '@/services/accountAccessService';
import { useAuthStore } from '@/stores/useAuthStore';

interface AccountSwitcherModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'accounts' | 'delegations';

function Avatar({ name, email }: { name?: string | null; email: string }) {
  const initials = name
    ? name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2)
    : email.slice(0, 2).toUpperCase();
  return (
    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-sm font-semibold shrink-0">
      {initials}
    </div>
  );
}

function PermBadge({ label, icon: Icon, active }: { label: string; icon: React.ElementType; active: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
      active
        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300'
        : 'bg-gray-100 text-gray-400 dark:bg-gray-700 dark:text-gray-500 line-through'
    }`}>
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

export default function AccountSwitcherModal({ isOpen, onClose }: AccountSwitcherModalProps) {
  const { user, sessionContext, setAuthToken } = useAuthStore();

  const [tab, setTab] = useState<Tab>('accounts');
  const [isLoading, setIsLoading] = useState(false);
  const [links, setLinks] = useState<AccountSwitchLink[]>([]);
  const [delegationsGiven, setDelegationsGiven] = useState<DelegationRecord[]>([]);
  const [delegationsReceived, setDelegationsReceived] = useState<DelegationRecord[]>([]);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [showGrantForm, setShowGrantForm] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', mfaCode: '', backupCode: '', label: '' });
  const [grantForm, setGrantForm] = useState({
    delegateEmail: '', canWrite: false, canDelete: false, canShare: false, expiresAt: '',
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
      toast.error(error.response?.data?.error || 'Impossible de charger les données');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) void loadData();
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
      setShowLinkForm(false);
      await loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Échec de liaison du compte');
    }
  };

  const handleSwitch = async (linkId: string) => {
    try {
      const { token, user: nextUser } = await accountAccessService.switchToLinkedAccount(linkId);
      await setAuthToken(token);
      toast.success(`Session active : ${nextUser.email}`);
      onClose();
    } catch (error: any) {
      if (error.response?.data?.code === 'REAUTH_REQUIRED') {
        toast.error('Re-authentification requise : reliez à nouveau ce compte');
        return;
      }
      toast.error(error.response?.data?.error || 'Échec du changement de compte');
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
      toast.success('Compte dissocié');
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
      toast.success('Délégation créée');
      setGrantForm({ delegateEmail: '', canWrite: false, canDelete: false, canShare: false, expiresAt: '' });
      setShowGrantForm(false);
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
      toast.success(`Vous agissez au nom de ${nextUser.email}`);
      onClose();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Échec de prise de délégation');
    }
  };

  const isDelegated = sessionContext?.authType && sessionContext.authType !== 'DIRECT';
  const displayName = (u?: { firstName?: string | null; lastName?: string | null; email: string } | null) =>
    u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-xl max-h-[92vh] flex flex-col rounded-t-2xl sm:rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
              <ArrowRightLeft className="w-4 h-4 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">Gestion des accès</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Active session banner */}
        <div className="px-5 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar name={[user?.firstName, user?.lastName].filter(Boolean).join(' ')} email={user?.email ?? ''} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{user?.email}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {isDelegated ? (
                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                    <Shield className="w-3 h-3" /> Session déléguée
                  </span>
                ) : (
                  <span className="text-green-600 dark:text-green-400 font-medium">Session directe</span>
                )}
              </p>
            </div>
          </div>
          {isDelegated && (
            <button
              onClick={handleSwitchBack}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-medium hover:opacity-80 transition-opacity"
            >
              <Undo2 className="w-3.5 h-3.5" />
              Revenir
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-100 dark:border-gray-800 px-5">
          {([
            { id: 'accounts' as Tab, label: 'Comptes liés', icon: RefreshCw, count: links.length },
            { id: 'delegations' as Tab, label: 'Délégations', icon: Users, count: delegationsReceived.length + delegationsGiven.length },
          ] as const).map(({ id, label, icon: Icon, count }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-1 py-3 mr-6 text-sm font-medium border-b-2 transition-colors ${
                tab === id
                  ? 'border-primary-600 text-primary-600 dark:text-primary-400 dark:border-primary-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                  tab === id ? 'bg-primary-100 text-primary-600 dark:bg-primary-900/40 dark:text-primary-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                }`}>{count}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-400">
              <RefreshCw className="w-5 h-5 animate-spin mr-2" />
              Chargement...
            </div>
          ) : tab === 'accounts' ? (
            <div className="p-5 space-y-4">
              {/* Linked accounts list */}
              {links.length === 0 && !showLinkForm ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-3">
                    <RefreshCw className="w-5 h-5 text-gray-400" />
                  </div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Aucun compte lié</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Liez un autre compte pour basculer rapidement</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {links.map((link) => (
                    <div
                      key={link.id}
                      className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-gray-200 dark:hover:border-gray-700 bg-white dark:bg-gray-800/50 transition-colors group"
                    >
                      <Avatar name={displayName(link.targetUser)} email={link.targetUser.email} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {link.label || displayName(link.targetUser)}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{link.targetUser.email}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Lié le {new Date(link.lastAuthenticatedAt).toLocaleDateString('fr-FR')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleSwitch(link.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-medium hover:bg-primary-700 transition-colors"
                        >
                          Basculer
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleRevokeLink(link.id)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                          title="Dissocier"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add link form */}
              {showLinkForm ? (
                <div className="rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-900/10 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <UserPlus className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                      Lier un compte
                    </p>
                    <button onClick={() => setShowLinkForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={handleLinkAccount} className="space-y-2.5">
                    <input
                      type="text"
                      value={form.label}
                      onChange={(e) => setForm((prev) => ({ ...prev, label: e.target.value }))}
                      placeholder="Libellé (ex: Compte pro)"
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                        placeholder="Email"
                        required
                        className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <input
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
                        placeholder="Mot de passe"
                        required
                        className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        inputMode="numeric"
                        value={form.mfaCode}
                        onChange={(e) => setForm((prev) => ({ ...prev, mfaCode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                        placeholder="Code MFA (optionnel)"
                        className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <input
                        type="text"
                        value={form.backupCode}
                        onChange={(e) => setForm((prev) => ({ ...prev, backupCode: e.target.value.toUpperCase().slice(0, 8) }))}
                        placeholder="Code de récupération"
                        className="px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowLinkForm(false)}
                        className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
                      >
                        Lier le compte
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <button
                  onClick={() => setShowLinkForm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 dark:hover:border-primary-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Lier un autre compte
                </button>
              )}
            </div>
          ) : (
            <div className="p-5 space-y-5">
              {/* Received delegations */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Reçues ({delegationsReceived.length})
                </p>
                {delegationsReceived.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 py-2">Aucune délégation reçue</p>
                ) : (
                  delegationsReceived.map((d) => (
                    <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/50">
                      <Avatar name={displayName(d.ownerUser)} email={d.ownerUser?.email ?? ''} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{displayName(d.ownerUser)}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          <PermBadge label="Lecture" icon={Eye} active={d.canRead} />
                          <PermBadge label="Écriture" icon={Pencil} active={d.canWrite} />
                          <PermBadge label="Suppression" icon={Trash} active={d.canDelete} />
                          <PermBadge label="Partage" icon={Share2} active={d.canShare} />
                        </div>
                        {d.expiresAt && (
                          <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Expire le {new Date(d.expiresAt).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleAssumeDelegation(d.id)}
                        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 text-white text-xs font-medium hover:bg-primary-700 transition-colors"
                      >
                        Assumer
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Given delegations */}
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Accordées ({delegationsGiven.length})
                </p>
                {delegationsGiven.length === 0 && !showGrantForm ? (
                  <p className="text-sm text-gray-400 dark:text-gray-500 py-2">Aucune délégation accordée</p>
                ) : (
                  <div className="space-y-2">
                    {delegationsGiven.map((d) => (
                      <div key={d.id} className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/50 group">
                        <Avatar name={displayName(d.delegateUser)} email={d.delegateUser?.email ?? ''} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{displayName(d.delegateUser)}</p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            <PermBadge label="Lecture" icon={Eye} active={d.canRead} />
                            <PermBadge label="Écriture" icon={Pencil} active={d.canWrite} />
                            <PermBadge label="Suppression" icon={Trash} active={d.canDelete} />
                            <PermBadge label="Partage" icon={Share2} active={d.canShare} />
                          </div>
                          {d.expiresAt && (
                            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              Expire le {new Date(d.expiresAt).toLocaleDateString('fr-FR')}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => handleRevokeDelegation(d.id)}
                          className="shrink-0 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-800 text-red-500 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          Révoquer
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Grant delegation form */}
              {showGrantForm ? (
                <div className="rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50/50 dark:bg-primary-900/10 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                      Nouvelle délégation
                    </p>
                    <button onClick={() => setShowGrantForm(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={handleGrantDelegation} className="space-y-3">
                    <input
                      type="email"
                      value={grantForm.delegateEmail}
                      onChange={(e) => setGrantForm((prev) => ({ ...prev, delegateEmail: e.target.value }))}
                      placeholder="Email du délégué"
                      required
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Permissions accordées</p>
                      <div className="grid grid-cols-2 gap-2">
                        {([
                          { key: 'canWrite', label: 'Écriture', icon: Pencil },
                          { key: 'canDelete', label: 'Suppression', icon: Trash },
                          { key: 'canShare', label: 'Partage', icon: Share2 },
                        ] as const).map(({ key, label, icon: Icon }) => (
                          <label
                            key={key}
                            className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                              grantForm[key]
                                ? 'border-primary-300 bg-primary-50 dark:border-primary-700 dark:bg-primary-900/30'
                                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={grantForm[key]}
                              onChange={(e) => setGrantForm((prev) => ({ ...prev, [key]: e.target.checked }))}
                            />
                            <Icon className={`w-3.5 h-3.5 ${grantForm[key] ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400'}`} />
                            <span className={`text-xs font-medium ${grantForm[key] ? 'text-primary-700 dark:text-primary-300' : 'text-gray-600 dark:text-gray-400'}`}>
                              {label}
                            </span>
                          </label>
                        ))}
                        <label className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 cursor-not-allowed">
                          <Eye className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                          <span className="text-xs font-medium text-primary-700 dark:text-primary-300">Lecture</span>
                          <span className="ml-auto text-xs text-gray-400">Incluse</span>
                        </label>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5">Expiration (optionnel)</p>
                      <input
                        type="datetime-local"
                        value={grantForm.expiresAt}
                        onChange={(e) => setGrantForm((prev) => ({ ...prev, expiresAt: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setShowGrantForm(false)}
                        className="flex-1 px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        Annuler
                      </button>
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 rounded-lg bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
                      >
                        Créer
                      </button>
                    </div>
                  </form>
                </div>
              ) : (
                <button
                  onClick={() => setShowGrantForm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 dark:hover:border-primary-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Accorder une délégation
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
