import { Router } from 'express';
import { FolderController } from '../controllers/folderController';
import { authenticate } from '../middlewares/auth';
import { requireDelegationPermission } from '../middlewares/delegation';
import { requireFolderPermission } from '../middlewares/permissions';

const router = Router();

router.post('/', authenticate, requireDelegationPermission('write'), FolderController.createFolder);
router.get('/', authenticate, requireDelegationPermission('read'), FolderController.listFolders);
router.get('/deleted', authenticate, FolderController.getDeletedFolders);
router.get('/:folderId/download', authenticate, requireDelegationPermission('read'), requireFolderPermission('read'), FolderController.downloadAsZip);
router.get('/:folderId', authenticate, requireDelegationPermission('read'), requireFolderPermission('read'), FolderController.getFolder);
router.get('/:folderId/breadcrumbs', authenticate, requireDelegationPermission('read'), requireFolderPermission('read'), FolderController.getBreadcrumbs);
router.get('/:folderId/trash-contents', authenticate, requireDelegationPermission('read'), requireFolderPermission('read'), FolderController.getFolderTrashContents);
router.post('/:folderId/restore', authenticate, requireFolderPermission('write'), FolderController.restoreFolder);
router.put('/:folderId', authenticate, requireDelegationPermission('write'), requireFolderPermission('write'), FolderController.updateFolder);
router.put('/:folderId/move', authenticate, requireDelegationPermission('write'), requireFolderPermission('write'), FolderController.moveFolder);
router.delete('/:folderId', authenticate, requireDelegationPermission('delete'), requireFolderPermission('delete'), FolderController.deleteFolder);

export default router;
