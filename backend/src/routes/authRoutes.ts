import { Router } from 'express';
import { AuthController } from '../controllers/authController';
import { authenticate } from '../middlewares/auth';
import { body } from 'express-validator';
import { validate } from '../middlewares/validation';
import passport from '../config/passport';
import { avatarUpload } from '../config/multer';

const router = Router();

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

// Profile
router.get('/profile', authenticate, AuthController.getProfile);
router.put('/profile', authenticate, AuthController.updateProfile);
router.post('/avatar', authenticate, avatarUpload.single('avatar'), AuthController.uploadAvatar);
router.post(
  '/change-password',
  authenticate,
  validate([
    body('oldPassword').notEmpty().withMessage('Old password required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
  ]),
  AuthController.changePassword
);

// OAuth2 routes
router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: '/auth/failure' }),
  AuthController.oauthCallback
);

router.get(
  '/github',
  passport.authenticate('github', { scope: ['user:email'], session: false })
);

router.get(
  '/github/callback',
  passport.authenticate('github', { session: false, failureRedirect: '/auth/failure' }),
  AuthController.oauthCallback
);

export default router;
