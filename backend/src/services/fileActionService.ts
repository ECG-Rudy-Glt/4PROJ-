import prisma from '../config/database';
import { StorageService } from './storageService';
import { BrainService } from './brainService';
import { AuditService } from './auditService';
import { SocketService } from './socketService';
import { PlanService } from './planService';
import { VaultService } from './vaultService';

export class FileActionService {
  static async updateFile(fileId: string, userId: string, data: { name?: string }) {
    const file = await prisma.file.findFirst({ where: { id: fileId, userId, isDeleted: false } });
    if (!file) throw new Error('File not found');
    await VaultService.assertUnlockedIfVault(userId, file.isVault);

    const updatedFile = await prisma.file.update({ where: { id: fileId }, data });

    if (data.name && data.name !== file.name) {
      await AuditService.createLog(userId, 'RENAME_FILE', { fileName: data.name, fileId: file.id, oldName: file.name });
      SocketService.emitToUser(userId, 'file_updated', updatedFile);
    }

    return updatedFile;
  }

  static async moveFile(fileId: string, userId: string, targetFolderId?: string) {
    const file = await prisma.file.findFirst({ where: { id: fileId, userId, isDeleted: false } });
    if (!file) throw new Error('File not found');
    await VaultService.assertUnlockedIfVault(userId, file.isVault);

    if (targetFolderId) {
      const targetFolder = await prisma.folder.findFirst({ where: { id: targetFolderId, userId } });
      if (!targetFolder) throw new Error('Target folder not found');
      await VaultService.assertUnlockedIfVault(userId, targetFolder.isVault);
      if (targetFolder.isVault !== file.isVault) throw new Error('Déplacement entre espace normal et coffre-fort interdit');
    } else if (file.isVault) {
      throw new Error('Impossible de déplacer un fichier coffre-fort vers la racine standard');
    }

    const movedFile = await prisma.file.update({
      where: { id: fileId },
      data: { folderId: targetFolderId || null },
    });

    await AuditService.createLog(userId, 'MOVE_FILE', { fileName: file.name, fileId: file.id, folderId: targetFolderId });
    return movedFile;
  }

  static async deleteFile(fileId: string, userId: string, permanent = false) {
    const file = await prisma.file.findFirst({ where: { id: fileId, userId } });
    if (!file) throw new Error('File not found');

    if (permanent || file.isDeleted) {
      await StorageService.deleteStorageFile(file.storagePath);
      // Supprimer les embeddings ChromaDB (best-effort — non bloquant)
      BrainService.deleteFile(fileId).catch(() => undefined);
      await prisma.file.delete({ where: { id: fileId } });
      await PlanService.updateQuotaUsed(userId, -Number(file.size));
    } else {
      await prisma.file.update({ where: { id: fileId }, data: { isDeleted: true, deletedAt: new Date() } });
    }

    await AuditService.createLog(userId, 'DELETE', { fileName: file.name, fileId: file.id, permanent });
    SocketService.emitToUser(userId, 'file_deleted', { fileId });

    return { message: 'File deleted successfully' };
  }

  static async restoreFile(fileId: string, userId: string) {
    const file = await prisma.file.findFirst({ where: { id: fileId, userId, isDeleted: true } });
    if (!file) throw new Error('File not found in trash');
    await VaultService.assertUnlockedIfVault(userId, file.isVault);

    const restoredFile = await prisma.file.update({
      where: { id: fileId },
      data: { isDeleted: false, deletedAt: null },
    });

    await AuditService.createLog(userId, 'RESTORE', { fileName: file.name, fileId: file.id });
    return restoredFile;
  }

  static async toggleFavorite(fileId: string, userId: string) {
    const file = await prisma.file.findFirst({ where: { id: fileId, userId, isDeleted: false } });
    if (!file) throw new Error('Fichier introuvable');
    await VaultService.assertUnlockedIfVault(userId, file.isVault);

    return prisma.file.update({
      where: { id: fileId },
      data: { isFavorite: !file.isFavorite },
      include: { folder: true },
    });
  }

  static async incrementViewCount(fileId: string) {
    await prisma.file.update({
      where: { id: fileId },
      data: { views: { increment: 1 }, lastAccessedAt: new Date() },
    });
  }

  static async incrementDownloadCount(fileId: string) {
    await prisma.file.update({
      where: { id: fileId },
      data: { downloads: { increment: 1 }, lastAccessedAt: new Date() },
    });
  }
}
