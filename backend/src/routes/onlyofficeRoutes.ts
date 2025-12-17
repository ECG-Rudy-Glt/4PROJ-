import { Router } from 'express';
import { OnlyOfficeController } from '../controllers/onlyofficeController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Get editor configuration for a file
router.get('/config/:fileId', authenticate, OnlyOfficeController.getEditorConfig);

// Serve file to OnlyOffice (no auth - uses access token in query)
router.get('/file/:fileId', OnlyOfficeController.serveFileToOnlyOffice);

// Callback from OnlyOffice to save changes (no auth needed - OnlyOffice calls this)
router.post('/callback/:fileId', OnlyOfficeController.handleCallback);

// Check if file can be edited
router.get('/can-edit/:fileId', authenticate, OnlyOfficeController.canEdit);

export default router;
