import { useEffect } from 'react';
import { useSocket } from '@/hooks/useSocket';
import toast from 'react-hot-toast';
import { MessageSquare, Share2, FileText, Check } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';

export default function SocketListener() {
    const socket = useSocket();
    const { user } = useAuthStore();

    useEffect(() => {
        if (!socket) return;

        // Listener pour les nouveaux commentaires
        const handleComment = (data: any) => {
            // Ne pas notifier si c'est moi qui ai commenté
            if (data.userId === user?.id) return;

            toast.custom((t) => (
                <div
                    className={`${t.visible ? 'animate-enter' : 'animate-leave'
                        } max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
                >
                    <div className="flex-1 w-0 p-4">
                        <div className="flex items-start">
                            <div className="flex-shrink-0 pt-0.5">
                                <MessageSquare className="h-10 w-10 text-primary-500 rounded-full bg-primary-100 p-2" />
                            </div>
                            <div className="ml-3 flex-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    Nouveau commentaire
                                </p>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    {data.user?.firstName} a commenté un fichier.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            ));
        };

        // Listener pour les partages reçus
        const handleShare = (data: any) => {
            toast.custom((t) => (
                <div
                    className={`${t.visible ? 'animate-enter' : 'animate-leave'
                        } max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
                >
                    <div className="flex-1 w-0 p-4">
                        <div className="flex items-start">
                            <div className="flex-shrink-0 pt-0.5">
                                <Share2 className="h-10 w-10 text-green-500 rounded-full bg-green-100 p-2" />
                            </div>
                            <div className="ml-3 flex-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    Nouveau partage reçu
                                </p>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    {data.sharedBy?.firstName} vous a partagé un {data.type === 'folder' ? 'dossier' : 'fichier'}.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            ));
        };

        // Listener pour les uploads (si pertinent)
        const handleUpload = (file: any) => {
            // Optionnel : Notification silencieuse ou mise à jour de liste
            console.log('File uploaded:', file.name);
        };

        // Listener pour les partages acceptés
        const handleShareAccepted = (data: any) => {
            toast.custom((t) => (
                <div
                    className={`${t.visible ? 'animate-enter' : 'animate-leave'
                        } max-w-md w-full bg-white dark:bg-gray-800 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}
                >
                    <div className="flex-1 w-0 p-4">
                        <div className="flex items-start">
                            <div className="flex-shrink-0 pt-0.5">
                                <Check className="h-10 w-10 text-white rounded-full bg-green-500 p-2" />
                            </div>
                            <div className="ml-3 flex-1">
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    Partage accepté
                                </p>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    {data.acceptedBy?.firstName} a accepté votre partage de {data.type === 'folder' ? 'dossier' : 'fichier'}.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            ));
        };

        socket.on('comment_added', handleComment);
        socket.on('share_received', handleShare);
        socket.on('file_uploaded', handleUpload);
        socket.on('share_accepted', handleShareAccepted);

        return () => {
            socket.off('comment_added', handleComment);
            socket.off('share_received', handleShare);
            socket.off('file_uploaded', handleUpload);
            socket.off('share_accepted', handleShareAccepted);
        };
    }, [socket, user]);

    return null; // Ce composant ne rend rien visuellement, il gère juste les écoutes
}
