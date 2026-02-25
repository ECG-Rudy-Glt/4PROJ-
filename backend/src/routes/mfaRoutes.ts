import { Router } from 'express';
import { mfaController } from '../controllers/mfaController';
import { authenticate } from '../middlewares/auth';

const router = Router();

/**
 * Routes MFA (Multi-Factor Authentication)
 */

// Configuration initiale du MFA (nécessite authentification)
router.post('/setup', authenticate, (req, res) => mfaController.setupMFA(req, res));

// Vérification du code initial pour activer le MFA
router.post('/verify-setup', authenticate, (req, res) => mfaController.verifySetup(req, res));

// Vérification du code TOTP lors de la connexion (pas d'auth requise, utilise tempToken)
router.post('/verify', (req, res) => mfaController.verifyMFA(req, res));

// Vérification d'un code de récupération (pas d'auth requise, utilise tempToken)
router.post('/verify-backup-code', (req, res) => mfaController.verifyBackupCode(req, res));

// Régénération des codes de récupération (nécessite authentification + code TOTP)
router.post('/regenerate-codes', authenticate, (req, res) => mfaController.regenerateBackupCodes(req, res));

// Liste des appareils de confiance
router.get('/trusted-devices', authenticate, (req, res) => mfaController.getTrustedDevices(req, res));

// Révocation d'un appareil de confiance
router.delete('/trusted-devices/:deviceId', authenticate, (req, res) => mfaController.revokeTrustedDevice(req, res));

// Désactivation du MFA (nécessite authentification + code TOTP)
router.post('/disable', authenticate, (req, res) => mfaController.disableMFA(req, res));

// Statut MFA de l'utilisateur
router.get('/status', authenticate, (req, res) => mfaController.getMFAStatus(req, res));

export default router;
