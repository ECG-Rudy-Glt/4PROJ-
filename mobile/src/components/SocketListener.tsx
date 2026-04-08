import { useEffect } from 'react';
import Toast from 'react-native-toast-message';
import { useSocket } from '../hooks/useSocket';
import { useAuthStore } from '../stores/useAuthStore';
import { useNotificationStore } from '../stores/useNotificationStore';

/**
 * Mounts a Socket.io listener while the user is authenticated.
 * Refreshes the notification list on push events and shows a toast.
 */
export default function SocketListener() {
  const socket = useSocket();
  const user = useAuthStore((s) => s.user);
  const fetch = useNotificationStore((s) => s.fetch);

  // Initial load when socket comes up
  useEffect(() => {
    if (socket) fetch();
  }, [socket, fetch]);

  useEffect(() => {
    if (!socket) return;

    const handleComment = (data: any) => {
      if (data?.userId === user?.id) return;
      Toast.show({
        type: 'info',
        text1: 'Nouveau commentaire',
        text2: `${data?.user?.firstName ?? 'Quelqu\'un'} a commenté un fichier.`,
      });
      fetch();
    };

    const handleShare = (data: any) => {
      Toast.show({
        type: 'success',
        text1: 'Nouveau partage reçu',
        text2: `${data?.sharedBy?.firstName ?? 'Quelqu\'un'} vous a partagé un ${
          data?.type === 'folder' ? 'dossier' : 'fichier'
        }.`,
      });
      fetch();
    };

    const handleAccepted = () => {
      Toast.show({ type: 'success', text1: 'Partage accepté' });
      fetch();
    };

    const handleQuota = (data: any) => {
      Toast.show({
        type: 'info',
        text1: 'Quota',
        text2: data?.message ?? 'Votre quota évolue.',
      });
      fetch();
    };

    socket.on('comment:new', handleComment);
    socket.on('share:new', handleShare);
    socket.on('share:accepted', handleAccepted);
    socket.on('quota:update', handleQuota);
    socket.on('notification:new', () => fetch());

    return () => {
      socket.off('comment:new', handleComment);
      socket.off('share:new', handleShare);
      socket.off('share:accepted', handleAccepted);
      socket.off('quota:update', handleQuota);
      socket.off('notification:new');
    };
  }, [socket, user?.id, fetch]);

  return null;
}
