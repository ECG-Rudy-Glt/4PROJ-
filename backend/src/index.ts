import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));

// Rate limiting - Disabled in development
if (process.env.NODE_ENV === 'production') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);
}

// Body parsing middleware - Increased limits for large file uploads
app.use(express.json({ limit: '1000mb' }));
app.use(express.urlencoded({ extended: true, limit: '1000mb' }));

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

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
