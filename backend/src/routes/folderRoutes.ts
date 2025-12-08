import { Router } from 'express';
import { FolderController } from '../controllers/folderController';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.post('/', authenticate, FolderController.createFolder);
router.get('/', authenticate, FolderController.listFolders);
router.get('/:folderId', authenticate, FolderController.getFolder);
router.get('/:folderId/breadcrumbs', authenticate, FolderController.getBreadcrumbs);
router.put('/:folderId', authenticate, FolderController.updateFolder);
router.put('/:folderId/move', authenticate, FolderController.moveFolder);
router.delete('/:folderId', authenticate, FolderController.deleteFolder);

export default router;
