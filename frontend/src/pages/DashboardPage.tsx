import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardService } from '@/services/dashboardService';
import { DashboardData } from '@/types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import {
  File,
  Clock,
  HardDrive,
  TrendingUp,
  FolderOpen,
  Image,
  Video,
  Music,
  FileText,
  Archive,
  FileSpreadsheet,
  Presentation
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import { useAuthStore } from '@/stores/useAuthStore';
import ActivityLog from '@/components/ActivityLog';
import { formatBytes } from '@/utils/bytes';
import { getApiErrorMessage } from '@/utils/getApiErrorMessage';
import { useTranslation } from 'react-i18next';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

const getMimeTypeIcon = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return Image;
  if (mimeType.startsWith('video/')) return Video;
  if (mimeType.startsWith('audio/')) return Music;
  // Excel / Spreadsheets
  if (mimeType.includes('spreadsheet') || mimeType.includes('sheet') || mimeType.includes('excel')) return FileSpreadsheet;
  // PowerPoint / Presentations
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint') || mimeType.includes('slide')) return Presentation;
  // Word / Documents
  if (mimeType.includes('pdf') || mimeType.includes('word') || mimeType.includes('document') || mimeType.includes('text')) return FileText;
  if (mimeType.includes('zip') || mimeType.includes('rar')) return Archive;
  return File;
};

const getMimeTypeColor = (mimeType: string) => {
  if (mimeType.startsWith('image/')) return 'text-blue-500 dark:text-blue-400';
  if (mimeType.startsWith('video/')) return 'text-purple-500 dark:text-purple-400';
  if (mimeType.startsWith('audio/')) return 'text-pink-500 dark:text-pink-400';
  // Excel - vert
  if (mimeType.includes('spreadsheet') || mimeType.includes('sheet') || mimeType.includes('excel')) return 'text-green-500 dark:text-green-400';
  // PowerPoint - rouge
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint') || mimeType.includes('slide')) return 'text-red-500 dark:text-red-400';
  if (mimeType.includes('pdf')) return 'text-red-500 dark:text-red-400';
  if (mimeType.includes('word') || mimeType.includes('document') || mimeType.includes('text')) return 'text-blue-500 dark:text-blue-400';
  if (mimeType.includes('zip') || mimeType.includes('rar')) return 'text-amber-500 dark:text-amber-400';
  return 'text-gray-500 dark:text-gray-400';
};

export default function DashboardPage() {
  const { t, i18n } = useTranslation();
  const dateLocale = i18n.language === 'fr' ? fr : enUS;
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const dashboardData = await dashboardService.getDashboard();
      setData(dashboardData);
    } catch (error) {
      toast.error(getApiErrorMessage(error, t('common.error_loading')));
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileClick = (file: any) => {
    const folderPath = file.folderId ? `/files/${file.folderId}` : '/files';
    navigate(`${folderPath}?preview=${file.id}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="relative">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <div className="absolute top-0 left-0 animate-ping rounded-full h-12 w-12 border-2 border-primary-400 opacity-20"></div>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="p-8 text-center text-gray-500">{t('common.no_data')}</div>;
  }

  const chartData = Object.entries(data.fileStats.byMimeType).map(([key, value]) => ({
    name: key,
    value: value.size,
    count: value.count,
  }));

  const quotaUsed = Number(data.quotaUsed || 0);
  const quotaLimit = Number(data.quotaLimit || 0);
  const quotaPercentage = quotaLimit > 0 ? (quotaUsed / quotaLimit) * 100 : 0;

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {t('dashboard.welcome')}, {user?.firstName || t('common.others')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          {t('dashboard.overview')}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Files Card */}
        <div className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-all duration-200 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <FolderOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <TrendingUp className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('dashboard.total_files')}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{data.fileStats.totalFiles}</p>
        </div>

        {/* Storage Used Card */}
        <div className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-all duration-200 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <HardDrive className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 px-2.5 py-1 rounded-full">
              {quotaPercentage.toFixed(0)}%
            </span>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('dashboard.storage_used')}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatBytes(quotaUsed)}</p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
            {t('common.of')} {formatBytes(quotaLimit)}
          </p>
        </div>

        {/* Total Size Card */}
        <div className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-all duration-200 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-pink-50 dark:bg-pink-900/20 rounded-lg">
              <Archive className="w-5 h-5 text-pink-600 dark:text-pink-400" />
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('dashboard.total_size')}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{formatBytes(Number(data.fileStats.totalSize))}</p>
        </div>

        {/* File Types Card */}
        <div className="group bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6 transition-all duration-200 hover:shadow-lg hover:border-gray-300 dark:hover:border-gray-600">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
              <File className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{t('dashboard.file_types')}</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{Object.keys(data.fileStats.byMimeType).length}</p>
        </div>
      </div>

      {/* Charts and Recent Files */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Storage by Type */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300 hover:shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('dashboard.repartition')}
            </h2>
            <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <HardDrive className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
          </div>

          {chartData.length > 0 ? (
            <div>
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    fill="#8884d8"
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {chartData.map((_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                        className="transition-all duration-300 hover:opacity-80"
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [formatBytes(value), t('common.size')]}
                    labelFormatter={(label: string) => label}
                    contentStyle={{
                      backgroundColor: 'rgba(30, 30, 30, 0.95)',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      borderRadius: '12px',
                      padding: '12px 16px',
                      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)'
                    }}
                    itemStyle={{
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 500
                    }}
                    labelStyle={{
                      color: '#a1a1aa',
                      fontSize: '12px',
                      marginBottom: '4px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              <div className="grid grid-cols-2 gap-3 mt-6">
                {chartData.slice(0, 4).map((item, index) => (
                  <div key={item.name} className="flex items-center space-x-2 p-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    ></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-900 dark:text-white truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {item.count} {item.count > 1 ? t('common.file_plural') : t('common.file')}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
                <File className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-center">
                {t('dashboard.no_files')}
              </p>
            </div>
          )}
        </div>

        {/* Recent Files */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300 hover:shadow-xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('dashboard.recent_files')}
            </h2>
            <div className="p-2 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <Clock className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
          </div>

          <div className="space-y-2">
            {data.recentFiles.length > 0 ? (
              data.recentFiles.map((file) => {
                const Icon = getMimeTypeIcon(file.mimeType);
                const iconColor = getMimeTypeColor(file.mimeType);

                return (
                  <div
                    key={file.id}
                    onClick={() => handleFileClick(file)}
                    className="group flex items-center space-x-3 p-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-xl transition-all duration-200 cursor-pointer"
                  >
                    <div className={`p-2.5 bg-gray-100 dark:bg-gray-700 rounded-lg group-hover:scale-110 transition-transform duration-200`}>
                      <Icon className={`w-5 h-5 ${iconColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {file.name}
                      </p>
                      <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>{file.folder?.name || t('dashboard.root')}</span>
                        <span>•</span>
                        <span>{formatBytes(Number(file.size))}</span>
                      </div>
                    </div>
                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-full">
                      <Clock className="w-3.5 h-3.5 mr-1" />
                      {format(new Date(file.updatedAt), 'dd MMM', { locale: dateLocale })}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="p-4 bg-gray-100 dark:bg-gray-700 rounded-full mb-4">
                  <Clock className="w-8 h-8 text-gray-400" />
                </div>
                <p className="text-gray-600 dark:text-gray-400 text-center">
                  {t('dashboard.no_recent')}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Activity Log Section */}
      {user?.plan && user.plan !== 'FREE' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-6 transition-all duration-300 hover:shadow-xl">
          <ActivityLog />
        </div>
      )}
    </div>
  );
}
