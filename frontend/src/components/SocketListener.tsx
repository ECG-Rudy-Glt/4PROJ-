import { useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';
import toast from 'react-hot-toast';
import { MessageSquare, Share2, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/useAuthStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { initPushNotifications } from '@/utils/pushNotification';

interface CommentData {
    userId: string;
    user: {
        firstName: string;
    };
}

interface ShareData {
    sharedBy: {
        firstName: string;
    };
    type: 'file' | 'folder';
}

interface ShareAcceptedData {
    acceptedBy: {
        firstName: string;
    };
    type: 'file' | 'folder';
}

export default function SocketListener() {
    const { t } = useTranslation();
    const socket = useSocket();
    const { user, refreshProfile } = useAuthStore();
    const { addNotification, fetchNotifications } = useNotificationStore((s) => ({
        addNotification: s.addNotification,
        fetchNotifications: s.fetchNotifications,
    }));

    // Enregistrer le service worker push au montage
    useEffect(() => {
        initPushNotifications();
    }, []);

    // Charger les notifications dès que le socket est connecté (user forcément authentifié)
    useEffect(() => {
        if (!socket) return;
        fetchNotifications();
    }, [socket, fetchNotifications]);

    useEffect(() => {
        if (!socket) return;

        const handleComment = (data: CommentData) => {
            if (data.userId === user?.id) return;

            toast.custom((t_toast) => (
                <div
                    className={`${t_toast.visible ? 'animate-enter' : 'animate-leave'
                        } max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
                >
                    <div className="flex-1 w-0 p-4">
                        <div className="flex items-start">
                            <div className="flex-shrink-0 pt-0.5">
                                <MessageSquare className="h-10 w-10 text-primary-500 rounded-full bg-primary-100 p-2" />
                            </div>
                            <div className="ml-3 flex-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {t('socket.comment_added_title')}
                                </p>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    {t('socket.comment_added_body', { firstName: data.user?.firstName })}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            ));
        };

        const handleShare = (data: ShareData) => {
            toast.custom((t_toast) => (
                <div
                    className={`${t_toast.visible ? 'animate-enter' : 'animate-leave'
                        } max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
                >
                    <div className="flex-1 w-0 p-4">
                        <div className="flex items-start">
                            <div className="flex-shrink-0 pt-0.5">
                                <Share2 className="h-10 w-10 text-green-500 rounded-full bg-green-100 p-2" />
                            </div>
                            <div className="ml-3 flex-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {t('socket.share_received_title')}
                                </p>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    {t('socket.share_received_body', { 
                                        firstName: data.sharedBy?.firstName, 
                                        type: data.type === 'folder' ? t('common.folder') : t('common.file') 
                                    })}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            ));
        };

        // Mise à jour du quota après upload/suppression
        const handleQuotaChange = () => {
            refreshProfile().catch(() => {});
        };

        const handleShareAccepted = (data: ShareAcceptedData) => {
            toast.custom((t_toast) => (
                <div
                    className={`${t_toast.visible ? 'animate-enter' : 'animate-leave'
                        } max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
                >
                    <div className="flex-1 w-0 p-4">
                        <div className="flex items-start">
                            <div className="flex-shrink-0 pt-0.5">
                                <Check className="h-10 w-10 text-white rounded-full bg-green-500 p-2" />
                            </div>
                            <div className="ml-3 flex-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {t('socket.share_accepted_title')}
                                </p>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    {t('socket.share_accepted_body', { 
                                        firstName: data.acceptedBy?.firstName, 
                                        type: data.type === 'folder' ? t('common.folder') : t('common.file') 
                                    })}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            ));
        };

        // Listener pour les notifications persistantes (push géré côté backend via VAPID)
        const handleNotification = (data: import('../stores/useNotificationStore').Notification) => {
            addNotification(data);
        };

        socket.on('comment_added', handleComment);
        socket.on('share_received', handleShare);
        socket.on('file_uploaded', handleQuotaChange);
        socket.on('file_deleted', handleQuotaChange);
        socket.on('share_accepted', handleShareAccepted);
        socket.on('notification_new', handleNotification);

        return () => {
            socket.off('comment_added', handleComment);
            socket.off('share_received', handleShare);
            socket.off('file_uploaded', handleQuotaChange);
            socket.off('file_deleted', handleQuotaChange);
            socket.off('share_accepted', handleShareAccepted);
            socket.off('notification_new', handleNotification);
        };
    }, [socket, user, addNotification, refreshProfile]);

    return null;
}
