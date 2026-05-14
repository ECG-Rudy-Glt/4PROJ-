import { useState, useEffect, useRef } from 'react';
import { Bell, Share2, MessageSquare, AlertTriangle, Check, Trash2 } from 'lucide-react';
import { useNotificationStore, Notification } from '@/stores/useNotificationStore';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const typeConfig: Record<Notification['type'], { icon: typeof Bell; color: string; bg: string }> = {
  SHARE: { icon: Share2, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-900' },
  COMMENT: { icon: MessageSquare, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-900' },
  QUOTA: { icon: AlertTriangle, color: 'text-orange-500', bg: 'bg-orange-100 dark:bg-orange-900' },
};

export default function NotificationCenter() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { notifications, unreadCount, fetchNotifications, markAsRead, markAllAsRead, deleteNotification } =
    useNotificationStore();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Fermer le dropdown au clic extérieur
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const timeAgo = (dateStr: string): string => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return t('common.time.just_now');
    if (minutes < 60) return t('common.time.minutes_ago', { count: minutes });
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t('common.time.hours_ago', { count: hours });
    const days = Math.floor(hours / 24);
    return t('common.time.days_ago', { count: days });
  };

  function getNotificationUrl(notif: Notification): string | null {
    const data = notif.data;
    if (!data) return null;
    if (notif.type === 'SHARE') {
      if (data.folderId || data.fileId) return '/shared?tab=pending';
    }
    if (notif.type === 'COMMENT' && data.fileId) return `/files?preview=${data.fileId}`;
    return null;
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 max-h-[480px] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">{t('notifications.title')}</h3>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllAsRead()}
                className="text-xs text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                {t('notifications.mark_all_read')}
              </button>
            )}
          </div>

          {/* Liste */}
          <div className="overflow-y-auto flex-1">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                {t('notifications.no_notifications')}
              </div>
            ) : (
              notifications.map((notif) => {
                const config = typeConfig[notif.type];
                const Icon = config.icon;
                const url = getNotificationUrl(notif);
                return (
                  <div
                    key={notif.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0 ${
                      !notif.read ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''
                    } ${url ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700' : ''} transition-colors`}
                    onClick={() => {
                      if (url) {
                        if (!notif.read) markAsRead(notif.id);
                        setIsOpen(false);
                        navigate(url);
                      }
                    }}
                  >
                    <div className={`p-2 rounded-full ${config.bg} flex-shrink-0`}>
                      <Icon className={`w-4 h-4 ${config.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{t(notif.title)}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{t(notif.message, (notif.data as Record<string, unknown>) || {}) as string}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{timeAgo(notif.createdAt)}</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      {!notif.read && (
                        <button
                          onClick={() => markAsRead(notif.id)}
                          className="p-1 text-gray-400 hover:text-primary-500 transition-colors"
                          title={t('notifications.mark_read')}
                        >
                          <Check className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notif.id)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                        title={t('common.delete')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
