import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import AIChatbot from './AIChatbot';
import { useAuthStore } from '@/stores/useAuthStore';
import { useVaultStore } from '@/stores/useVaultStore';

export default function Layout() {
  const userId = useAuthStore((state) => state.user?.id);
  const refreshVaultStatus = useVaultStore((state) => state.refreshStatus);
  const resetVaultStore = useVaultStore((state) => state.reset);

  useEffect(() => {
    if (userId) {
      refreshVaultStatus().catch(() => undefined);
      return;
    }

    resetVaultStore();
  }, [userId, refreshVaultStatus, resetVaultStore]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
      <AIChatbot />
    </div>
  );
}
