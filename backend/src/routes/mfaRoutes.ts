import { Router } from 'express';
import { body, param } from 'express-validator';
import { mfaController } from '../controllers/mfaController';
import { authenticate, authenticateMfa } from '../middlewares/auth';
import { validate } from '../middlewares/validation';

const router = Router();

/**
 * Routes MFA (Multi-Factor Authentication)
 */

// Configuration initiale du MFA (nécessite authentification ou tempToken)
router.post('/setup', authenticateMfa, (req, res, next) => mfaController.setupMFA(req, res, next));

// Vérification du code initial pour activer le MFA
router.post(
  '/verify-setup',
  authenticateMfa,
  validate([
    body('token').isString().trim().isLength({ min: 6, max: 6 }).withMessage('MFA code must be 6 digits'),
    body('secret').isString().notEmpty().withMessage('MFA secret is required'),
    body('backupCodes').isArray({ min: 1 }).withMessage('Backup codes are required'),
    body('rememberDevice').optional().isBoolean().withMessage('rememberDevice must be boolean'),
  ]),
  (req, res, next) => mfaController.verifySetup(req, res, next)
);

// Vérification du code TOTP lors de la connexion (nécessite tempToken)
router.post(
  '/verify',
  authenticateMfa,
  validate([
    body('token').isString().trim().isLength({ min: 6, max: 6 }).withMessage('MFA code must be 6 digits'),
    body('rememberDevice').optional().isBoolean().withMessage('rememberDevice must be boolean'),
  ]),
  (req, res, next) => mfaController.verifyMFA(req, res, next)
);

// Vérification d'un code de récupération (nécessite tempToken)
router.post(
  '/verify-backup-code',
  authenticateMfa,
  validate([
    body('backupCode').isString().trim().isLength({ min: 6, max: 32 }).withMessage('Backup code is invalid'),
    body('rememberDevice').optional().isBoolean().withMessage('rememberDevice must be boolean'),
  ]),
  (req, res, next) => mfaController.verifyBackupCode(req, res, next)
);

// Régénération des codes de récupération (nécessite authentification + code TOTP)
router.post(
  '/regenerate-codes',
  authenticate,
  validate([body('token').isString().trim().isLength({ min: 6, max: 6 }).withMessage('MFA code must be 6 digits')]),
  (req, res, next) => mfaController.regenerateBackupCodes(req, res, next)
);

// Liste des appareils de confiance
router.get('/trusted-devices', authenticate, (req, res, next) => mfaController.getTrustedDevices(req, res, next));

// Révocation d'un appareil de confiance
router.delete(
  '/trusted-devices/:deviceId',
  authenticate,
  validate([param('deviceId').isUUID().withMessage('deviceId must be a UUID')]),
  (req, res, next) => mfaController.revokeTrustedDevice(req, res, next)
);

// Désactivation du MFA (nécessite authentification + code TOTP)
router.post(
  '/disable',
  authenticate,
  validate([body('token').isString().trim().isLength({ min: 6, max: 6 }).withMessage('MFA code must be 6 digits')]),
  (req, res, next) => mfaController.disableMFA(req, res, next)
);

// Statut MFA de l'utilisateur
router.get('/status', authenticate, (req, res, next) => mfaController.getMFAStatus(req, res, next));

export default router;
