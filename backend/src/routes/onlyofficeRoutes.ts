import { Router } from 'express';
import { OnlyOfficeController } from '../controllers/onlyofficeController';
import { authenticate } from '../middlewares/auth';
import { requireDelegationPermission } from '../middlewares/delegation';
import { requirePlanFeature } from '../middlewares/planFeature';
import { verifyDirectSharePassword } from '../middlewares/sharePasswordMiddleware';

const router = Router();

// Get editor configuration for a file
router.get('/config/:fileId', authenticate, requireDelegationPermission('read'), verifyDirectSharePassword, requirePlanFeature('onlyoffice'), OnlyOfficeController.getEditorConfig);

// Serve file to OnlyOffice (no auth - uses an opaque, short-lived session token)
router.get('/file/:fileId/:accessToken', OnlyOfficeController.serveFileToOnlyOffice);
// Legacy compatibility: still accepted, but request logging redacts access_token.
router.get('/file/:fileId', OnlyOfficeController.serveFileToOnlyOffice);

// Callback from OnlyOffice to save changes.
// It requires both a signed OnlyOffice callback body/header and an opaque edit session token.
router.post('/callback/:fileId/:callbackToken', OnlyOfficeController.handleCallback);
router.post('/callback/:fileId', OnlyOfficeController.handleCallback);

// Check if file can be edited
router.get('/can-edit/:fileId', authenticate, requireDelegationPermission('read'), verifyDirectSharePassword, requirePlanFeature('onlyoffice'), OnlyOfficeController.canEdit);

export default router;
