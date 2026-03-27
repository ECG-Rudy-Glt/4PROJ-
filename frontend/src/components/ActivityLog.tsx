import { useState, useEffect } from 'react';
import { auditService, AuditLog, AuditAction, ActivityStats } from '@/services/auditService';
import {
  Upload, Trash2, RotateCcw, Download, Share2, FolderPlus,
  FileText, LogIn, LogOut, Key, UserCircle, Tag, MessageCircle,
  History, Activity, Filter, ChevronLeft, ChevronRight, Shield,
  Lock, Unlock, Building, UserPlus, UserMinus, RefreshCw, ArrowDownCircle, UserCog, ArrowRightLeft
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

const ACTION_ICONS: { [key in AuditAction]: JSX.Element } = {
  UPLOAD: <Upload className="w-4 h-4" />,
  DELETE: <Trash2 className="w-4 h-4" />,
  RESTORE: <RotateCcw className="w-4 h-4" />,
  DOWNLOAD: <Download className="w-4 h-4" />,
  SHARE: <Share2 className="w-4 h-4" />,
  UNSHARE: <Share2 className="w-4 h-4" />,
  CREATE_FOLDER: <FolderPlus className="w-4 h-4" />,
  DELETE_FOLDER: <Trash2 className="w-4 h-4" />,
  MOVE_FILE: <FileText className="w-4 h-4" />,
  RENAME_FILE: <FileText className="w-4 h-4" />,
  LOGIN: <LogIn className="w-4 h-4" />,
  LOGOUT: <LogOut className="w-4 h-4" />,
  PASSWORD_CHANGE: <Key className="w-4 h-4" />,
  PROFILE_UPDATE: <UserCircle className="w-4 h-4" />,
  TAG_ADD: <Tag className="w-4 h-4" />,
  TAG_REMOVE: <Tag className="w-4 h-4" />,
  COMMENT_ADD: <MessageCircle className="w-4 h-4" />,
  COMMENT_DELETE: <MessageCircle className="w-4 h-4" />,
  VERSION_RESTORE: <History className="w-4 h-4" />,
  VERSION_DELETE: <History className="w-4 h-4" />,
  ADMIN_PLAN_CHANGE: <Shield className="w-4 h-4" />,
  PLAN_DOWNGRADE: <ArrowDownCircle className="w-4 h-4" />,
  VAULT_SETUP: <Shield className="w-4 h-4" />,
  VAULT_UNLOCK: <Unlock className="w-4 h-4" />,
  VAULT_LOCK: <Lock className="w-4 h-4" />,
  VAULT_PASSWORD_ROTATE: <Key className="w-4 h-4" />,
  ORG_CREATE: <Building className="w-4 h-4" />,
  ORG_MEMBER_ADD: <UserPlus className="w-4 h-4" />,
  ORG_MEMBER_ROLE_UPDATE: <UserCog className="w-4 h-4" />,
  ORG_MEMBER_REMOVE: <UserMinus className="w-4 h-4" />,
  ORG_SWITCH: <RefreshCw className="w-4 h-4" />,
  ACCOUNT_SWITCH_LINK_ADDED: <UserPlus className="w-4 h-4" />,
  ACCOUNT_SWITCH_LINK_REVOKED: <UserMinus className="w-4 h-4" />,
  ACCOUNT_SWITCH: <ArrowRightLeft className="w-4 h-4" />,
  ACCOUNT_SWITCH_BACK: <Undo2Icon />,
  DELEGATION_GRANTED: <Shield className="w-4 h-4" />,
  DELEGATION_REVOKED: <Shield className="w-4 h-4" />,
  DELEGATION_ASSUME: <ArrowRightLeft className="w-4 h-4" />,
  DELEGATION_STOP: <ArrowRightLeft className="w-4 h-4" />,
};

function Undo2Icon() {
  return <RefreshCw className="w-4 h-4" />;
}

// Action labels handled by translations 

const ACTION_COLORS: { [key in AuditAction]: string } = {
  UPLOAD: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
  DELETE: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
  RESTORE: 'text-primary-600 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20',
  DOWNLOAD: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20',
  SHARE: 'text-primary-600 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20',
  UNSHARE: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50',
  CREATE_FOLDER: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
  DELETE_FOLDER: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
  MOVE_FILE: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/20',
  RENAME_FILE: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/20',
  LOGIN: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
  LOGOUT: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50',
  PASSWORD_CHANGE: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20',
  PROFILE_UPDATE: 'text-primary-600 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20',
  TAG_ADD: 'text-pink-600 dark:text-pink-400 bg-pink-50 dark:bg-pink-900/20',
  TAG_REMOVE: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50',
  COMMENT_ADD: 'text-primary-600 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20',
  COMMENT_DELETE: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50',
  VERSION_RESTORE: 'text-primary-600 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20',
  VERSION_DELETE: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
  ADMIN_PLAN_CHANGE: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20',
  PLAN_DOWNGRADE: 'text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20',
  VAULT_SETUP: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20',
  VAULT_UNLOCK: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
  VAULT_LOCK: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
  VAULT_PASSWORD_ROTATE: 'text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-900/20',
  ORG_CREATE: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/20',
  ORG_MEMBER_ADD: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/20',
  ORG_MEMBER_ROLE_UPDATE: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/20',
  ORG_MEMBER_REMOVE: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/20',
  ORG_SWITCH: 'text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-900/20',
  ACCOUNT_SWITCH_LINK_ADDED: 'text-primary-600 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20',
  ACCOUNT_SWITCH_LINK_REVOKED: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50',
  ACCOUNT_SWITCH: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20',
  ACCOUNT_SWITCH_BACK: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20',
  DELEGATION_GRANTED: 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20',
  DELEGATION_REVOKED: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20',
  DELEGATION_ASSUME: 'text-primary-600 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/20',
  DELEGATION_STOP: 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50',
};

// ACTION_LABELS removed in favor of i18n
const getActionColor = (action: AuditAction) =>
  ACTION_COLORS[action] || 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50';
const getActionIcon = (action: AuditAction) =>
  ACTION_ICONS[action] || <Activity className="w-4 h-4" />;

export default function ActivityLog() {
  const { t, i18n } = useTranslation();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<ActivityStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [total, setTotal] = useState(0);

  // Filters
  const [filterAction, setFilterAction] = useState<AuditAction | undefined>();
  const [filterDays, setFilterDays] = useState(7);
  const [page, setPage] = useState(0);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    loadLogs();
    loadStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, filterAction, filterDays]);

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const dateFrom = new Date();
      dateFrom.setDate(dateFrom.getDate() - filterDays);

      const result = await auditService.getUserLogs({
        limit: ITEMS_PER_PAGE,
        offset: page * ITEMS_PER_PAGE,
        action: filterAction,
        dateFrom: dateFrom.toISOString(),
      });

      setLogs(result.logs);
      setTotal(result.total);
    } catch (error: any) {
      console.error('Erreur chargement logs:', error);
      toast.error('Échec du chargement de l\'historique');
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const statsData = await auditService.getActivityStats(filterDays);
      setStats(statsData);
    } catch (error: any) {
      console.error('Erreur chargement stats:', error);
    }
  };

  const getLogDetails = (log: AuditLog) => {
    if (!log.details) return null;

    const parts: string[] = [];

    if (log.details.fileName) {
      parts.push(t('audit.file', { name: log.details.fileName }));
    }
    if (log.details.folderName) {
      parts.push(t('audit.folder', { name: log.details.folderName }));
    }
    if (log.details.tagName) {
      parts.push(t('audit.tag', { name: log.details.tagName }));
    }
    if (log.details.versionNumber) {
      parts.push(t('audit.version', { name: log.details.versionNumber }));
    }
    if (log.details.ipAddress) {
      parts.push(t('audit.ip', { name: log.details.ipAddress }));
    }

    if (parts.length > 0) {
      return parts.join(' • ');
    }

    const fallbackEntries = Object.entries(log.details)
      .filter(([key, value]) => key !== 'ipAddress' && value !== null && value !== undefined && value !== '')
      .slice(0, 3)
      .map(([key, value]) => `${key}: ${typeof value === 'object' ? JSON.stringify(value) : String(value)}`);

    return fallbackEntries.length > 0 ? fallbackEntries.join(' • ') : null;
  };

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  return (
    <div className="space-y-6">
      {/* Header avec statistiques */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity className="w-8 h-8 text-primary-600 dark:text-primary-300" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {t('audit.title')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {t('audit.subtitle')}
            </p>
          </div>
        </div>
      </div>

      {/* Cartes de statistiques */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-primary-100 dark:bg-primary-900/30 rounded-lg">
                <Activity className="w-6 h-6 text-primary-600 dark:text-primary-300" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('audit.total_actions')}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.totalActions}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
                <Upload className="w-6 h-6 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('audit.files_uploaded')}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.actionCounts.UPLOAD || 0}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                <Download className="w-6 h-6 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{t('audit.downloads')}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {stats.actionCounts.DOWNLOAD || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{t('audit.filters')}</span>
          </div>

          <select
            value={filterAction || ''}
            onChange={(e) => {
              setFilterAction(e.target.value as AuditAction || undefined);
              setPage(0);
            }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-600"
          >
            <option value="">{t('audit.all_actions')}</option>
            {Object.keys(ACTION_COLORS).map((action) => (
              <option key={action} value={action}>
                {t(`audit.actions.${action}`)}
              </option>
            ))}
          </select>

          <select
            value={filterDays}
            onChange={(e) => {
              setFilterDays(parseInt(e.target.value));
              setPage(0);
            }}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-primary-600"
          >
            <option value="7">{t('audit.last_7_days')}</option>
            <option value="30">{t('audit.last_30_days')}</option>
            <option value="90">{t('audit.last_90_days')}</option>
            <option value="365">{t('audit.one_year')}</option>
          </select>

          {(filterAction || filterDays !== 7) && (
            <button
              onClick={() => {
                setFilterAction(undefined);
                setFilterDays(7);
                setPage(0);
              }}
              className="text-sm text-primary-600 dark:text-primary-300 hover:underline"
            >
              {t('audit.reset')}
            </button>
          )}
        </div>
      </div>

      {/* Liste des logs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-12 h-12 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
            <p className="text-gray-500 dark:text-gray-400">{t('audit.no_activity')}</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
              {t('audit.try_filters')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`p-2 rounded-lg ${getActionColor(log.action)}`}>
                    {getActionIcon(log.action)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                          {t(`audit.actions.${log.action}`)}
                        </h4>
                        {getLogDetails(log) && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                            {getLogDetails(log)}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {format(new Date(log.createdAt), 'dd MMM yyyy HH:mm', { locale: i18n.language === 'fr' ? fr : enUS })}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t('audit.showing')} {page * ITEMS_PER_PAGE + 1} {t('audit.to')} {Math.min((page + 1) * ITEMS_PER_PAGE, total)} {t('audit.of')} {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {t('audit.page')} {page + 1} {t('audit.of')} {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
