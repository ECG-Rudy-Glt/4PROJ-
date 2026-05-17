import { Router } from 'express';
import { FileController } from '../controllers/fileController';
import { authenticate } from '../middlewares/auth';
import { upload } from '../config/multer';
import { checkQuotaBeforeUpload } from '../middlewares/quotaCheck';
import { requireDelegationPermission } from '../middlewares/delegation';
import { verifyDirectSharePassword, verifyDirectSharePasswordFor } from '../middlewares/sharePasswordMiddleware';

const router = Router();

router.post('/upload', authenticate, requireDelegationPermission('write'), upload.array('files', 100), verifyDirectSharePasswordFor('write'), checkQuotaBeforeUpload, FileController.uploadFile);
router.get('/', authenticate, requireDelegationPermission('read'), verifyDirectSharePassword, FileController.listFiles);
router.get('/deleted', authenticate, requireDelegationPermission('read'), FileController.getDeletedFiles);
router.get('/favorites', authenticate, requireDelegationPermission('read'), FileController.getFavoriteFiles);
router.get('/shares/accepted', authenticate, requireDelegationPermission('read'), FileController.getAcceptedShares);
router.get('/export/csv', authenticate, requireDelegationPermission('read'), FileController.exportFilesCsv);
router.get('/search', authenticate, requireDelegationPermission('read'), FileController.searchFiles);
router.get('/:fileId', authenticate, requireDelegationPermission('read'), FileController.getFile);
router.get('/:fileId/download', authenticate, requireDelegationPermission('read'), FileController.downloadFile);
router.get('/:fileId/stream', authenticate, requireDelegationPermission('read'), FileController.streamFile);
router.put('/:fileId', authenticate, requireDelegationPermission('write'), FileController.updateFile);
router.put('/:fileId/move', authenticate, requireDelegationPermission('write'), FileController.moveFile);
router.post('/:fileId/restore', authenticate, requireDelegationPermission('write'), FileController.restoreFile);
router.post('/:fileId/favorite', authenticate, requireDelegationPermission('write'), FileController.toggleFavorite);
router.delete('/:fileId', authenticate, requireDelegationPermission('delete'), verifyDirectSharePasswordFor('delete'), FileController.deleteFile);

export default router;
