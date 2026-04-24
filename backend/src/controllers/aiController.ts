import { Request, Response, NextFunction } from 'express';
import prisma from '../config/database';
import aiService from '../services/aiService';
import { FileIndexService } from '../services/fileIndexService';
import { sendSuccess, sendCreated, sendError } from '../utils/response';
import logger from '../config/logger';

export class AIController {
  /**
   * Chat général avec Bobby le robot
   * Body: { message: string, conversationId?: string }
   */
  static async chat(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) {
        sendError(res, 'Unauthorized', 401);
        return;
      }

      const { message, conversationId, history: clientHistory } = req.body;
      logger.info({ userId, message, conversationId }, 'Bobby Chat Request');

      if (!message || typeof message !== 'string') {
        sendError(res, 'Message is required', 400);
        return;
      }
      if (message.length > 10_000) {
        sendError(res, 'Message too long (max 10 000 chars)', 400);
        return;
      }

      let conversation: any;
      if (conversationId) {
        conversation = await prisma.conversation.findFirst({
          where: { id: conversationId, userId },
          include: { messages: { orderBy: { createdAt: 'desc' }, take: 50 } },
        });
        if (!conversation) {
          sendError(res, 'Conversation not found', 404);
          return;
        }
        conversation.messages.reverse();
      } else {
        conversation = await prisma.conversation.create({
          data: { userId, title: message.slice(0, 60) },
          include: { messages: true },
        });
      }

      let history = conversation.messages.map((m: any) => ({ role: m.role, content: m.content }));

      // Si le frontend fournit directement l'historique complet (stateless context), on l'utilise en priorité !
      if (clientHistory && Array.isArray(clientHistory) && clientHistory.length > 0) {
        logger.info({ historySize: clientHistory.length }, 'Using client-provided history');
        history = clientHistory.map((m: any) => ({
          role: m.role === 'model' ? 'assistant' : 'user',
          content: m.parts?.[0]?.text || m.content || m.text || '',
        }));
      }

      logger.info('Calling AIService...');
      const response = await aiService.chat(userId, message, history);
      logger.info({ responseLength: response?.length }, 'Received response from AIService');

      await prisma.conversationMessage.createMany({
        data: [
          { conversationId: conversation.id, role: 'user',      content: message  },
          { conversationId: conversation.id, role: 'assistant', content: response },
        ],
      });

      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      });

      sendSuccess(res, {
        response,
        conversationId: conversation.id,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error({ error }, 'Error in AI Controller Chat');
      const msg = error instanceof Error ? error.message : 'Unknown error';
      if (msg === 'RATE_LIMIT_EXCEEDED') {
        sendError(res, 'Le quota quotidien de Bobby a été atteint. Réessayez demain ou ajoutez des crédits OpenRouter.', 429, 'RATE_LIMIT_EXCEEDED');
        return;
      }
      if (msg === 'AI_UNAVAILABLE') {
        sendError(res, "Le service IA (Bobby) est actuellement indisponible. Assurez-vous que le service brain-api est démarré.", 503, 'AI_UNAVAILABLE');
        return;
      }
      if (msg === 'TIMEOUT') {
        sendError(res, "Le service IA a mis trop de temps à répondre. Réessayez dans un moment.", 504, 'TIMEOUT');
        return;
      }
      next(error);
    }
  }

  /**
   * GET /api/ai/conversations
   */
  static async getConversations(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) { sendError(res, 'Unauthorized', 401); return; }

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

      sendSuccess(res, { conversations });
    } catch (error) { next(error); }
  }

  /**
   * GET /api/ai/conversations/:id
   */
  static async getConversation(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) { sendError(res, 'Unauthorized', 401); return; }

      const conversation = await prisma.conversation.findFirst({
        where: { id: req.params.id, userId },
        include: { messages: { orderBy: { createdAt: 'asc' } } },
      });

      if (!conversation) { sendError(res, 'Conversation not found', 404); return; }

      sendSuccess(res, { conversation });
    } catch (error) { next(error); }
  }

  /**
   * DELETE /api/ai/conversations/:id
   */
  static async deleteConversation(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) { sendError(res, 'Unauthorized', 401); return; }

      const existing = await prisma.conversation.findFirst({
        where: { id: req.params.id, userId },
      });
      if (!existing) { sendError(res, 'Conversation not found', 404); return; }

      await prisma.conversation.delete({ where: { id: req.params.id } });
      sendSuccess(res, { deleted: req.params.id });
    } catch (error) { next(error); }
  }

  /**
   * POST /api/ai/analyze-file
   */
  static async analyzeFile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) { sendError(res, 'Unauthorized', 401); return; }

      const { fileId, prompt } = req.body;

      if (!fileId) {
        sendError(res, 'File ID is required', 400);
        return;
      }

      const analysis = await aiService.analyzeFile(fileId, userId, prompt);

      sendSuccess(res, { fileId, analysis, timestamp: new Date().toISOString() });
    } catch (error) { next(error); }
  }

  /**
   * POST /api/ai/search-files
   */
  static async searchFiles(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) { sendError(res, 'Unauthorized', 401); return; }

      const { query } = req.body;

      if (!query || typeof query !== 'string') {
        sendError(res, 'Search query is required', 400);
        return;
      }

      const result = await aiService.searchFiles(userId, query);
      sendSuccess(res, { ...result, timestamp: new Date().toISOString() });
    } catch (error) { next(error); }
  }

  /**
   * POST /api/ai/reindex
   */
  static async reindexFiles(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) { sendError(res, 'Unauthorized', 401); return; }

      const files = await prisma.file.findMany({
        where: { userId, isDeleted: false },
        select: { id: true },
      });

      for (const file of files) {
        FileIndexService.indexFileAsync(file.id, userId);
      }

      sendSuccess(res, { message: `Re-indexation de ${files.length} fichiers lancée en arrière-plan.`, count: files.length });
    } catch (error) { next(error); }
  }

  /**
   * POST /api/ai/generate-file
   */
  static async generateFile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.id;
      if (!userId) { sendError(res, 'Unauthorized', 401); return; }

      const { prompt, fileName, folderId } = req.body;

      if (!prompt || typeof prompt !== 'string') {
        sendError(res, 'Generation prompt is required', 400);
        return;
      }

      const result = await aiService.createGeneratedFile(userId, prompt, fileName, folderId);
      sendCreated(res, { ...result, timestamp: new Date().toISOString() });
    } catch (error) { next(error); }
  }
}
