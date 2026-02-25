import { Router } from 'express';
import { FolderController } from '../controllers/folderController';
import { authenticate } from '../middlewares/auth';
import { requireDelegationPermission } from '../middlewares/delegation';

const router = Router();

router.post('/', authenticate, requireDelegationPermission('write'), FolderController.createFolder);
router.get('/', authenticate, requireDelegationPermission('read'), FolderController.listFolders);
router.get('/:folderId', authenticate, requireDelegationPermission('read'), FolderController.getFolder);
router.get('/:folderId/breadcrumbs', authenticate, requireDelegationPermission('read'), FolderController.getBreadcrumbs);
router.put('/:folderId', authenticate, requireDelegationPermission('write'), FolderController.updateFolder);
router.put('/:folderId/move', authenticate, requireDelegationPermission('write'), FolderController.moveFolder);
router.delete('/:folderId', authenticate, requireDelegationPermission('delete'), FolderController.deleteFolder);

export default router;
