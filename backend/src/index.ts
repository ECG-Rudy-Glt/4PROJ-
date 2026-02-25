import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';

import passport from './config/passport';
import rateLimit from 'express-rate-limit';

// Fix BigInt serialization
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

// Routes
import authRoutes from './routes/authRoutes';
import fileRoutes from './routes/fileRoutes';
import folderRoutes from './routes/folderRoutes';
import shareRoutes from './routes/shareRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import tagRoutes from './routes/tagRoutes';
import commentRoutes from './routes/commentRoutes';
import versionRoutes from './routes/versionRoutes';
import auditRoutes from './routes/auditRoutes';
import userRoutes from './routes/userRoutes';
import onlyofficeRoutes from './routes/onlyofficeRoutes';
import aiRoutes from './routes/aiRoutes';
import mfaRoutes from './routes/mfaRoutes';
import adminRoutes from './routes/adminRoutes';
import billingRoutes from './routes/billingRoutes';
import notificationRoutes from './routes/notificationRoutes';
import pushRoutes from './routes/pushRoutes';

// Jobs
import { startCleanupJob } from './jobs/cleanupJob';



import { SocketService } from './services/socketService';
import { createServer } from 'http';




const app = express();
const httpServer = createServer(app);
SocketService.init(httpServer);
const PORT = parseInt(process.env.PORT || '5001', 10);

// Security middleware
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.originalUrl}`);
  next();
});
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      mediaSrc: ["'self'", "blob:", "data:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      frameAncestors: ["'self'", "http://localhost:3000", "http://192.168.1.95:3000"],
      objectSrc: ["'self'"],
    },
  },
}));

app.use(cors({
  origin: true, // Autorise toutes les origines
  credentials: true,
}));

// Rate limiting - Much more permissive for development
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 50000, // 500 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Body parsing middleware - Increased limits for large file uploads (5GB)
app.use(express.json({
  limit: '5gb',
  verify: (req: any, _res, buf) => {
    if (req.originalUrl.includes('/api/billing/webhook')) {
      req.rawBody = Buffer.from(buf);
    }
  },
}));
app.use(express.urlencoded({ extended: true, limit: '5gb' }));

// Passport initialization
app.use(passport.initialize());

// Serve uploaded files (avatars)
const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';
app.use('/uploads', express.static(uploadDir));

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/folders', folderRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/users', userRoutes);
app.use('/api/onlyoffice', onlyofficeRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/mfa', mfaRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api', commentRoutes);
app.use('/api', versionRoutes);
app.use('/api', auditRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/push', pushRoutes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

import { CronService } from './services/cronService';

// ... (other imports)

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Accessible depuis le réseau local`);

  // Démarrer les jobs de nettoyage automatique
  CronService.init();
  startCleanupJob();
});

export default app;
