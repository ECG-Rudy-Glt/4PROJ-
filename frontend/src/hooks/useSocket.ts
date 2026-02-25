import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/useAuthStore';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

export const useSocket = () => {
    const { token } = useAuthStore();
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (token && !socketRef.current) {
            socketRef.current = io(SOCKET_URL, {
                auth: {
                    token,
                },
                path: '/socket.io',
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
    }, [token]);

    return socketRef.current;
};
