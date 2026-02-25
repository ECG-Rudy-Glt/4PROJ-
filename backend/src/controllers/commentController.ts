import { Response } from 'express';
import { AuthRequest } from '../types';
import { CommentService } from '../services/commentService';
import { SocketService } from '../services/socketService';

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

      res.status(201).json({ comment });
    } catch (error: any) {
      console.error('Erreur lors de la création du commentaire:', error);
      res.status(500).json({ error: error.message || 'Échec de la création du commentaire' });
    }
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
    } catch (error: any) {
      console.error('Erreur lors de la récupération des commentaires:', error);
      res.status(500).json({ error: error.message || 'Échec de la récupération des commentaires' });
    }
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
    } catch (error: any) {
      console.error('Erreur lors de la mise à jour du commentaire:', error);
      res.status(500).json({ error: error.message || 'Échec de la mise à jour du commentaire' });
    }
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
    } catch (error: any) {
      console.error('Erreur lors de la suppression du commentaire:', error);
      res.status(500).json({ error: error.message || 'Échec de la suppression du commentaire' });
    }
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
    } catch (error: any) {
      console.error('Erreur lors du comptage des commentaires:', error);
      res.status(500).json({ error: error.message || 'Échec du comptage des commentaires' });
    }
  }
}
