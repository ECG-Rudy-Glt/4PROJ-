import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/useAuthStore';
import { authService } from '@/services/authService';
import { User, Lock, HardDrive, Moon, Sun, Calendar, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SettingsPage() {
  const { user, updateProfile } = useAuthStore();
  const [isDark, setIsDark] = useState(user?.theme === 'dark');
  const [profile, setProfile] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
  });
  const [password, setPassword] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    setIsDark(user?.theme === 'dark');
  }, [user?.theme]);

  const formatBytes = (bytes: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return gb.toFixed(2);
  };

  const quotaUsed = user?.quotaUsed || 0;
  const quotaLimit = user?.quotaLimit || 10737418240; // 10GB default
  const quotaPercentage = (quotaUsed / quotaLimit) * 100;

  const handleThemeToggle = async () => {
    const newTheme = isDark ? 'light' : 'dark';
    setIsDark(!isDark);
    try {
      await updateProfile({ theme: newTheme });
      document.documentElement.classList.toggle('dark');
      toast.success(`${newTheme === 'dark' ? 'Dark' : 'Light'} mode enabled`);
    } catch (error) {
      toast.error('Failed to update theme');
      setIsDark(isDark); // Revert on error
    }
  };

  const handleProfileUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await updateProfile(profile);
      toast.success('Profile updated');
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.newPassword !== password.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      await authService.changePassword(password.oldPassword, password.newPassword);
      toast.success('Password changed');
      setPassword({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to change password');
    }
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="p-3 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl shadow-lg">
          <User className="w-8 h-8 text-white" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Profile</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage your account settings</p>
        </div>
      </div>

      {/* Storage Quota Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
            <HardDrive className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Storage
          </h2>
        </div>
        
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">
              {formatBytes(quotaUsed)} GB used
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              {formatBytes(quotaLimit)} GB total
            </span>
          </div>
          
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                quotaPercentage > 90
                  ? 'bg-gradient-to-r from-red-500 to-red-600'
                  : quotaPercentage > 70
                  ? 'bg-gradient-to-r from-yellow-500 to-orange-500'
                  : 'bg-gradient-to-r from-primary-500 to-primary-600'
              }`}
              style={{ width: `${Math.min(quotaPercentage, 100)}%` }}
            />
          </div>
          
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {quotaPercentage.toFixed(1)}% of your storage is used
            {quotaPercentage > 90 && (
              <span className="text-red-500 font-medium ml-2">
                ⚠️ Storage almost full!
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Theme Toggle Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              {isDark ? (
                <Moon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              ) : (
                <Sun className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Appearance
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {isDark ? 'Dark mode is enabled' : 'Light mode is enabled'}
              </p>
            </div>
          </div>
          
          <button
            onClick={handleThemeToggle}
            className={`relative w-16 h-8 rounded-full transition-all duration-300 ${
              isDark 
                ? 'bg-primary-600' 
                : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <div
              className={`absolute top-1 w-6 h-6 bg-white rounded-full shadow-md transition-all duration-300 flex items-center justify-center ${
                isDark ? 'left-9' : 'left-1'
              }`}
            >
              {isDark ? (
                <Moon className="w-4 h-4 text-primary-600" />
              ) : (
                <Sun className="w-4 h-4 text-yellow-500" />
              )}
            </div>
          </button>
        </div>
      </div>

      {/* Profile Information Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
            <User className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Profile Information
          </h2>
        </div>
        
        <form onSubmit={handleProfileUpdate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                First Name
              </label>
              <input
                type="text"
                value={profile.firstName}
                onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                placeholder="Enter your first name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Last Name
              </label>
              <input
                type="text"
                value={profile.lastName}
                onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                placeholder="Enter your last name"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={profile.email}
              disabled
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-700/50 dark:text-gray-400 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Email cannot be changed
            </p>
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl hover:from-primary-600 hover:to-primary-700 transition-all shadow-md hover:shadow-lg font-medium"
          >
            Save Changes
          </button>
        </form>
      </div>

      {/* Security Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
            <Lock className="w-5 h-5 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Security
          </h2>
        </div>
        
        <form onSubmit={handlePasswordChange} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Current Password
            </label>
            <input
              type="password"
              value={password.oldPassword}
              onChange={(e) => setPassword({ ...password, oldPassword: e.target.value })}
              className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
              placeholder="Enter your current password"
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                New Password
              </label>
              <input
                type="password"
                value={password.newPassword}
                onChange={(e) => setPassword({ ...password, newPassword: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                placeholder="Enter new password"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Confirm New Password
              </label>
              <input
                type="password"
                value={password.confirmPassword}
                onChange={(e) => setPassword({ ...password, confirmPassword: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent dark:bg-gray-700 dark:text-white transition-all"
                placeholder="Confirm new password"
                required
              />
            </div>
          </div>
          <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
            <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              Password must be at least 6 characters long
            </p>
          </div>
          <button
            type="submit"
            className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl hover:from-red-600 hover:to-red-700 transition-all shadow-md hover:shadow-lg font-medium"
          >
            Change Password
          </button>
        </form>
      </div>

      {/* Account Info Section */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
            <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Account Information
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Account ID</p>
            <p className="font-mono text-sm text-gray-900 dark:text-white truncate">
              {user?.id || 'N/A'}
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Account Status</p>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-medium">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Active
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
