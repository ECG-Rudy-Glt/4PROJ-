import { Router } from 'express';
import { TagController } from '../controllers/tagController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Routes pour les tags
router.post('/', authenticate, TagController.createTag);
router.get('/', authenticate, TagController.getUserTags);
router.put('/:tagId', authenticate, TagController.updateTag);
router.delete('/:tagId', authenticate, TagController.deleteTag);

// Routes pour associer des tags aux fichiers
router.post('/file/:fileId', authenticate, TagController.addTagToFile);
router.delete('/file/:fileId/:tagId', authenticate, TagController.removeTagFromFile);
router.get('/file/:fileId', authenticate, TagController.getFileTags);

// Route pour récupérer les fichiers par tag
router.get('/:tagId/files', authenticate, TagController.getFilesByTag);

export default router;
