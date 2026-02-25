import { Router } from 'express';
import { FileController } from '../controllers/fileController';
import { authenticate } from '../middlewares/auth';
import { upload } from '../config/multer';
import { checkQuotaBeforeUpload } from '../middlewares/quotaCheck';

const router = Router();

router.post('/upload', authenticate, checkQuotaBeforeUpload, upload.single('file'), FileController.uploadFile);
router.get('/', authenticate, FileController.listFiles);
router.get('/deleted', authenticate, FileController.getDeletedFiles);
router.get('/favorites', authenticate, FileController.getFavoriteFiles);
router.get('/shares/accepted', authenticate, FileController.getAcceptedShares);
router.get('/search', authenticate, FileController.searchFiles);
router.get('/:fileId', authenticate, FileController.getFile);
router.get('/:fileId/download', authenticate, FileController.downloadFile);
router.get('/:fileId/stream', authenticate, FileController.streamFile);
router.put('/:fileId', authenticate, FileController.updateFile);
router.put('/:fileId/move', authenticate, FileController.moveFile);
router.post('/:fileId/restore', authenticate, FileController.restoreFile);
router.post('/:fileId/favorite', authenticate, FileController.toggleFavorite);
router.delete('/:fileId', authenticate, FileController.deleteFile);

export default router;
