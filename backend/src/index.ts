import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';

import passport from './config/passport';
import logger from './config/logger';
import { SocketService } from './services/socketService';
import { buildAllowedOrigins, isOriginAllowed } from './utils/cors';
import { errorHandler } from './middlewares/errorHandler';
import { CronService } from './services/cronService';
import { startCleanupJob } from './jobs/cleanupJob';

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

// Fix BigInt serialization
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

const app = express();
const httpServer = createServer(app);
const PORT = parseInt(process.env.PORT || '5001', 10);
const ALLOWED_ORIGINS = buildAllowedOrigins();
const ENFORCE_HTTPS = process.env.ENFORCE_HTTPS === 'true';

SocketService.init(httpServer);
app.set('trust proxy', 1);

// HTTPS redirect
if (ENFORCE_HTTPS) {
  app.use((req, res, next) => {
    const isSecure = req.secure || req.headers['x-forwarded-proto'] === 'https';
    const isLocalhost = req.hostname === 'localhost' || req.hostname === '127.0.0.1';
    if (!isSecure && !isLocalhost) {
      res.redirect(308, `https://${req.headers.host}${req.originalUrl}`);
      return;
    }
    next();
  });
}

// Request logging
app.use((req, _res, next) => {
  logger.info({ method: req.method, url: req.originalUrl });
  next();
});

// Security headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  hsts: ENFORCE_HTTPS ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
  contentSecurityPolicy: false,
}));

// CORS
app.use(cors({
  origin: (origin, callback) => {
    if (ENFORCE_HTTPS && origin && origin.startsWith('http://') && !origin.includes('localhost') && !origin.includes('127.0.0.1')) {
      callback(new Error('Secure transport required'));
      return;
    }
    if (isOriginAllowed(ALLOWED_ORIGINS, origin)) {
      callback(null, true);
      return;
    }
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));

// Rate limiting
app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
}));

app.use(['/api/auth/login', '/api/auth/register'], rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts, please try again later.' },
}));

// Body parsing — large limits for file uploads
app.use(express.json({
  limit: '5gb',
  verify: (req: any, _res, buf) => {
    if (req.originalUrl.includes('/api/billing/webhook')) {
      req.rawBody = Buffer.from(buf);
    }
  },
}));
app.use(express.urlencoded({ extended: true, limit: '5gb' }));

// Passport
app.use(passport.initialize());

// Static files
const uploadDir = process.env.UPLOAD_DIR || '/app/uploads';
app.use('/uploads', express.static(uploadDir));

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Routes
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
app.use('/api/notifications', notificationRoutes);
app.use('/api/push', pushRoutes);
app.use('/api', commentRoutes);
app.use('/api', versionRoutes);
app.use('/api', auditRoutes);

// 404
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use(errorHandler);

httpServer.listen(PORT, '0.0.0.0', () => {
  logger.info(`Server running on port ${PORT}`);
  CronService.init();
  startCleanupJob();
});

export default app;
