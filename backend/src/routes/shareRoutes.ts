import { Router } from 'express';
import { ShareController } from '../controllers/shareController';
import { authenticate } from '../middlewares/auth';
import { requireDelegationPermission } from '../middlewares/delegation';

const router = Router();

// Share acceptance/rejection (MUST be before dynamic routes)
router.get('/pending', authenticate, requireDelegationPermission('read'), ShareController.getPendingShares);
router.post('/folders/:shareId/accept', authenticate, requireDelegationPermission('write'), ShareController.acceptSharedFolder);
router.post('/folders/:shareId/reject', authenticate, requireDelegationPermission('write'), ShareController.rejectSharedFolder);
router.post('/files/:shareId/accept', authenticate, requireDelegationPermission('write'), ShareController.acceptSharedFile);
router.post('/files/:shareId/reject', authenticate, requireDelegationPermission('write'), ShareController.rejectSharedFile);

// Share links (public file sharing)
router.post('/links', authenticate, requireDelegationPermission('share'), ShareController.createShareLink);
router.get('/links', authenticate, requireDelegationPermission('read'), ShareController.listUserShareLinks);
router.delete('/links/:linkId', authenticate, requireDelegationPermission('delete'), ShareController.deleteShareLink);

// Public access to shared files
router.get('/:token', ShareController.getSharedFile);
router.get('/:token/download', ShareController.downloadSharedFile);

// Folder sharing (internal between users)
router.post('/folders', authenticate, requireDelegationPermission('share'), ShareController.shareFolder);
router.get('/folders/with-me', authenticate, requireDelegationPermission('read'), ShareController.listSharedWithMe);
router.get('/folders/by-me', authenticate, requireDelegationPermission('read'), ShareController.listSharedByMe);
router.patch('/folders/:shareId/permissions', authenticate, requireDelegationPermission('share'), ShareController.updateSharedFolderPermissions);
router.delete('/folders/:shareId', authenticate, requireDelegationPermission('delete'), ShareController.removeSharedFolder);

// File sharing (internal between users)
router.post('/files', authenticate, requireDelegationPermission('share'), ShareController.shareFile);
router.get('/files/with-me', authenticate, requireDelegationPermission('read'), ShareController.listFilesSharedWithMe);
router.get('/files/by-me', authenticate, requireDelegationPermission('read'), ShareController.listFilesSharedByMe);
router.get('/files/:fileId/shares', authenticate, requireDelegationPermission('read'), ShareController.getFileShares);
router.patch('/files/:shareId/permissions', authenticate, requireDelegationPermission('share'), ShareController.updateSharedFilePermissions);
router.delete('/files/:shareId', authenticate, requireDelegationPermission('delete'), ShareController.removeSharedFile);

// Shared folder contents (list files in a shared folder)
router.get('/folders/:folderId/contents', authenticate, requireDelegationPermission('read'), ShareController.getSharedFolderContents);

// Access shared file (authenticated user accessing file shared with them)
router.get('/access/:fileId/stream', authenticate, requireDelegationPermission('read'), ShareController.streamSharedFile);
router.get('/access/:fileId/download', authenticate, requireDelegationPermission('read'), ShareController.downloadSharedFileAuth);

export default router;
