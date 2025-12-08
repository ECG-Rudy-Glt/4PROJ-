import { Search, Moon, Sun, LogOut, User } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function Header() {
  const { user, logout, updateProfile } = useAuthStore();
  const [isDark, setIsDark] = useState(user?.theme === 'dark');
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

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
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex-1 max-w-2xl">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-700 dark:text-white"
            />
          </form>
        </div>

        <div className="flex items-center space-x-4 ml-6">
          <button
            onClick={toggleTheme}
            className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center text-white font-semibold">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt="Avatar"
                  className="w-8 h-8 rounded-full"
                />
              ) : (
                <User className="w-5 h-5" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {user?.firstName || user?.email}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {user?.email}
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
