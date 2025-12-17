import { Request, Response } from 'express';
import aiService from '../services/aiService';

export class AIController {
  /**
   * Chat général avec Bobby le robot
   */
  static async chat(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { message, history } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required' });
      }

      const response = await aiService.chat(userId, message, history);

      res.json({
        response,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Error in chat:', error);

      // Gérer les erreurs de rate limit spécifiquement
      if (error.message === 'RATE_LIMIT_EXCEEDED') {
        return res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Le quota quotidien de Bobby a été atteint. Réessayez demain ou ajoutez des crédits OpenRouter.',
        });
      }

      res.status(500).json({ error: error.message || 'Failed to process chat' });
    }
  }

  /**
   * Analyser un fichier
   * POST /api/ai/analyze-file
   * Body: { fileId: string, prompt?: string }
   */
  static async analyzeFile(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { fileId, prompt } = req.body;

      if (!fileId) {
        return res.status(400).json({ error: 'File ID is required' });
      }

      const analysis = await aiService.analyzeFile(fileId, userId, prompt);

      res.json({
        fileId,
        analysis,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Error analyzing file:', error);
      res.status(500).json({ error: error.message || 'Failed to analyze file' });
    }
  }

  /**
   * Rechercher des fichiers avec l'IA
   * POST /api/ai/search-files
   * Body: { query: string }
   */
  static async searchFiles(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { query } = req.body;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ error: 'Search query is required' });
      }

      const result = await aiService.searchFiles(userId, query);

      res.json({
        ...result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Error searching files:', error);
      res.status(500).json({ error: error.message || 'Failed to search files' });
    }
  }

  /**
   * Créer un fichier généré par l'IA
   * POST /api/ai/generate-file
   * Body: { prompt: string, fileName?: string, folderId?: string }
   */
  static async generateFile(req: Request, res: Response) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { prompt, fileName, folderId } = req.body;

      if (!prompt || typeof prompt !== 'string') {
        return res.status(400).json({ error: 'Generation prompt is required' });
      }

      const result = await aiService.createGeneratedFile(userId, prompt, fileName, folderId);

      res.json({
        ...result,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('Error generating file:', error);
      res.status(500).json({ error: error.message || 'Failed to generate file' });
    }
  }
}
