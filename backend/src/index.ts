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
import vaultRoutes from './routes/vaultRoutes';
import organizationRoutes from './routes/organizationRoutes';
import accountAccessRoutes from './routes/accountAccessRoutes';
import notificationRoutes from './routes/notificationRoutes';
import pushRoutes from './routes/pushRoutes';

// Jobs
import { startCleanupJob } from './jobs/cleanupJob';



import { SocketService } from './services/socketService';
import { createServer } from 'http';
import { buildAllowedOrigins, isOriginAllowed } from './utils/cors';




const app = express();
const httpServer = createServer(app);
SocketService.init(httpServer);
const PORT = parseInt(process.env.PORT || '5001', 10);
const ALLOWED_ORIGINS = buildAllowedOrigins();
const ENFORCE_HTTPS = process.env.ENFORCE_HTTPS === 'true';

app.set('trust proxy', 1);

if (ENFORCE_HTTPS) {
  app.use((req, res, next) => {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const isSecure = req.secure || forwardedProto === 'https';
    const isLocalhost = req.hostname === 'localhost' || req.hostname === '127.0.0.1';

    if (!isSecure && !isLocalhost) {
      res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
      return;
    }

    next();
  });
}

// Security middleware
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.originalUrl}`);
  next();
});
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: ENFORCE_HTTPS
    ? {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    }
    : false,
  contentSecurityPolicy: false,
}));

app.use(cors({
  origin: true,
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 500, // 500 requests per minute per IP
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
app.use('/api/vault', vaultRoutes);
app.use('/api/organizations', organizationRoutes);
app.use('/api/account-access', accountAccessRoutes);
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
