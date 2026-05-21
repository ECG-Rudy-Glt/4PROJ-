import { Router } from 'express';
import { SyncController } from '../controllers/syncController';
import { authenticate } from '../middlewares/auth';
import { upload } from '../config/multer';
import { requireDelegationPermission } from '../middlewares/delegation';

const router = Router();

router.get('/root', authenticate, requireDelegationPermission('write'), SyncController.getRoot);
router.get('/tree', authenticate, requireDelegationPermission('read'), SyncController.getTree);
router.post('/files/upload', authenticate, requireDelegationPermission('write'), upload.single('file'), SyncController.uploadFile);

export default router;
