import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { AdminOverview, AdminUserRow } from '@/types';
import { adminService } from '@/services/adminService';
import { Users, HardDrive, FolderOpen, Upload } from 'lucide-react';

const PLAN_OPTIONS: Array<'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE'> = ['FREE', 'PRO', 'BUSINESS', 'ENTERPRISE'];

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
};

export default function AdminPage() {
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<'ALL' | 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE'>('ALL');
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [updatingUsers, setUpdatingUsers] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadOverview();
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadUsers(page);
    }, 250);

    return () => clearTimeout(timeout);
  }, [page, search, planFilter]);

  const loadOverview = async () => {
    setIsLoadingOverview(true);
    try {
      const data = await adminService.getOverview();
      setOverview(data);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Impossible de charger les KPIs admin');
    } finally {
      setIsLoadingOverview(false);
    }
  };

  const loadUsers = async (targetPage: number) => {
    setIsLoadingUsers(true);
    try {
      const response = await adminService.listUsers({
        page: targetPage,
        limit,
        search: search || undefined,
        plan: planFilter === 'ALL' ? undefined : planFilter,
      });
      setUsers(response.users);
      setTotalPages(response.pagination.totalPages);
      setPage(response.pagination.page);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Impossible de charger les utilisateurs');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const handlePlanChange = async (userId: string, nextPlan: 'FREE' | 'PRO' | 'BUSINESS' | 'ENTERPRISE') => {
    setUpdatingUsers((prev) => ({ ...prev, [userId]: true }));
    try {
      const { user } = await adminService.updateUserPlan(userId, nextPlan);
      setUsers((prev) =>
        prev.map((entry) =>
          entry.id === userId
            ? {
              ...entry,
              plan: user.plan,
              quotaLimit: user.quotaLimit,
            }
            : entry
        )
      );
      toast.success('Plan utilisateur mis à jour');
      await loadOverview();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Échec de mise à jour du plan');
    } finally {
      setUpdatingUsers((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const planSummary = useMemo(() => {
    if (!overview) return [];
    return overview.distribution.plans.sort((a, b) => b.count - a.count);
  }, [overview]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Super Admin</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Pilotage global de la plateforme et gestion des plans utilisateurs
        </p>
      </div>

      {isLoadingOverview ? (
        <div className="flex items-center justify-center h-28">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      ) : overview ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">Utilisateurs</p>
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{overview.kpis.totalUsers}</p>
              <p className="text-xs text-gray-500 mt-1">{overview.kpis.totalAdmins} admins</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">Stockage global</p>
                <HardDrive className="w-5 h-5 text-purple-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{formatBytes(overview.kpis.totalQuotaUsed)}</p>
              <p className="text-xs text-gray-500 mt-1">
                {overview.kpis.storageUsagePercent.toFixed(1)}% de {formatBytes(overview.kpis.totalQuotaLimit)}
              </p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">Objets stockés</p>
                <FolderOpen className="w-5 h-5 text-green-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                {overview.kpis.totalFiles} fichiers
              </p>
              <p className="text-xs text-gray-500 mt-1">{overview.kpis.totalFolders} dossiers</p>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600 dark:text-gray-400">Activité 24h</p>
                <Upload className="w-5 h-5 text-orange-500" />
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">{overview.kpis.uploads24h} uploads</p>
              <p className="text-xs text-gray-500 mt-1">{overview.kpis.activeUsers24h} utilisateurs actifs</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-5">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Répartition des plans</h2>
            <div className="flex flex-wrap gap-2">
              {planSummary.map((entry) => (
                <span
                  key={entry.plan}
                  className="px-3 py-1.5 rounded-full bg-gray-100 dark:bg-gray-700 text-sm font-medium text-gray-800 dark:text-gray-200"
                >
                  {entry.plan}: {entry.count}
                </span>
              ))}
            </div>
          </div>
        </>
      ) : null}

      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Gestion des comptes</h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Rechercher email / nom"
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
            />
            <select
              value={planFilter}
              onChange={(e) => {
                setPlanFilter(e.target.value as typeof planFilter);
                setPage(1);
              }}
              className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
            >
              <option value="ALL">Tous les plans</option>
              {PLAN_OPTIONS.map((plan) => (
                <option key={plan} value={plan}>
                  {plan}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700/40">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Utilisateur</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Rôle</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Plan</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Stockage</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Fichiers</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase">Dernière activité</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {isLoadingUsers ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    Chargement des utilisateurs...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500 dark:text-gray-400">
                    Aucun utilisateur trouvé
                  </td>
                </tr>
              ) : (
                users.map((user) => (
                  <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {user.firstName || user.lastName
                          ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                          : user.email}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">{user.role}</td>
                    <td className="px-4 py-3">
                      <select
                        value={user.plan}
                        disabled={!!updatingUsers[user.id]}
                        onChange={(e) => handlePlanChange(user.id, e.target.value as typeof PLAN_OPTIONS[number])}
                        className="px-2 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white disabled:opacity-60"
                      >
                        {PLAN_OPTIONS.map((plan) => (
                          <option key={plan} value={plan}>
                            {plan}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {formatBytes(user.quotaUsed)} / {formatBytes(user.quotaLimit)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {user._count.files} fichiers, {user._count.folders} dossiers
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                      {format(new Date(user.lastActiveAt), 'dd/MM/yyyy HH:mm')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <button
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1 || isLoadingUsers}
            className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 disabled:opacity-50"
          >
            Précédent
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400">
            Page {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages || isLoadingUsers}
            className="px-3 py-1.5 rounded-md border border-gray-300 dark:border-gray-600 text-sm text-gray-700 dark:text-gray-300 disabled:opacity-50"
          >
            Suivant
          </button>
        </div>
      </div>
    </div>
  );
}
