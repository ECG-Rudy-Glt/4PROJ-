import prisma from '../config/database';
import { SocketService } from './socketService';
import { AuditService } from './auditService';
export class CommentService {
  /**
   * Créer un nouveau commentaire sur un fichier
   */
  static async createComment(
    fileId: string,
    userId: string,
    content: string,
    parentId?: string
  ) {
    // Vérifier que le fichier existe et appartient à l'utilisateur ou est partagé avec lui
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        OR: [
          { userId }, // L'utilisateur est propriétaire
          {
            // Ou le fichier est dans un dossier partagé avec l'utilisateur
            folder: {
              sharedWith: {
                some: { sharedWithId: userId },
              },
            },
          },
          {
            // Ou le fichier est directement partagé avec l'utilisateur
            sharedWith: {
              some: {
                sharedWithId: userId,
                canRead: true,
              },
            },
          },
        ],
      },
    });

    if (!file) {
      throw new Error('Fichier non trouvé ou accès refusé');
    }

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
    }).catch(console.error);

    return comment;
  }

  /**
   * Récupérer tous les commentaires d'un fichier (avec leurs réponses)
   */
  static async getFileComments(fileId: string, userId: string) {
    // Vérifier que l'utilisateur a accès au fichier
    const file = await prisma.file.findFirst({
      where: {
        id: fileId,
        OR: [
          { userId },
          {
            folder: {
              sharedWith: {
                some: { sharedWithId: userId },
              },
            },
          },
          {
            sharedWith: {
              some: {
                sharedWithId: userId,
                canRead: true,
              },
            },
          },
        ],
      },
    });

    if (!file) {
      throw new Error('Fichier non trouvé ou accès refusé');
    }

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
    }).catch(console.error);

    return { message: 'Commentaire supprimé' };
  }

  /**
   * Compter le nombre de commentaires sur un fichier
   */
  static async countFileComments(fileId: string, userId?: string) {
    // Si userId est fourni, vérifier l'accès
    if (userId) {
      const file = await prisma.file.findFirst({
        where: {
          id: fileId,
          OR: [
            { userId },
            {
              folder: {
                sharedWith: {
                  some: { sharedWithId: userId },
                },
              },
            },
            {
              sharedWith: {
                some: {
                  sharedWithId: userId,
                  canRead: true,
                },
              },
            },
          ],
        },
      });

      if (!file) {
        throw new Error('Fichier non trouvé ou accès refusé');
      }
    }

    return await prisma.comment.count({
      where: { fileId },
    });
  }
}
