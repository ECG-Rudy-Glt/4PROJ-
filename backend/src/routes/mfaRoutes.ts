import { Router } from 'express';
import { mfaController } from '../controllers/mfaController';
import { authenticate, authenticateMfa } from '../middlewares/auth';

const router = Router();

/**
 * Routes MFA (Multi-Factor Authentication)
 */

// Configuration initiale du MFA (nécessite authentification ou tempToken)
router.post('/setup', authenticateMfa, (req, res, next) => mfaController.setupMFA(req, res, next));

// Vérification du code initial pour activer le MFA
router.post('/verify-setup', authenticateMfa, (req, res, next) => mfaController.verifySetup(req, res, next));

// Vérification du code TOTP lors de la connexion (nécessite tempToken)
router.post('/verify', authenticateMfa, (req, res, next) => mfaController.verifyMFA(req, res, next));

// Vérification d'un code de récupération (nécessite tempToken)
router.post('/verify-backup-code', authenticateMfa, (req, res, next) => mfaController.verifyBackupCode(req, res, next));

// Régénération des codes de récupération (nécessite authentification + code TOTP)
router.post('/regenerate-codes', authenticate, (req, res, next) => mfaController.regenerateBackupCodes(req, res, next));

// Liste des appareils de confiance
router.get('/trusted-devices', authenticate, (req, res, next) => mfaController.getTrustedDevices(req, res, next));

// Révocation d'un appareil de confiance
router.delete('/trusted-devices/:deviceId', authenticate, (req, res, next) => mfaController.revokeTrustedDevice(req, res, next));

// Désactivation du MFA (nécessite authentification + code TOTP)
router.post('/disable', authenticate, (req, res, next) => mfaController.disableMFA(req, res, next));

// Statut MFA de l'utilisateur
router.get('/status', authenticate, (req, res, next) => mfaController.getMFAStatus(req, res, next));

export default router;
