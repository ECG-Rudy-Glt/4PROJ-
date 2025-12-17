import { Router } from 'express';
import { AIController } from '../controllers/aiController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// Toutes les routes nécessitent une authentification
router.use(authenticate);

/**
 * Chat général avec Bobby le robot
 * POST /api/ai/chat
 * Body: { message: string, history?: any[] }
 */
router.post('/chat', AIController.chat);

/**
 * Analyser un fichier
 * POST /api/ai/analyze-file
 * Body: { fileId: string, prompt?: string }
 */
router.post('/analyze-file', AIController.analyzeFile);

/**
 * Rechercher des fichiers avec l'IA
 * POST /api/ai/search-files
 * Body: { query: string }
 */
router.post('/search-files', AIController.searchFiles);

/**
 * Générer un fichier avec l'IA
 * POST /api/ai/generate-file
 * Body: { prompt: string, fileName?: string, folderId?: string }
 */
router.post('/generate-file', AIController.generateFile);

export default router;
