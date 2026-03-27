import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { CommentService } from '../services/commentService';
import { SocketService } from '../services/socketService';
import { NotificationService } from '../services/notificationService';
import prisma from '../config/database';
import logger from '../config/logger';

export class CommentController {
  /**
   * POST /api/files/:fileId/comments
   * Créer un nouveau commentaire
   */
  static async createComment(req: AuthRequest, res: Response) {
    try {
      const { fileId } = req.params;
      const { content, parentId } = req.body;
      const userId = req.user!.id;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: 'Le contenu du commentaire est requis' });
      }

      if (content.length > 2000) {
        return res.status(400).json({ error: 'Le commentaire est trop long (max 2000 caractères)' });
      }

      const comment = await CommentService.createComment(fileId, userId, content.trim(), parentId);

      // Notification temps réel
      SocketService.emitToFile(fileId, 'comment_added', comment);

      // Notification persistante au propriétaire du fichier
      const file = await prisma.file.findUnique({ where: { id: fileId }, select: { userId: true, name: true } });
      if (file && file.userId !== userId) {
        NotificationService.create(
          file.userId,
          'COMMENT',
          'Nouveau commentaire',
          `${req.user!.firstName || req.user!.email} a commenté "${file.name}".`,
          { fileId }
        ).catch((e) => logger.error(e));
      }

      res.status(201).json({ comment });
    } catch (error) { next(error); }
  }

  /**
   * GET /api/files/:fileId/comments
   * Récupérer tous les commentaires d'un fichier
   */
  static async getFileComments(req: AuthRequest, res: Response) {
    try {
      const { fileId } = req.params;
      const userId = req.user!.id;

      const comments = await CommentService.getFileComments(fileId, userId);

      res.json({ comments });
    } catch (error) { next(error); }
  }

  /**
   * PUT /api/comments/:commentId
   * Mettre à jour un commentaire
   */
  static async updateComment(req: AuthRequest, res: Response) {
    try {
      const { commentId } = req.params;
      const { content } = req.body;
      const userId = req.user!.id;

      if (!content || content.trim().length === 0) {
        return res.status(400).json({ error: 'Le contenu du commentaire est requis' });
      }

      if (content.length > 2000) {
        return res.status(400).json({ error: 'Le commentaire est trop long (max 2000 caractères)' });
      }

      const comment = await CommentService.updateComment(commentId, userId, content.trim());

      res.json({ comment });
    } catch (error) { next(error); }
  }

  /**
   * DELETE /api/comments/:commentId
   * Supprimer un commentaire
   */
  static async deleteComment(req: AuthRequest, res: Response) {
    try {
      const { commentId } = req.params;
      const userId = req.user!.id;

      await CommentService.deleteComment(commentId, userId);

      res.json({ message: 'Commentaire supprimé' });
    } catch (error) { next(error); }
  }

  /**
   * GET /api/files/:fileId/comments/count
   * Compter les commentaires d'un fichier
   */
  static async countFileComments(req: AuthRequest, res: Response) {
    try {
      const { fileId } = req.params;
      const userId = req.user!.id;

      const count = await CommentService.countFileComments(fileId, userId);

      res.json({ count });
    } catch (error) { next(error); }
  }
}
