import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import api from '../services/api';
import { useAuthStore } from '../stores/useAuthStore';

/**
 * Connects a Socket.io client to the backend using the auth token.
 * The socket URL is derived from the axios baseURL by stripping `/api`.
 */
export const useSocket = () => {
  const token = useAuthStore((s) => s.token);
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (!token) {
      setSocket(null);
      return;
    }

    const baseUrl = (api.defaults.baseURL || '').replace(/\/api\/?$/, '');
    if (!baseUrl) return;

    const s = io(baseUrl, {
      auth: { token },
      path: '/socket.io',
      transports: ['websocket'],
      forceNew: true,
    });

    s.on('connect', () => {
      // eslint-disable-next-line no-console
      console.log('[socket] connected');
    });
    s.on('connect_error', (err) => {
      // eslint-disable-next-line no-console
      console.warn('[socket] error', err.message);
    });

    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [token]);

  return socket;
};
