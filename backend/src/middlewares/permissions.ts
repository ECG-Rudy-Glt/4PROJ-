import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import prisma from '../config/database';

export type Permission = 'read' | 'write' | 'delete' | 'share';

function permissionWhere(requiredPermission: Permission) {
  switch (requiredPermission) {
    case 'read':
      return { canRead: true };
    case 'write':
      return { canWrite: true };
    case 'delete':
      return { canDelete: true };
    case 'share':
      return { canShare: true };
    default:
      return {};
  }
}

export function acceptedShareBaseWhere(userId: string) {
  return {
    sharedWithId: userId,
    accepted: true,
  };
}

export function acceptedSharePermissionWhere(userId: string, requiredPermission: Permission) {
  return {
    ...acceptedShareBaseWhere(userId),
    ...permissionWhere(requiredPermission),
  };
}

/**
 * Vérifie si l'utilisateur a la permission requise sur un dossier partagé
 */
export async function checkSharedFolderPermission(
  userId: string,
  folderId: string,
  requiredPermission: Permission
): Promise<boolean> {
  const sharedFolder = await prisma.sharedFolder.findFirst({
    where: {
      folderId,
      ...acceptedShareBaseWhere(userId),
    },
  });

  if (!sharedFolder) {
    return false;
  }

  switch (requiredPermission) {
    case 'read':
      return sharedFolder.canRead;
    case 'write':
      return sharedFolder.canWrite;
    case 'delete':
      return sharedFolder.canDelete;
    case 'share':
      return sharedFolder.canShare;
    default:
      return false;
  }
}

/**
 * Vérifie si l'utilisateur a la permission requise sur un fichier
 * (soit propriétaire, soit via permissions partagées du dossier parent)
 */
export async function checkFilePermission(
  userId: string,
  fileId: string,
  requiredPermission: Permission
): Promise<boolean> {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
    include: { folder: true },
  });

  if (!file) {
    throw new Error('Fichier non trouvé');
  }

  // Si l'utilisateur est propriétaire, il a tous les droits
  if (file.userId === userId) {
    return true;
  }

  const sharedFile = await prisma.sharedFile.findFirst({
    where: {
      fileId,
      ...acceptedSharePermissionWhere(userId, requiredPermission),
    },
  });

  if (sharedFile) {
    return true;
  }

  // Sinon, vérifier les permissions du dossier partagé
  if (file.folderId) {
    return checkSharedFolderPermission(userId, file.folderId, requiredPermission);
  }

  return false;
}

/**
 * Middleware Express pour vérifier les permissions sur un fichier
 */
export function requireFilePermission(permission: Permission) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const fileId = req.params.fileId || req.params.id;

      if (!fileId) {
        res.status(400).json({ error: 'ID de fichier manquant' });
        return;
      }

      const hasPermission = await checkFilePermission(userId, fileId, permission);

      if (!hasPermission) {
        res.status(403).json({
          error: `Vous n'avez pas la permission de ${getPermissionLabel(permission)} ce fichier`,
        });
        return;
      }

      next();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ error: msg });
    }
  };
}

/**
 * Middleware Express pour vérifier les permissions sur un dossier
 */
export function requireFolderPermission(permission: Permission) {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user!.id;
      const folderId = req.params.folderId || req.params.id;

      if (!folderId) {
        res.status(400).json({ error: 'ID de dossier manquant' });
        return;
      }

      // Vérifier si l'utilisateur est propriétaire
      const folder = await prisma.folder.findUnique({
        where: { id: folderId },
      });

      if (!folder) {
        res.status(404).json({ error: 'Dossier non trouvé' });
        return;
      }

      // Si propriétaire, accès total
      if (folder.userId === userId) {
        next();
        return;
      }

      // Sinon, vérifier les permissions partagées
      const hasPermission = await checkSharedFolderPermission(userId, folderId, permission);

      if (!hasPermission) {
        res.status(403).json({
          error: `Vous n'avez pas la permission de ${getPermissionLabel(permission)} dans ce dossier`,
        });
        return;
      }

      next();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Internal server error';
      res.status(500).json({ error: msg });
    }
  };
}

/**
 * Récupère les permissions d'un utilisateur sur un dossier
 */
export async function getFolderPermissions(
  userId: string,
  folderId: string
): Promise<{
  isOwner: boolean;
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
  canShare: boolean;
}> {
  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
  });

  if (!folder) {
    throw new Error('Dossier non trouvé');
  }

  // Si propriétaire, tous les droits
  if (folder.userId === userId) {
    return {
      isOwner: true,
      canRead: true,
      canWrite: true,
      canDelete: true,
      canShare: true,
    };
  }

  // Sinon, récupérer les permissions partagées
  const sharedFolder = await prisma.sharedFolder.findFirst({
    where: {
      folderId,
      ...acceptedShareBaseWhere(userId),
    },
  });

  if (!sharedFolder) {
    return {
      isOwner: false,
      canRead: false,
      canWrite: false,
      canDelete: false,
      canShare: false,
    };
  }

  return {
    isOwner: false,
    canRead: sharedFolder.canRead,
    canWrite: sharedFolder.canWrite,
    canDelete: sharedFolder.canDelete,
    canShare: sharedFolder.canShare,
  };
}

function getPermissionLabel(permission: Permission): string {
  switch (permission) {
    case 'read':
      return 'consulter';
    case 'write':
      return 'modifier';
    case 'delete':
      return 'supprimer';
    case 'share':
      return 'partager';
    default:
      return 'accéder à';
  }
}
