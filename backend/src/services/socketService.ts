import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';

interface AuthenticatedSocket extends Socket {
    user?: {
        id: string;
        email: string;
    };
}

export class SocketService {
    private static io: Server;

    static init(httpServer: HttpServer) {
        this.io = new Server(httpServer, {
            cors: {
                origin: '*', // Adjust in production
                methods: ['GET', 'POST'],
            },
            path: '/socket.io',
        });

        this.io.use((socket: AuthenticatedSocket, next) => {
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

            if (socket.user?.id) {
                socket.join(socket.user.id); // Room for private user notifications
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
