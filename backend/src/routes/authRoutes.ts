import { NextFunction, Request, Response, Router } from 'express';
import { AuthController } from '../controllers/authController';
import { UserProfileController } from '../controllers/userProfileController';
import { DataExportController } from '../controllers/dataExportController';
import { authenticate, AuthRequest } from '../middlewares/auth';
import { body } from 'express-validator';
import { validate } from '../middlewares/validation';
import passport from '../config/passport';
import { avatarUpload } from '../config/multer';
import { sendError } from '../utils/response';

const router = Router();

const isOAuthProviderConfigured = (provider: 'google' | 'github') => {
  if (provider === 'google') {
    return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
  }

  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
};

const requireOAuthProvider = (provider: 'google' | 'github') => (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  if (!isOAuthProviderConfigured(provider)) {
    sendError(res, 'OAuth provider not configured', 404, 'OAUTH_PROVIDER_DISABLED');
    return;
  }
  next();
};

const requireDirectSession = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.authContext?.authType && req.authContext.authType !== 'DIRECT') {
    sendError(res, 'Action autorisée uniquement depuis votre session directe', 403, 'DIRECT_SESSION_REQUIRED');
    return;
  }
  next();
};

// Local auth
router.post(
  '/register',
  validate([
    body('email').isEmail().withMessage('Invalid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  ]),
  AuthController.register
);

router.post(
  '/login',
  validate([
    body('email').isEmail().withMessage('Invalid email'),
    body('password').notEmpty().withMessage('Password required'),
  ]),
  AuthController.login
);

router.post('/refresh', AuthController.refresh);
router.post('/logout', AuthController.logout);

// Password Reset
router.post('/forgot-password', AuthController.requestPasswordReset);
router.post('/reset-password-info', AuthController.getResetTokenInfo);
router.get('/reset-password-info', AuthController.getResetTokenInfo);
router.post('/reset-password', AuthController.resetPassword);

router.get('/providers', AuthController.getOAuthProviders);

// Global Logout
router.post('/logout-all', authenticate, AuthController.logoutAll);

// Profile
router.get('/profile', authenticate, UserProfileController.getProfile);
router.put('/profile', authenticate, UserProfileController.updateProfile);
router.post('/avatar', authenticate, avatarUpload.single('avatar'), UserProfileController.uploadAvatar);
router.post(
  '/change-password',
  authenticate,
  validate([
    body('oldPassword').notEmpty().withMessage('Old password required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
    body('mfaCode').optional().isString().withMessage('MFA code must be a string'),
  ]),
  UserProfileController.changePassword
);

// RGPD - Export des données
router.get('/export-data', authenticate, DataExportController.exportUserData);
router.delete(
  '/account',
  authenticate,
  requireDirectSession,
  validate([
    body('confirmationEmail').isEmail().withMessage('Confirmation email is required'),
    body('currentPassword').optional().isString().withMessage('Current password must be a string'),
    body('mfaCode').optional().isString().isLength({ min: 6, max: 32 }).withMessage('MFA code is invalid'),
  ]),
  AuthController.deleteAccount
);

// OAuth2 routes
router.get(
  '/google',
  requireOAuthProvider('google'),
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

router.get(
  '/google/callback',
  requireOAuthProvider('google'),
  passport.authenticate('google', { session: false, failureRedirect: '/auth/failure' }),
  AuthController.oauthCallback
);

router.get(
  '/github',
  requireOAuthProvider('github'),
  passport.authenticate('github', { scope: ['user:email'], session: false })
);

router.get(
  '/github/callback',
  requireOAuthProvider('github'),
  passport.authenticate('github', { session: false, failureRedirect: '/auth/failure' }),
  AuthController.oauthCallback
);

export default router;
