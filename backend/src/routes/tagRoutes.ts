import { Router } from 'express';
import { TagController } from '../controllers/tagController';
import { authenticate } from '../middlewares/auth';
import { requireDelegationPermission } from '../middlewares/delegation';

const router = Router();

// Routes pour les tags
router.post('/', authenticate, requireDelegationPermission('write'), TagController.createTag);
router.get('/', authenticate, requireDelegationPermission('read'), TagController.getUserTags);
router.put('/:tagId', authenticate, requireDelegationPermission('write'), TagController.updateTag);
router.delete('/:tagId', authenticate, requireDelegationPermission('delete'), TagController.deleteTag);

// Routes pour associer des tags aux fichiers
router.post('/file/:fileId', authenticate, requireDelegationPermission('write'), TagController.addTagToFile);
router.delete('/file/:fileId/:tagId', authenticate, requireDelegationPermission('delete'), TagController.removeTagFromFile);
router.get('/file/:fileId', authenticate, requireDelegationPermission('read'), TagController.getFileTags);

// Route pour récupérer les fichiers par tag
router.get('/:tagId/files', authenticate, requireDelegationPermission('read'), TagController.getFilesByTag);

export default router;
