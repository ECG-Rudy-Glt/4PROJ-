import { NavLink } from 'react-router-dom';
import {
  Home,
  FolderOpen,
  Share2,
  Trash2,
  Settings,
  Cloud,
  FileStack,
  Star,
  CreditCard,
} from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';

export default function Sidebar() {
  const { user } = useAuthStore();

  const navItems = [
    { to: '/dashboard', icon: Home, label: 'Accueil', section: 'main' },
    { to: '/files', icon: FolderOpen, label: 'Mes fichiers', section: 'main' },
    { to: '/favorites', icon: Star, label: 'Favoris', section: 'main' },
    { to: '/shared', icon: Share2, label: 'Partagés', section: 'secondary' },
    { to: '/trash', icon: Trash2, label: 'Corbeille', section: 'secondary' },
    { to: '/plans', icon: CreditCard, label: 'Plans & Tarifs', section: 'bottom' },
    { to: '/settings', icon: Settings, label: 'Paramètres', section: 'bottom' },
  ];

  const quotaPercentage = user
    ? (Number(user.quotaUsed) / Number(user.quotaLimit)) * 100
    : 0;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getStorageColor = () => {
    if (quotaPercentage >= 90) return 'from-red-500 to-red-600';
    if (quotaPercentage >= 75) return 'from-orange-500 to-orange-600';
    return 'from-primary-500 to-primary-600';
  };

  const mainItems = navItems.filter(item => item.section === 'main');
  const secondaryItems = navItems.filter(item => item.section === 'secondary');
  const bottomItems = navItems.filter(item => item.section === 'bottom');

  return (
    <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700">
      <div className="flex flex-col h-full">
        {/* Logo - Aligned with header height */}
        <div className="h-16 flex items-center px-6">
          <div className="flex items-center space-x-2.5">
            <div className="relative">
              <Cloud className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              <FileStack className="w-3 h-3 text-primary-500 dark:text-primary-300 absolute -bottom-0.5 -right-0.5" />
            </div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-primary-600 to-primary-500 dark:from-primary-400 dark:to-primary-300 bg-clip-text text-transparent">
              SupFile
            </h1>
          </div>
        </div>

        {/* Main Navigation */}
        <nav className="flex-1 px-3 py-4">
          {/* Primary actions */}
          <div className="space-y-1 mb-4">
            {mainItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `group flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${isActive
                    ? 'bg-primary-600 dark:bg-primary-600 text-white shadow-md shadow-primary-600/30'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-500 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400'} transition-colors`} />
                    <span className={`font-medium text-sm ${isActive ? 'font-semibold' : ''}`}>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>

          {/* Secondary actions */}
          <div className="space-y-1">
            <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Autres
            </div>
            {secondaryItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `group flex items-center space-x-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${isActive
                    ? 'bg-primary-600 dark:bg-primary-600 text-white shadow-md shadow-primary-600/30'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-500 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400'} transition-colors`} />
                    <span className={`font-medium text-sm ${isActive ? 'font-semibold' : ''}`}>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Storage Info */}
        {user && (
          <div className="p-4 m-3 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Storage
                </span>
                <span className={`text-sm font-bold ${quotaPercentage >= 90 ? 'text-red-600 dark:text-red-400' : 'text-primary-600 dark:text-primary-400'}`}>
                  {quotaPercentage.toFixed(0)}%
                </span>
              </div>
              <div className="relative w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full bg-gradient-to-r ${getStorageColor()} rounded-full transition-all duration-500 shadow-sm`}
                  style={{ width: `${Math.min(quotaPercentage, 100)}%` }}
                />
              </div>
              <div className="flex justify-between items-center">
                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                  {formatBytes(Number(user.quotaUsed))}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  of {formatBytes(Number(user.quotaLimit))}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Settings */}
        <div className="px-3 pb-4">
          {bottomItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `relative group flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all duration-200 ${isActive
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/50 dark:hover:bg-gray-700/30'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary-600 dark:bg-primary-400 rounded-r-full" />
                  )}
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-primary-600 dark:text-primary-400' : 'text-gray-400 dark:text-gray-500 group-hover:text-primary-500'} transition-colors`} />
                  <span className={`font-medium text-sm ${isActive ? 'font-semibold' : ''}`}>{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </aside>
  );
}
