import { useEffect } from 'react';
import Toast from 'react-native-toast-message';
import { useSocket } from '../hooks/useSocket';
import { useNotificationStore } from '../stores/useNotificationStore';
import { useFileStore } from '../stores/useFileStore';

const getDataString = (data: Record<string, unknown> | undefined, key: string): string | undefined => {
  const value = data?.[key];
  return typeof value === 'string' ? value : undefined;
};

const formatNotificationToast = (notification: any) => {
  const data = notification?.data as Record<string, unknown> | undefined;
  const title = typeof notification?.title === 'string' ? notification.title : '';
  const message = typeof notification?.message === 'string' ? notification.message : '';
  const usage = typeof data?.usage === 'number' ? data.usage : undefined;

  if (title === 'notifications.share.file_received.title') {
    return {
      type: 'success',
      text1: 'Nouveau fichier partagé',
      text2: `${getDataString(data, 'userName') ?? 'Quelqu\'un'} vous a partagé un fichier.`,
    };
  }

  if (title === 'notifications.share.folder_received.title') {
    return {
      type: 'success',
      text1: 'Nouveau dossier partagé',
      text2: `${getDataString(data, 'userName') ?? 'Quelqu\'un'} vous a partagé un dossier.`,
    };
  }

  if (title.startsWith('notifications.comment.')) {
    return {
      type: 'info',
      text1: 'Nouveau commentaire',
      text2: `${getDataString(data, 'userName') ?? 'Quelqu\'un'} a commenté ${getDataString(data, 'fileName') ?? 'un fichier'}.`,
    };
  }

  if (title.startsWith('notifications.quota.')) {
    return {
      type: 'info',
      text1: 'Quota',
      text2: typeof usage === 'number' ? `Votre quota est utilisé à ${usage}%.` : 'Votre quota évolue.',
    };
  }

  return {
    type: 'info',
    text1: title || 'Nouvelle notification',
    text2: message || '',
  };
};

/**
 * Mounts a Socket.io listener while the user is authenticated.
 * Refreshes the notification list on push events and shows a toast.
 */
export default function SocketListener() {
  const socket = useSocket();
  const fetch = useNotificationStore((s) => s.fetch);
  const refresh = useFileStore((s) => s.refresh);

  // Initial load when socket comes up
  useEffect(() => {
    if (socket) fetch();
  }, [socket, fetch]);

  useEffect(() => {
    if (!socket) return;

    const handleNotification = (notification: any) => {
      Toast.show(formatNotificationToast(notification));
      fetch();
    };

    const refreshFiles = () => {
      refresh();
    };

    socket.on('notification_new', handleNotification);
    socket.on('notification:new', handleNotification);
    socket.on('share_received', () => { fetch(); refresh(); });
    socket.on('file_uploaded', refreshFiles);
    socket.on('file_updated', refreshFiles);
    socket.on('file_deleted', refreshFiles);
    socket.on('folder_created', refreshFiles);
    socket.on('folder_deleted', refreshFiles);
    socket.on('folder_updated', refreshFiles);

    return () => {
      socket.off('notification_new', handleNotification);
      socket.off('notification:new', handleNotification);
      socket.off('share_received');
      socket.off('file_uploaded', refreshFiles);
      socket.off('file_updated', refreshFiles);
      socket.off('file_deleted', refreshFiles);
      socket.off('folder_created', refreshFiles);
      socket.off('folder_deleted', refreshFiles);
      socket.off('folder_updated', refreshFiles);
    };
  }, [socket, fetch, refresh]);

  return null;
}
