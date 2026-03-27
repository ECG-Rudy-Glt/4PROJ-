import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home,
  FolderOpen,
  Share2,
  Trash2,
  Settings,
  Star,
  CreditCard,
  ShieldCheck,
  Building2,
  Shield,
} from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { formatBytes } from '@/utils/bytes';
import { useVaultStore } from '@/stores/useVaultStore';
import { shareService } from '@/services/shareService';

export default function Sidebar() {
  const { user } = useAuthStore();
  const { status: vaultStatus, rootFolder: vaultRootFolder } = useVaultStore();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const fetchPendingCount = async () => {
      try {
        const data = await shareService.getPendingShares();
        const count = (data.pendingFiles?.length || 0) + (data.pendingFolders?.length || 0);
        setPendingCount(count);
      } catch (error) {
        console.error('Failed to fetch pending shares count', error);
      }
    };

    fetchPendingCount();
    // Refresh every 30 seconds
    const interval = setInterval(fetchPendingCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { to: '/dashboard', icon: Home, label: 'Accueil', section: 'main' },
    { to: '/files', icon: FolderOpen, label: 'Mes fichiers', section: 'main' },
    { to: '/favorites', icon: Star, label: 'Favoris', section: 'main' },
    ...(vaultStatus?.enabled && vaultStatus?.unlocked && vaultRootFolder
      ? [{ to: `/files/${vaultRootFolder.id}`, icon: Shield, label: 'Coffre-fort', section: 'main' as const }]
      : []),
    { to: '/shared', icon: Share2, label: 'Partagés', section: 'secondary' },
    { to: '/trash', icon: Trash2, label: 'Corbeille', section: 'secondary' },
    { to: '/organization-admin', icon: Building2, label: 'Organisation', section: 'secondary' },
    ...(user?.role === 'ADMIN'
      ? [{ to: '/admin', icon: ShieldCheck, label: 'Super Admin', section: 'secondary' as const }]
      : []),
    { to: '/plans', icon: CreditCard, label: 'Plans & Tarifs', section: 'bottom' },
    { to: '/settings', icon: Settings, label: 'Paramètres', section: 'bottom' },
  ];

  const quotaUsed = Number(user?.quotaUsed || 0);
  const quotaLimit = Number(user?.quotaLimit || 0);
  const quotaPercentage = quotaLimit > 0 ? (quotaUsed / quotaLimit) * 100 : 0;

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
        {/* Logo Section */}
        <div className="flex flex-col py-4">
          <div className="h-12 flex items-center px-6 w-full">
            <NavLink to="/dashboard" className="flex items-center">
              <img src="/icon-full.svg" alt="SupFile" className="h-[34px] w-auto dark:hidden" />
              <img src="/icon-full-light.svg" alt="SupFile" className="h-[34px] w-auto hidden dark:block" />
            </NavLink>
          </div>
          <div className="w-[80%] h-[2px] bg-gray-200 dark:bg-gray-700 mt-2 ml-6 rounded-full" />
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
                  `group flex items-center justify-between space-x-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${isActive
                    ? 'bg-primary-600 dark:bg-primary-600 text-white shadow-md shadow-primary-600/30'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center space-x-3">
                      <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-500 dark:text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400'} transition-colors`} />
                      <span className={`font-medium text-sm ${isActive ? 'font-semibold' : ''}`}>{item.label}</span>
                    </div>
                    {item.to === '/shared' && pendingCount > 0 && (
                      <span className={`flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold ${
                        isActive ? 'bg-white text-primary-600' : 'bg-amber-500 text-white animate-pulse'
                      }`}>
                        {pendingCount}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Settings */}
        <div className="px-3 pb-4">
          <div className="space-y-1">
            {bottomItems.map((item) => (
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

          {/* Storage Info */}
          {user && (
            <div className="p-4 mt-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
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
                    {formatBytes(quotaUsed)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    of {formatBytes(quotaLimit)}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside >
  );
}
