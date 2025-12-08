import { NavLink } from 'react-router-dom';
import {
  Home,
  FolderOpen,
  Share2,
  Trash2,
  Settings,
  HardDrive,
} from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';

export default function Sidebar() {
  const { user } = useAuthStore();

  const navItems = [
    { to: '/dashboard', icon: Home, label: 'Dashboard' },
    { to: '/files', icon: FolderOpen, label: 'My Files' },
    { to: '/shared', icon: Share2, label: 'Shared' },
    { to: '/trash', icon: Trash2, label: 'Trash' },
    { to: '/settings', icon: Settings, label: 'Settings' },
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

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
      <div className="flex flex-col h-full">
        <div className="p-6">
          <div className="flex items-center space-x-2">
            <HardDrive className="w-8 h-8 text-primary-600" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              SUPFILE
            </h1>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary-50 dark:bg-primary-900 text-primary-600 dark:text-primary-400'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {user && (
          <div className="p-4 border-t border-gray-200 dark:border-gray-700">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Storage
                </span>
                <span className="text-gray-900 dark:text-white font-medium">
                  {quotaPercentage.toFixed(1)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-primary-600 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(quotaPercentage, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {formatBytes(Number(user.quotaUsed))} of{' '}
                {formatBytes(Number(user.quotaLimit))} used
              </p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
