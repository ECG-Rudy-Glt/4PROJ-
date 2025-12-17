import { Router } from 'express';
import { VersionController } from '../controllers/versionController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

// GET /api/files/:fileId/versions - Récupérer toutes les versions d'un fichier
router.get('/files/:fileId/versions', VersionController.getFileVersions);

// POST /api/files/:fileId/versions/:versionId/restore - Restaurer une version
router.post('/files/:fileId/versions/:versionId/restore', VersionController.restoreVersion);

// DELETE /api/files/:fileId/versions/:versionId - Supprimer une version
router.delete('/files/:fileId/versions/:versionId', VersionController.deleteVersion);

export default router;
