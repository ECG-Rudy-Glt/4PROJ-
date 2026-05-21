import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auditService, AuditLog, AuditAction, ActivityStats } from '@/services/auditService';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell,
} from 'recharts';
import {
  Activity, Download, Upload, LogIn, Filter, ChevronLeft, ChevronRight,
  FileDown, Share2, Trash2, Lock, Shield, Building, Tag, MessageCircle,
  History, RefreshCw, ArrowRightLeft, Key, UserCircle, FolderPlus,
  FileText, LogOut, Unlock, UserPlus, UserMinus, UserCog, ArrowDownCircle,
  RotateCcw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';
import { getApiErrorMessage } from '@/utils/getApiErrorMessage';
import { useAuthStore } from '@/stores/useAuthStore';
import { isFeatureAvailableForPlan } from '@/constants/plans';

// ── Action metadata ───────────────────────────────────────────────────────────

const ACTION_ICONS: Record<AuditAction, JSX.Element> = {
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
  ACCOUNT_SWITCH_BACK: <RefreshCw className="w-4 h-4" />,
  DELEGATION_GRANTED: <Shield className="w-4 h-4" />,
  DELEGATION_REVOKED: <Shield className="w-4 h-4" />,
  DELEGATION_ASSUME: <ArrowRightLeft className="w-4 h-4" />,
  DELEGATION_STOP: <ArrowRightLeft className="w-4 h-4" />,
};

const ACTION_COLORS: Record<AuditAction, string> = {
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

const PIE_COLORS = ['#6366f1', '#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#f97316'];

const HEATMAP_LEVELS = [
  'bg-gray-100 dark:bg-gray-700',
  'bg-primary-100 dark:bg-primary-900/50',
  'bg-primary-300 dark:bg-primary-700',
  'bg-primary-500 dark:bg-primary-500',
  'bg-primary-700 dark:bg-primary-400',
];

function getHeatmapLevel(count: number): number {
  if (count === 0) return 0;
  if (count <= 2) return 1;
  if (count <= 5) return 2;
  if (count <= 10) return 3;
  return 4;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AuditPage() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'fr' ? fr : enUS;
  const userPlan = useAuthStore((state) => state.user?.plan);
  const auditAvailable = isFeatureAvailableForPlan(userPlan, 'auditLogs');

  // Stats & heatmap (365 days)
  const [yearStats, setYearStats] = useState<ActivityStats | null>(null);
  // Stats for charts (30 days)
  const [monthStats, setMonthStats] = useState<ActivityStats | null>(null);

  // Log list
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [filterAction, setFilterAction] = useState<AuditAction | undefined>();
  const [filterDays, setFilterDays] = useState(30);
  const [page, setPage] = useState(0);
  const ITEMS_PER_PAGE = 25;

  // Tooltip state for heatmap
  const [hoveredDay, setHoveredDay] = useState<{ date: string; count: number } | null>(null);

  useEffect(() => {
    if (!auditAvailable) return;
    void loadYearStats();
    void loadMonthStats();
  }, [auditAvailable]);

  useEffect(() => {
    if (!auditAvailable) return;
    void loadLogs();
  }, [auditAvailable, page, filterAction, filterDays]);

  const loadYearStats = async () => {
    try {
      const data = await auditService.getActivityStats(365);
      setYearStats(data);
    } catch {
      // silent
    }
  };

  const loadMonthStats = async () => {
    try {
      const data = await auditService.getActivityStats(30);
      setMonthStats(data);
    } catch {
      // silent
    }
  };

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
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('common.error_loading')));
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportCsv = async () => {
    try {
      const blob = await auditService.exportCsv();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('common.error')));
    }
  };

  const getLogDetails = (log: AuditLog) => {
    if (!log.details) return null;
    const parts: string[] = [];
    if (log.details.fileName) parts.push(t('audit.file', { name: log.details.fileName }));
    if (log.details.folderName) parts.push(t('audit.folder', { name: log.details.folderName }));
    if (log.details.tagName) parts.push(t('audit.tag', { name: log.details.tagName }));
    if (log.details.versionNumber) parts.push(t('audit.version', { name: log.details.versionNumber }));
    if (log.details.ipAddress) parts.push(t('audit.ip', { name: log.details.ipAddress }));
    if (parts.length > 0) return parts.join(' · ');
    const fallback = Object.entries(log.details)
      .filter(([k, v]) => k !== 'ipAddress' && v !== null && v !== undefined && v !== '')
      .slice(0, 2)
      .map(([, v]) => String(v));
    return fallback.length > 0 ? fallback.join(' · ') : null;
  };

  // ── Heatmap data ─────────────────────────────────────────────────────────
  const today = new Date();
  const heatmapCells: { date: string; count: number }[] = [];
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split('T')[0];
    heatmapCells.push({ date: key, count: yearStats?.dailyActivity[key] || 0 });
  }

  // Pad start so first cell aligns to Monday (day 1 of week)
  const firstDayOfWeek = new Date(today);
  firstDayOfWeek.setDate(firstDayOfWeek.getDate() - 364);
  const startPad = firstDayOfWeek.getDay() === 0 ? 6 : firstDayOfWeek.getDay() - 1;
  const paddedCells = [...Array(startPad).fill(null), ...heatmapCells];

  // Group into weeks (columns)
  const weeks: ({ date: string; count: number } | null)[][] = [];
  for (let i = 0; i < paddedCells.length; i += 7) {
    weeks.push(paddedCells.slice(i, i + 7));
  }

  // ── Bar chart data (30 days) ───────────────────────────────────────────────
  const barData = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (29 - i));
    const key = d.toISOString().split('T')[0];
    return {
      date: format(d, 'd MMM', { locale: dateLocale }),
      count: monthStats?.dailyActivity[key] || 0,
    };
  });

  // ── Pie chart data (top actions) ─────────────────────────────────────────
  const pieData = yearStats
    ? Object.entries(yearStats.actionCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 8)
        .map(([action, count]) => ({
          name: t(`audit.actions.${action}`),
          value: count,
        }))
    : [];

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
  const stats = yearStats;

  if (!auditAvailable) {
    return (
      <div className="max-w-3xl mx-auto py-16">
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl p-8 text-center shadow-sm">
          <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <Activity className="w-7 h-7 text-primary-600 dark:text-primary-300" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
            {t('plan_upgrade.audit_title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {t('plan_upgrade.audit_description')}
          </p>
          <Link
            to="/plans"
            className="inline-flex items-center justify-center px-5 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 transition-colors"
          >
            {t('plan_upgrade.cta')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg">
            <Activity className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('audit.title')}</h1>
            <p className="text-gray-500 dark:text-gray-400">{t('audit.subtitle')}</p>
          </div>
        </div>
        <button
          onClick={handleExportCsv}
          className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm"
        >
          <FileDown className="w-4 h-4" />
          {t('audit.export_csv')}
        </button>
      </div>

      {/* ── Stats row ── */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: t('audit.total_actions'),
              value: stats.totalActions,
              icon: <Activity className="w-5 h-5" />,
              color: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
            },
            {
              label: t('audit.files_uploaded'),
              value: stats.actionCounts.UPLOAD || 0,
              icon: <Upload className="w-5 h-5" />,
              color: 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
            },
            {
              label: t('audit.downloads'),
              value: stats.actionCounts.DOWNLOAD || 0,
              icon: <Download className="w-5 h-5" />,
              color: 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400',
            },
            {
              label: t('audit.logins'),
              value: stats.actionCounts.LOGIN || 0,
              icon: <LogIn className="w-5 h-5" />,
              color: 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
            },
          ].map((card) => (
            <div
              key={card.label}
              className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${card.color}`}>{card.icon}</div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{card.value.toLocaleString()}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Activity Heatmap ── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-5">
          <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
            <Activity className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('audit.activity_heatmap')}</h2>
        </div>

        <div className="overflow-x-auto">
          <div className="flex gap-1 min-w-max">
            {/* Day-of-week labels */}
            <div className="flex flex-col gap-1 mr-1 justify-around py-0.5">
              {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => (
                <span key={i} className="text-[10px] text-gray-400 dark:text-gray-500 h-3 flex items-center leading-none">
                  {i % 2 === 0 ? d : ''}
                </span>
              ))}
            </div>

            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((cell, di) => {
                  if (!cell) {
                    return <div key={di} className="w-3 h-3 rounded-sm opacity-0" />;
                  }
                  const level = getHeatmapLevel(cell.count);
                  return (
                    <div
                      key={di}
                      className={`w-3 h-3 rounded-sm cursor-pointer transition-all hover:scale-125 hover:ring-1 hover:ring-indigo-400 ${HEATMAP_LEVELS[level]}`}
                      onMouseEnter={() => setHoveredDay(cell)}
                      onMouseLeave={() => setHoveredDay(null)}
                      title={`${cell.date}: ${cell.count} action${cell.count !== 1 ? 's' : ''}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend + tooltip */}
        <div className="flex items-center justify-between mt-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
            <span>{t('audit.less')}</span>
            {HEATMAP_LEVELS.map((cls, i) => (
              <div key={i} className={`w-3 h-3 rounded-sm ${cls}`} />
            ))}
            <span>{t('audit.more')}</span>
          </div>
          {hoveredDay && (
            <span className="text-xs font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-lg">
              {hoveredDay.count === 0
                ? `${hoveredDay.date} - ${t('audit.no_activity_day')}`
                : `${hoveredDay.date} - ${hoveredDay.count} action${hoveredDay.count !== 1 ? 's' : ''}`}
            </span>
          )}
        </div>
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar chart (2/3 width) */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-5">
            <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <Activity className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('audit.daily_activity')}</h2>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={barData} barSize={8}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(156,163,175,0.2)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'currentColor' }}
                className="text-gray-400"
                tickLine={false}
                axisLine={false}
                interval={4}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'currentColor' }}
                className="text-gray-400"
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(17,24,39,0.95)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '10px',
                  padding: '8px 14px',
                }}
                labelStyle={{ color: '#9ca3af', fontSize: 11 }}
                itemStyle={{ color: '#ffffff', fontSize: 13 }}
                cursor={{ fill: 'rgba(99,102,241,0.08)' }}
              />
              <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart (1/3 width) */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <Filter className="w-4 h-4 text-purple-600 dark:text-purple-400" />
            </div>
            <h2 className="text-base font-semibold text-gray-900 dark:text-white">{t('audit.action_breakdown')}</h2>
          </div>
          {pieData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={35}
                    outerRadius={60}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(17,24,39,0.95)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px',
                      padding: '6px 12px',
                    }}
                    itemStyle={{ color: '#ffffff', fontSize: 12 }}
                    labelStyle={{ color: '#9ca3af', fontSize: 11 }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {pieData.slice(0, 5).map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div
                        className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
                      />
                      <span className="text-gray-600 dark:text-gray-400 truncate">{item.name}</span>
                    </div>
                    <span className="font-semibold text-gray-800 dark:text-gray-200 ml-2">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-40 text-gray-400 dark:text-gray-500 text-sm">
              {t('common.no_data')}
            </div>
          )}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-300">
            <Filter className="w-4 h-4" />
            {t('audit.filters')}
          </div>

          <select
            value={filterAction || ''}
            onChange={(e) => { setFilterAction(e.target.value as AuditAction || undefined); setPage(0); }}
            className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="">{t('audit.all_actions')}</option>
            {(Object.keys(ACTION_COLORS) as AuditAction[]).map((action) => (
              <option key={action} value={action}>{t(`audit.actions.${action}`)}</option>
            ))}
          </select>

          <select
            value={filterDays}
            onChange={(e) => { setFilterDays(parseInt(e.target.value)); setPage(0); }}
            className="px-3 py-2 border border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="7">{t('audit.last_7_days')}</option>
            <option value="30">{t('audit.last_30_days')}</option>
            <option value="90">{t('audit.last_90_days')}</option>
            <option value="365">{t('audit.one_year')}</option>
          </select>

          {(filterAction || filterDays !== 30) && (
            <button
              onClick={() => { setFilterAction(undefined); setFilterDays(30); setPage(0); }}
              className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              {t('audit.reset')}
            </button>
          )}

          <div className="ml-auto text-sm text-gray-500 dark:text-gray-400">
            {total > 0 && `${total} résultat${total > 1 ? 's' : ''}`}
          </div>
        </div>
      </div>

      {/* ── Log list ── */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="relative">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
              <div className="absolute inset-0 animate-ping rounded-full h-10 w-10 border border-indigo-400 opacity-20" />
            </div>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-16">
            <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full w-fit mx-auto mb-3">
              <Activity className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-600 dark:text-gray-400 font-medium">{t('audit.no_activity')}</p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">{t('audit.try_filters')}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {logs.map((log) => {
              const colorClass = ACTION_COLORS[log.action] ?? 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50';
              const icon = ACTION_ICONS[log.action] ?? <Activity className="w-4 h-4" />;
              const details = getLogDetails(log);

              return (
                <div
                  key={log.id}
                  className="px-5 py-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors group"
                >
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-xl flex-shrink-0 ${colorClass}`}>
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {t(`audit.actions.${log.action}`)}
                          </p>
                          {details && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">{details}</p>
                          )}
                        </div>
                        <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap flex-shrink-0 bg-gray-50 dark:bg-gray-700 px-2 py-1 rounded-lg">
                          {format(new Date(log.createdAt), 'dd MMM yyyy · HH:mm', { locale: dateLocale })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {t('audit.showing')} {page * ITEMS_PER_PAGE + 1}–{Math.min((page + 1) * ITEMS_PER_PAGE, total)} {t('audit.of')} {total}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[80px] text-center">
              {t('audit.page')} {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-2 rounded-xl border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
