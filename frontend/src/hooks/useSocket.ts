import { useEffect, useMemo, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/useAuthStore';

export const useSocket = () => {
    const { token } = useAuthStore();
    const socketRef = useRef<Socket | null>(null);
    const socketUrl = useMemo(() => {
        const configured = import.meta.env.VITE_API_URL;
        if (configured) {
            if (
                window.location.protocol === 'https:'
                && configured.startsWith('http://')
                && !configured.includes('localhost')
            ) {
                return configured.replace('http://', 'https://');
            }
            return configured;
        }
        return window.location.origin;
    }, []);

    useEffect(() => {
        if (token && !socketRef.current) {
            socketRef.current = io(socketUrl, {
                auth: {
                    token,
                },
                path: '/socket.io',
                transports: ['websocket', 'polling'],
            });

            socketRef.current.on('connect', () => {
                console.log('Connected to WebSocket server');
            });

            socketRef.current.on('connect_error', (err) => {
                console.error('Socket connection error:', err);
            });
        }

        return () => {
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
        };
    }, [token, socketUrl]);

    return socketRef.current;
};
