import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import { CommentService } from '../services/commentService';
import { SocketService } from '../services/socketService';
import { NotificationService } from '../services/notificationService';
import prisma from '../config/database';
import logger from '../config/logger';
import { sendSuccess, sendCreated, sendError } from '../utils/response';

export class CommentController {
  /**
   * POST /api/files/:fileId/comments
   */
  static async createComment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { fileId } = req.params;
      const { content, parentId } = req.body;
      const userId = req.user!.id;

      if (!content || content.trim().length === 0) {
        sendError(res, 'Le contenu du commentaire est requis', 400);
        return;
      }

      if (content.length > 2000) {
        sendError(res, 'Le commentaire est trop long (max 2000 caractères)', 400);
        return;
      }

      const comment = await CommentService.createComment(fileId, userId, content.trim(), parentId);

      SocketService.emitToFile(fileId, 'comment_added', comment);

      const file = await prisma.file.findUnique({ where: { id: fileId }, select: { userId: true, name: true } });
      if (file && file.userId !== userId) {
        NotificationService.create(
          file.userId,
          'COMMENT',
          'notifications.comment.title',
          'notifications.comment.message',
          { fileId, userName: req.user!.firstName || req.user!.email, fileName: file.name }
        ).catch((e) => logger.error(e));
      }

      sendCreated(res, { comment });
    } catch (error) { next(error); }
  }

  /**
   * GET /api/files/:fileId/comments
   */
  static async getFileComments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { fileId } = req.params;
      const userId = req.user!.id;

      const comments = await CommentService.getFileComments(fileId, userId);
      sendSuccess(res, { comments });
    } catch (error) { next(error); }
  }

  /**
   * PUT /api/comments/:commentId
   */
  static async updateComment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { commentId } = req.params;
      const { content } = req.body;
      const userId = req.user!.id;

      if (!content || content.trim().length === 0) {
        sendError(res, 'Le contenu du commentaire est requis', 400);
        return;
      }

      if (content.length > 2000) {
        sendError(res, 'Le commentaire est trop long (max 2000 caractères)', 400);
        return;
      }

      const comment = await CommentService.updateComment(commentId, userId, content.trim());
      sendSuccess(res, { comment });
    } catch (error) { next(error); }
  }

  /**
   * DELETE /api/comments/:commentId
   */
  static async deleteComment(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { commentId } = req.params;
      const userId = req.user!.id;

      await CommentService.deleteComment(commentId, userId);
      sendSuccess(res, { message: 'Commentaire supprimé' });
    } catch (error) { next(error); }
  }

  /**
   * GET /api/files/:fileId/comments/count
   */
  static async countFileComments(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const { fileId } = req.params;
      const userId = req.user!.id;

      const count = await CommentService.countFileComments(fileId, userId);
      sendSuccess(res, { count });
    } catch (error) { next(error); }
  }
}
