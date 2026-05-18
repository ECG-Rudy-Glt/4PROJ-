import { Router } from 'express';
import { VersionController } from '../controllers/versionController';
import { authenticate } from '../middlewares/auth';
import { requireDelegationPermission } from '../middlewares/delegation';

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

import { verifyDirectSharePassword, verifyDirectSharePasswordFor } from '../middlewares/sharePasswordMiddleware';

// GET /api/files/:fileId/versions - Récupérer toutes les versions d'un fichier
router.get('/files/:fileId/versions', requireDelegationPermission('read'), verifyDirectSharePassword, VersionController.getFileVersions);

// POST /api/files/:fileId/versions/:versionId/restore - Restaurer une version
router.post('/files/:fileId/versions/:versionId/restore', requireDelegationPermission('write'), verifyDirectSharePasswordFor('write'), VersionController.restoreVersion);

// DELETE /api/files/:fileId/versions/:versionId - Supprimer une version
router.delete('/files/:fileId/versions/:versionId', requireDelegationPermission('delete'), verifyDirectSharePasswordFor('delete'), VersionController.deleteVersion);

export default router;
