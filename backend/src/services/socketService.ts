import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { buildAllowedOrigins, isOriginAllowed } from '../utils/cors';

interface AuthenticatedSocket extends Socket {
    user?: {
        id: string;
        email: string;
    };
}

export class SocketService {
    private static io: Server;

    static init(httpServer: HttpServer) {
        const allowedOrigins = buildAllowedOrigins();
        const enforceHttps = process.env.ENFORCE_HTTPS === 'true';

        this.io = new Server(httpServer, {
            cors: {
                origin: true,
                methods: ['GET', 'POST'],
                credentials: true,
            },
            path: '/socket.io',
        });

        this.io.use((socket: AuthenticatedSocket, next) => {
            const origin = socket.handshake.headers.origin;
            if (enforceHttps && origin && origin.startsWith('http://') && !origin.includes('localhost')) {
                return next(new Error('Secure transport required'));
            }

            const token = socket.handshake.auth.token;

            if (!token) {
                return next(new Error('Authentication error'));
            }

            jwt.verify(
                token,
                process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production-12345',
                (err: any, decoded: any) => {
                    if (err) {
                        return next(new Error('Authentication error'));
                    }
                    socket.user = decoded;
                    next();
                }
            );
        });

        this.io.on('connection', (socket: AuthenticatedSocket) => {
            console.log(`[Socket] User connected: ${socket.user?.email} (${socket.id})`);

            const roomId = (socket.user as any)?.userId || socket.user?.id;
            if (roomId) {
                socket.join(roomId); // Room for private user notifications
            }

            socket.on('join_file', (fileId: string) => {
                socket.join(`file_${fileId}`);
                console.log(`[Socket] User ${socket.user?.email} joined file_${fileId}`);
            });

            socket.on('leave_file', (fileId: string) => {
                socket.leave(`file_${fileId}`);
            });

            socket.on('disconnect', () => {
                console.log(`[Socket] User disconnected: ${socket.user?.email}`);
            });
        });
    }

    static emitToUser(userId: string, event: string, data: any) {
        if (this.io) {
            this.io.to(userId).emit(event, data);
        }
    }

    static emitToFile(fileId: string, event: string, data: any) {
        if (this.io) {
            this.io.to(`file_${fileId}`).emit(event, data);
        }
    }

    static emitToAll(event: string, data: any) {
        if (this.io) {
            this.io.emit(event, data);
        }
    }
}
