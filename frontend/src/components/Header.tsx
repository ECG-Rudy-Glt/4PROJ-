import { Search, Moon, Sun, LogOut, User, ArrowRightLeft, Building2 } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, Link } from 'react-router-dom';
import ProfileModal from './ProfileModal';
import AccountSwitcherModal from './AccountSwitcherModal';
import NotificationCenter from './NotificationCenter';

export default function Header() {
  const { t } = useTranslation();
  const { user, logout, updateProfile } = useAuthStore();
  const [isDark, setIsDark] = useState(user?.theme === 'dark');
  const [searchQuery, setSearchQuery] = useState('');
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showAccountSwitcherModal, setShowAccountSwitcherModal] = useState(false);
  const navigate = useNavigate();

  // Appliquer le thème au chargement initial et quand user change
  useEffect(() => {
    const isDarkMode = user?.theme === 'dark';
    setIsDark(isDarkMode);
    
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [user?.theme]);

  const toggleTheme = async () => {
    const newTheme = isDark ? 'light' : 'dark';
    setIsDark(!isDark);

    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    try {
      await updateProfile({ theme: newTheme });
    } catch (error) {
      console.error('Failed to update theme:', error);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/files?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 md:px-6">
      {/* Ligne 1 : actions (toujours visible) */}
      <div className="h-14 flex items-center justify-between">
        {/* Espace pour le bouton hamburger mobile (positionné en fixed dans Sidebar) */}
        <div className="w-10 md:hidden" />

        <div className="hidden md:flex flex-1 max-w-2xl">
          <form onSubmit={handleSearch} className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('common.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
            />
          </form>
        </div>

        <div className="flex items-center space-x-2 md:space-x-4 md:ml-6">
          <button
            onClick={toggleTheme}
            className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <NotificationCenter />

          {user?.currentOrganizationId && (
            <Link
              to="/organization-admin"
              className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title={t('common.organization')}
            >
              <Building2 className="w-5 h-5" />
            </Link>
          )}

          <button
            onClick={() => setShowAccountSwitcherModal(true)}
            className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Switch de comptes"
          >
            <ArrowRightLeft className="w-5 h-5" />
          </button>

          <button
            onClick={() => setShowProfileModal(true)}
            className="flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg px-3 py-2 transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt="Avatar"
                  className="w-8 h-8 rounded-full object-cover"
                />
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>
            <div className="text-left">
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {user?.firstName || user?.email}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {user?.email}
              </p>
            </div>
          </button>

          <button
            onClick={logout}
            className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title={t('common.logout')}
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Ligne 2 mobile : barre de recherche */}
      <div className="md:hidden pb-3">
        <form onSubmit={handleSearch} className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder={t('common.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
          />
        </form>
      </div>

      <ProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
      />

      <AccountSwitcherModal
        isOpen={showAccountSwitcherModal}
        onClose={() => setShowAccountSwitcherModal(false)}
      />
    </header>
  );
}
