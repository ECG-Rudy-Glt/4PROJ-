import { Outlet } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import AIChatbot from './AIChatbot';
import { useAuthStore } from '@/stores/useAuthStore';
import { useVaultStore } from '@/stores/useVaultStore';
import { vaultService } from '@/services/vaultService';
import { useUploadStore } from '@/stores/useUploadStore';
import { extractDroppedFiles } from '@/utils/dragUtils';
import { Upload } from 'lucide-react';
import UploadModal from './UploadModal';
import { useFileStore } from '@/stores/useFileStore';
import { useTranslation } from 'react-i18next';

export default function Layout() {
  const { t } = useTranslation();
  const location = useLocation();
  const userId = useAuthStore((state) => state.user?.id);
  const vaultStatus = useVaultStore((state) => state.status);
  const vaultRootFolder = useVaultStore((state) => state.rootFolder);
  const setInVaultContext = useVaultStore((state) => state.setInVaultContext);
  const refreshVaultStatus = useVaultStore((state) => state.refreshStatus);
  const resetVaultStore = useVaultStore((state) => state.reset);
  const previousPathRef = useRef(location.pathname);
  const autoLockInFlightRef = useRef(false);
  const dragCounter = useRef(0);
  const { isDragging: isDraggingGlobal, setIsDragging: setIsDraggingGlobal, enqueueUpload } = useUploadStore();
  const currentFolderId = useFileStore((state) => state.currentFolderId);

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

  useEffect(() => {
    const isInAppDrag = (e: DragEvent) =>
      e.dataTransfer?.types.includes('application/supfile-item') ?? false;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isInAppDrag(e)) return;
      dragCounter.current++;
      if (dragCounter.current === 1) {
        setIsDraggingGlobal(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isInAppDrag(e)) return;
      dragCounter.current--;
      if (dragCounter.current === 0) {
        setIsDraggingGlobal(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (isInAppDrag(e)) return;
      dragCounter.current = 0;
      setIsDraggingGlobal(false);

      const files = await extractDroppedFiles(e as any);
      if (files.length > 0) {
        enqueueUpload(files, currentFolderId);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [setIsDraggingGlobal, enqueueUpload, currentFolderId]);

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 relative">
      {/* Global Drag Overlay */}
      {isDraggingGlobal && (
        <div className="fixed inset-0 z-[100] bg-primary-600/90 flex items-center justify-center pointer-events-none transition-all duration-200">
          <div className="text-center text-white p-8 rounded-3xl border-4 border-dashed border-white/50 animate-in fade-in zoom-in duration-300">
            <div className="bg-white/20 p-6 rounded-full inline-block mb-6 shadow-2xl backdrop-blur-sm">
              <Upload className="w-20 h-20 animate-bounce" />
            </div>
            <p className="text-4xl font-black tracking-tight mb-2">{t('common.drag_overlay.title')}</p>
            <p className="text-xl opacity-90 font-medium">{t('common.drag_overlay.subtitle')}</p>
          </div>
        </div>
      )}

      <Sidebar />
      <div className="flex-1 flex flex-col relative z-10 min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
      <AIChatbot />
      <UploadModal />
    </div>
  );
}
