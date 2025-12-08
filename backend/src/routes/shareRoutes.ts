import { Router } from 'express';
import { ShareController } from '../controllers/shareController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Share links (public file sharing)
router.post('/links', authenticate, ShareController.createShareLink);
router.get('/links', authenticate, ShareController.listUserShareLinks);
router.delete('/links/:linkId', authenticate, ShareController.deleteShareLink);

// Public access to shared files
router.get('/:token', ShareController.getSharedFile);
router.get('/:token/download', ShareController.downloadSharedFile);

// Folder sharing (internal between users)
router.post('/folders', authenticate, ShareController.shareFolder);
router.get('/folders/with-me', authenticate, ShareController.listSharedWithMe);
router.get('/folders/by-me', authenticate, ShareController.listSharedByMe);
router.delete('/folders/:shareId', authenticate, ShareController.removeSharedFolder);

export default router;
