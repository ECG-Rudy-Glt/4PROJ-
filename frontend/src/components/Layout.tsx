import { Outlet } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import AIChatbot from './AIChatbot';
import { useAuthStore } from '@/stores/useAuthStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { vaultService } from '@/services/vaultService';

export default function Layout() {
  const location = useLocation();
  const userId = useAuthStore((state) => state.user?.id);
  const vaultStatus = useVaultStore((state) => state.status);
  const vaultRootFolder = useVaultStore((state) => state.rootFolder);
  const setInVaultContext = useVaultStore((state) => state.setInVaultContext);
  const refreshVaultStatus = useVaultStore((state) => state.refreshStatus);
  const resetVaultStore = useVaultStore((state) => state.reset);
  const previousPathRef = useRef(location.pathname);
  const autoLockInFlightRef = useRef(false);

  useEffect(() => {
    if (userId) {
      refreshVaultStatus().catch(() => undefined);
      return;
    }

    resetVaultStore();
  }, [userId, refreshVaultStatus, resetVaultStore]);

  useEffect(() => {
    const vaultPath = vaultRootFolder?.id ? `/files/${vaultRootFolder.id}` : null;
    const isVaultContext = !!vaultPath && location.pathname === vaultPath;
    setInVaultContext(isVaultContext);
  }, [location.pathname, setInVaultContext, vaultRootFolder?.id]);

  useEffect(() => {
    const vaultPath = vaultRootFolder?.id ? `/files/${vaultRootFolder.id}` : null;
    const previousPath = previousPathRef.current;
    const wasInVault = !!vaultPath && previousPath === vaultPath;
    const isInVaultNow = !!vaultPath && location.pathname === vaultPath;
    const isVaultUnlocked = !!vaultStatus?.enabled && !!vaultStatus?.unlocked;

    if (isVaultUnlocked && wasInVault && !isInVaultNow && !autoLockInFlightRef.current) {
      autoLockInFlightRef.current = true;
      void vaultService
        .lock()
        .catch(() => undefined)
        .finally(() => {
          autoLockInFlightRef.current = false;
          void refreshVaultStatus().catch(() => undefined);
        });
    }

    previousPathRef.current = location.pathname;
  }, [location.pathname, refreshVaultStatus, vaultRootFolder?.id, vaultStatus?.enabled, vaultStatus?.unlocked]);

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
