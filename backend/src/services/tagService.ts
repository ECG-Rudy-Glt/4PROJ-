import prisma from '../config/database';
import { AuditService } from './auditService';
import { PlanService } from './planService';
import logger from '../config/logger';

export class TagService {
  // Créer un tag
  static async createTag(userId: string, name: string, color: string = '#6366f1') {
    const tagsCount = await prisma.tag.count({ where: { userId } });
    await PlanService.assertLimit(userId, 'maxTags', tagsCount);

    // Vérifier si le tag existe déjà
    const existing = await prisma.tag.findUnique({
      where: {
        userId_name: {
          userId,
          name,
        },
      },
    });

    if (existing) {
      throw new Error('Un tag avec ce nom existe déjà');
    }

    return await prisma.tag.create({
      data: {
        name,
        color,
        userId,
      },
    });
  }

  // Récupérer tous les tags d'un utilisateur
  static async getUserTags(userId: string) {
    return await prisma.tag.findMany({
      where: { userId },
      include: {
        _count: {
          select: { files: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  // Mettre à jour un tag
  static async updateTag(tagId: string, userId: string, name?: string, color?: string) {
    // Vérifier que le tag appartient à l'utilisateur
    const tag = await prisma.tag.findUnique({
      where: { id: tagId },
    });

    if (!tag || tag.userId !== userId) {
      throw new Error('Tag non trouvé');
    }

    // Si on change le nom, vérifier qu'il n'existe pas déjà
    if (name && name !== tag.name) {
      const existing = await prisma.tag.findUnique({
        where: {
          userId_name: {
            userId,
            name,
          },
        },
      });

      if (existing) {
        throw new Error('Un tag avec ce nom existe déjà');
      }
    }

    return await prisma.tag.update({
      where: { id: tagId },
      data: {
        ...(name && { name }),
        ...(color && { color }),
      },
    });
  }

  // Supprimer un tag
  static async deleteTag(tagId: string, userId: string) {
    const tag = await prisma.tag.findUnique({
      where: { id: tagId },
    });

    if (!tag || tag.userId !== userId) {
      throw new Error('Tag non trouvé');
    }

    await prisma.tag.delete({
      where: { id: tagId },
    });
  }

  // Ajouter un tag à un fichier
  static async addTagToFile(fileId: string, tagId: string, userId: string) {
    // Vérifier que le fichier appartient à l'utilisateur
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file || file.userId !== userId) {
      throw new Error('Fichier non trouvé');
    }

    // Vérifier que le tag appartient à l'utilisateur
    const tag = await prisma.tag.findUnique({
      where: { id: tagId },
    });

    if (!tag || tag.userId !== userId) {
      throw new Error('Tag non trouvé');
    }

    // Vérifier si l'association existe déjà
    const existing = await prisma.fileTag.findUnique({
      where: {
        fileId_tagId: {
          fileId,
          tagId,
        },
      },
    });

    if (existing) {
      return existing; // Déjà associé
    }

    // Limite de tags par fichier (même limite que plan maxTags)
    const fileTagsCount = await prisma.fileTag.count({
      where: {
        fileId,
        file: { userId },
      },
    });
    await PlanService.assertLimit(userId, 'maxTags', fileTagsCount);

    return await prisma.fileTag.create({
      data: {
        fileId,
        tagId,
      },
      include: {
        tag: true,
      },
    }).then(result => {
      // Audit log
      AuditService.createLog(userId, 'TAG_ADD', {
        fileId,
        fileName: file.name,
        tagName: tag.name,
      }).catch((e) => logger.error(e));
      return result;
    });
  }

  // Retirer un tag d'un fichier
  static async removeTagFromFile(fileId: string, tagId: string, userId: string) {
    // Vérifier que le fichier appartient à l'utilisateur
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file || file.userId !== userId) {
      throw new Error('Fichier non trouvé');
    }

    const fileTag = await prisma.fileTag.findUnique({
      where: {
        fileId_tagId: {
          fileId,
          tagId,
        },
      },
    });

    if (!fileTag) {
      throw new Error('Association non trouvée');
    }

    await prisma.fileTag.delete({
      where: {
        fileId_tagId: {
          fileId,
          tagId,
        },
      },
    });

    // Audit log
    AuditService.createLog(userId, 'TAG_REMOVE', {
      fileId,
      fileName: file.name,
    }).catch((e) => logger.error(e));
  }

  // Récupérer tous les tags d'un fichier
  static async getFileTags(fileId: string, userId: string) {
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file || file.userId !== userId) {
      throw new Error('Fichier non trouvé');
    }

    return await prisma.fileTag.findMany({
      where: { fileId },
      include: {
        tag: true,
      },
    });
  }

  // Récupérer tous les fichiers avec un tag spécifique
  static async getFilesByTag(tagId: string, userId: string) {
    const tag = await prisma.tag.findUnique({
      where: { id: tagId },
    });

    if (!tag || tag.userId !== userId) {
      throw new Error('Tag non trouvé');
    }

    return await prisma.fileTag.findMany({
      where: { tagId },
      include: {
        file: {
          include: {
            folder: true,
          },
        },
      },
    });
  }
}
