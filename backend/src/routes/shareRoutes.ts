import { Router } from 'express';
import { ShareController } from '../controllers/shareController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Share acceptance/rejection (MUST be before dynamic routes)
router.get('/pending', authenticate, ShareController.getPendingShares);
router.post('/folders/:shareId/accept', authenticate, ShareController.acceptSharedFolder);
router.post('/folders/:shareId/reject', authenticate, ShareController.rejectSharedFolder);
router.post('/files/:shareId/accept', authenticate, ShareController.acceptSharedFile);
router.post('/files/:shareId/reject', authenticate, ShareController.rejectSharedFile);

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
router.patch('/folders/:shareId/permissions', authenticate, ShareController.updateSharedFolderPermissions);
router.delete('/folders/:shareId', authenticate, ShareController.removeSharedFolder);

// File sharing (internal between users)
router.post('/files', authenticate, ShareController.shareFile);
router.get('/files/with-me', authenticate, ShareController.listFilesSharedWithMe);
router.get('/files/by-me', authenticate, ShareController.listFilesSharedByMe);
router.get('/files/:fileId/shares', authenticate, ShareController.getFileShares);
router.patch('/files/:shareId/permissions', authenticate, ShareController.updateSharedFilePermissions);
router.delete('/files/:shareId', authenticate, ShareController.removeSharedFile);

// Access shared file (authenticated user accessing file shared with them)
router.get('/access/:fileId/stream', authenticate, ShareController.streamSharedFile);
router.get('/access/:fileId/download', authenticate, ShareController.downloadSharedFileAuth);

export default router;
