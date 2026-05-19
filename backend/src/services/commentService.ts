import prisma from '../config/database';
import { SocketService } from './socketService';
import { AuditService } from './auditService';
import logger from '../config/logger';
import { checkFilePermission } from '../middlewares/permissions';
export class CommentService {
  private static async assertReadableFile(fileId: string, userId: string) {
    let hasAccess = false;

    try {
      hasAccess = await checkFilePermission(userId, fileId, 'read');
    } catch {
      hasAccess = false;
    }

    if (!hasAccess) {
      throw new Error('Fichier non trouvé ou accès refusé');
    }

    const file = await prisma.file.findUnique({
      where: { id: fileId },
      select: { name: true },
    });

    if (!file) {
      throw new Error('Fichier non trouvé ou accès refusé');
    }

    return file;
  }

  /**
   * Créer un nouveau commentaire sur un fichier
   */
  static async createComment(
    fileId: string,
    userId: string,
    content: string,
    parentId?: string
  ) {
    const file = await this.assertReadableFile(fileId, userId);

    // Si c'est une réponse, vérifier que le commentaire parent existe
    if (parentId) {
      const parentComment = await prisma.comment.findFirst({
        where: { id: parentId, fileId },
      });

      if (!parentComment) {
        throw new Error('Commentaire parent non trouvé');
      }
    }

    const comment = await prisma.comment.create({
      data: {
        content,
        fileId,
        userId,
        parentId: parentId || null,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    // Audit log
    AuditService.createLog(userId, 'COMMENT_ADD', {
      fileId,
      fileName: file.name,
    }).catch((e) => logger.error(e));

    return comment;
  }

  /**
   * Récupérer tous les commentaires d'un fichier (avec leurs réponses)
   */
  static async getFileComments(fileId: string, userId: string) {
    await this.assertReadableFile(fileId, userId);

    // Récupérer tous les commentaires (principaux et réponses)
    const comments = await prisma.comment.findMany({
      where: { fileId, parentId: null }, // Seulement les commentaires racines
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
        replies: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                avatar: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return comments;
  }

  /**
   * Mettre à jour un commentaire
   */
  static async updateComment(commentId: string, userId: string, content: string) {
    const comment = await prisma.comment.findFirst({
      where: { id: commentId, userId }, // Seulement l'auteur peut modifier
    });

    if (!comment) {
      throw new Error('Commentaire non trouvé ou accès refusé');
    }

    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: { content },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            avatar: true,
          },
        },
      },
    });

    return updatedComment;
  }

  /**
   * Supprimer un commentaire
   */
  static async deleteComment(commentId: string, userId: string) {
    const comment = await prisma.comment.findFirst({
      where: { id: commentId, userId }, // Seulement l'auteur peut supprimer
    });

    if (!comment) {
      throw new Error('Commentaire non trouvé ou accès refusé');
    }

    // Supprimer le commentaire (cascade supprime les réponses)
    await prisma.comment.delete({
      where: { id: commentId },
    });

    // Audit log
    AuditService.createLog(userId, 'COMMENT_DELETE', {
      fileId: comment.fileId,
    }).catch((e) => logger.error(e));

    return { message: 'Commentaire supprimé' };
  }

  /**
   * Compter le nombre de commentaires sur un fichier
   */
  static async countFileComments(fileId: string, userId?: string) {
    // Si userId est fourni, vérifier l'accès
    if (userId) {
      await this.assertReadableFile(fileId, userId);
    }

    return await prisma.comment.count({
      where: { fileId },
    });
  }
}
