import { Router } from 'express';
import { AIController } from '../controllers/aiController';
import { authenticate } from '../middlewares/auth';
import { requireDelegationPermission } from '../middlewares/delegation';

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

/**
 * Chat général avec Bobby le robot
 * POST /api/ai/chat
 * Body: { message: string, history?: any[] }
 */
router.post('/chat', requireDelegationPermission('read'), AIController.chat);

/**
 * Analyser un fichier
 * POST /api/ai/analyze-file
 * Body: { fileId: string, prompt?: string }
 */
router.post('/analyze-file', requireDelegationPermission('read'), AIController.analyzeFile);

/**
 * Rechercher des fichiers avec l'IA
 * POST /api/ai/search-files
 * Body: { query: string }
 */
router.post('/search-files', requireDelegationPermission('read'), AIController.searchFiles);

/**
 * Générer un fichier avec l'IA
 * POST /api/ai/generate-file
 * Body: { prompt: string, fileName?: string, folderId?: string }
 */
router.post('/generate-file', requireDelegationPermission('write'), AIController.generateFile);

/**
 * Re-indexer les fichiers dans ChromaDB (vecteur store)
 * POST /api/ai/reindex
 */
router.post('/reindex', requireDelegationPermission('write'), AIController.reindexFiles);

/**
 * Conversations Bobby
 */
router.get('/conversations', requireDelegationPermission('read'), AIController.getConversations);
router.get('/conversations/:id', requireDelegationPermission('read'), AIController.getConversation);
router.delete('/conversations/:id', requireDelegationPermission('delete'), AIController.deleteConversation);

export default router;
