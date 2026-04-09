import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import aiService from '../services/aiService';
import { FileIndexService } from '../services/fileIndexService';

export class AIController {
  /**
   * Chat général avec Bobby le robot
   * Body: { message: string, conversationId?: string }
   * Si conversationId est fourni, l'historique est chargé depuis la BDD.
   * Si absent, une nouvelle conversation est créée automatiquement.
   */
  static async chat(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { message, conversationId } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required' });
      }
      if (message.length > 10_000) {
        return res.status(400).json({ error: 'Message too long (max 10 000 chars)' });
      }

      // --- Charger ou créer la conversation ---
      let conversation;
      if (conversationId) {
        conversation = await prisma.conversation.findFirst({
          where: { id: conversationId, userId },
          include: { messages: { orderBy: { createdAt: 'desc' }, take: 50 } },
        });
        if (!conversation) {
          return res.status(404).json({ error: 'Conversation not found' });
        }
        // Restaurer l'ordre chronologique (ascendant)
        conversation.messages.reverse();
      } else {
        conversation = await prisma.conversation.create({
          data: { userId, title: message.slice(0, 60) },
          include: { messages: true },
        });
      }

      // Construire l'historique au format Ollama — déjà limité à 50 messages par Prisma
      const history = conversation.messages
        .map((m: any) => ({ role: m.role, content: m.content }));

      const response = await aiService.chat(userId, message, history);

      // Persister le message utilisateur + la réponse
      await prisma.conversationMessage.createMany({
        data: [
          { conversationId: conversation.id, role: 'user',      content: message  },
          { conversationId: conversation.id, role: 'assistant', content: response },
        ],
      });

      // Mettre à jour updatedAt de la conversation
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });

      res.json({
        response,
        conversationId: conversation.id,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (msg === 'RATE_LIMIT_EXCEEDED') {
        res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Le quota quotidien de Bobby a été atteint. Réessayez demain ou ajoutez des crédits OpenRouter.',
        });
        return;
      }
      if (msg === 'AI_UNAVAILABLE') {
        res.status(503).json({
          error: 'AI_UNAVAILABLE',
          message: "Le service IA (Bobby) est actuellement indisponible. Assurez-vous que le service brain-api est démarré.",
        });
        return;
      }
      if (msg === 'TIMEOUT') {
        res.status(504).json({
          error: 'TIMEOUT',
          message: "Le service IA a mis trop de temps à répondre. Réessayez dans un moment.",
        });
        return;
      }
      next(error);
    }
  }

  /**
   * Lister les conversations de l'utilisateur
   * GET /api/ai/conversations
   */
  static async getConversations(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const conversations = await prisma.conversation.findMany({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        select: {
          id: true,
          title: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { messages: true } },
        },
      });

      res.json({ conversations });
    } catch (error) { next(error); }
  }

  /**
   * Récupérer les messages d'une conversation
   * GET /api/ai/conversations/:id
   */
  static async getConversation(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const conversation = await prisma.conversation.findFirst({
        where: { id: req.params.id, userId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });

      if (!conversation) return res.status(404).json({ error: 'Conversation not found' });

      res.json({ conversation });
    } catch (error) { next(error); }
  }

  /**
   * Supprimer une conversation
   * DELETE /api/ai/conversations/:id
   */
  static async deleteConversation(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const existing = await prisma.conversation.findFirst({
        where: { id: req.params.id, userId },
      });
      if (!existing) return res.status(404).json({ error: 'Conversation not found' });

      await prisma.conversation.delete({ where: { id: req.params.id } });
      res.json({ deleted: req.params.id });
    } catch (error) { next(error); }
  }

  /**
   * Analyser un fichier
   * POST /api/ai/analyze-file
   * Body: { fileId: string, prompt?: string }
   */
  static async analyzeFile(req: Request, res: Response, next: NextFunction) {
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
    } catch (error) { next(error); }
  }

  /**
   * Rechercher des fichiers avec l'IA
   * POST /api/ai/search-files
   * Body: { query: string }
   */
  static async searchFiles(req: Request, res: Response, next: NextFunction) {
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
    } catch (error) { next(error); }
  }

  /**
   * Re-indexer tous les fichiers de l'utilisateur dans ChromaDB
   * POST /api/ai/reindex
   */
  static async reindexFiles(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ error: 'Unauthorized' });

      const files = await prisma.file.findMany({
        where: { userId, isDeleted: false },
        select: { id: true },
      });

      // Fire-and-forget — non-blocking
      for (const file of files) {
        FileIndexService.indexFileAsync(file.id, userId);
      }

      res.json({ message: `Re-indexation de ${files.length} fichiers lancée en arrière-plan.`, count: files.length });
    } catch (error) { next(error); }
  }

  /**
   * Créer un fichier généré par l'IA
   * POST /api/ai/generate-file
   * Body: { prompt: string, fileName?: string, folderId?: string }
   */
  static async generateFile(req: Request, res: Response, next: NextFunction) {
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
    } catch (error) { next(error); }
  }
}
