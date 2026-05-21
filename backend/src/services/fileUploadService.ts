import path from 'path';
import prisma from '../config/database';
import { deleteFile } from '../utils/fileUtils';

import { VersionService } from './versionService';
import { AuditService } from './auditService';
import { SocketService } from './socketService';
import { EncryptionService } from './encryptionService';
import { PlanService } from './planService';
import { VaultService } from './vaultService';
import { FileIndexService } from './fileIndexService';
import { findSharedFolderAccessRoot } from '../middlewares/permissions';
import { ShareKeyService } from './shareKeyService';
import { DEK_UNLOCK_REQUIRED } from '../utils/dekGuard';

function getCategoryFromMimeType(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (
    mimeType.includes('pdf') ||
    mimeType.includes('document') ||
    mimeType.includes('word') ||
    mimeType.includes('excel') ||
    mimeType.includes('spreadsheet') ||
    mimeType.includes('presentation') ||
    mimeType.includes('powerpoint') ||
    mimeType.includes('text/')
  ) return 'doc';
  return 'other';
}

async function getUniqueFileName(name: string, folderId: string | undefined, userId: string): Promise<string> {
  const lastDotIndex = name.lastIndexOf('.');
  const baseName = lastDotIndex > 0 ? name.substring(0, lastDotIndex) : name;
  const extension = lastDotIndex > 0 ? name.substring(lastDotIndex) : '';

  const exists = await prisma.file.findFirst({
    where: { userId, folderId: folderId || null, isDeleted: false, name },
    select: { id: true },
  });

  if (!exists) return name;
  return `${baseName} (${Date.now().toString(36)})${extension}`;
}

async function resolveUploadTarget(userId: string, folderId?: string, requestDek?: Buffer) {
  if (!folderId) {
    return {
      ownerId: userId,
      encryptionDek: requestDek,
      isVault: false,
    };
  }

  const folder = await prisma.folder.findUnique({
    where: { id: folderId },
    select: { id: true, userId: true, isDeleted: true },
  });

  if (!folder || folder.isDeleted) {
    throw new Error('Dossier introuvable');
  }

  if (folder.userId === userId) {
    const isVault = await VaultService.isVaultFolder(userId, folderId);
    await VaultService.assertUnlockedIfVault(userId, isVault);
    return {
      ownerId: userId,
      encryptionDek: requestDek,
      isVault,
    };
  }

  const folderShare = await findSharedFolderAccessRoot(userId, folderId, 'write');
  if (!folderShare) {
    throw new Error("Vous n'avez pas la permission d'écrire dans ce dossier");
  }

  const ownerDek = ShareKeyService.unwrapOwnerDek(folderShare.ownerWrappedDek);
  if (!ownerDek) {
    throw new Error(DEK_UNLOCK_REQUIRED);
  }

  return {
    ownerId: folder.userId,
    encryptionDek: ownerDek,
    isVault: false,
  };
}

export class FileUploadService {
  static async createFiles(userId: string, files: Express.Multer.File[], folderId?: string, dek?: Buffer, replaceFileId?: string) {
    const createdFiles: any[] = [];
    const errors: Array<{ fileName: string; error: string }> = [];

    for (const uploadedFile of files) {
      const originalName = Buffer.from(uploadedFile.originalname, 'latin1').toString('utf8');
      try {
        const createdFile = await this.createFile(
          userId,
          originalName,
          originalName,
          uploadedFile.mimetype,
          uploadedFile.size,
          uploadedFile.path,
          folderId,
          dek,
          replaceFileId
        );
        createdFiles.push(createdFile);
      } catch (error) {
        // Nettoyer le fichier temporaire local si l'upload S3 a échoué avant
        await deleteFile(uploadedFile.path).catch(() => undefined);
        const msg = error instanceof Error ? error.message : 'Upload failed';
        errors.push({ fileName: originalName, error: msg });
      }
    }

    return { files: createdFiles, errors };
  }

  static async createFile(
    userId: string,
    name: string,
    originalName: string,
    mimeType: string,
    size: number,
    storagePath: string,
    folderId?: string,
    dek?: Buffer,
    replaceFileId?: string,
    checksum?: string
  ) {
    const targetFileId = replaceFileId;

    if (targetFileId) {
      const targetFile = await prisma.file.findUnique({
        where: { id: targetFileId },
        select: { userId: true, isDeleted: true },
      });
      if (!targetFile || targetFile.isDeleted) {
        await deleteFile(storagePath);
        throw new Error('Fichier introuvable');
      }

      const fileSizeAllowed = await PlanService.checkFileSize(targetFile.userId, size);
      if (!fileSizeAllowed) {
        await deleteFile(storagePath);
        throw new Error('Fichier trop volumineux pour votre plan. Passez à un plan supérieur.');
      }

      try {
        // Replaces existing file content (creates a new version)
        return checksum
          ? await this.replaceFileContent(
            targetFileId,
            userId,
            storagePath,
            name,
            size,
            mimeType,
            dek,
            checksum
          )
          : await this.replaceFileContent(
            targetFileId,
            userId,
            storagePath,
            name,
            size,
            mimeType,
            dek
          );
      } finally {
        // Clean up temporary file as replaceFileContent (via createVersion) uploads it to S3
        await deleteFile(storagePath).catch(() => undefined);
      }
    }

    const uploadTarget = await resolveUploadTarget(userId, folderId, dek);

    const fileSizeAllowed = await PlanService.checkFileSize(uploadTarget.ownerId, size);
    if (!fileSizeAllowed) {
      await deleteFile(storagePath);
      throw new Error('Fichier trop volumineux pour votre plan. Passez à un plan supérieur.');
    }

    const hasSpace = await PlanService.checkQuota(uploadTarget.ownerId, size);
    if (!hasSpace) {
      await deleteFile(storagePath);
      throw new Error('Quota exceeded');
    }

    const uniqueName = await getUniqueFileName(name, folderId, uploadTarget.ownerId);
    const category = getCategoryFromMimeType(mimeType);

    // In a shared folder, files are owned and encrypted with the folder owner's DEK.
    const s3Key = `files/${uploadTarget.ownerId}/${path.basename(storagePath)}`;
    await EncryptionService.encryptFileToS3(storagePath, s3Key, uploadTarget.encryptionDek);

    const file = await prisma.file.create({
      data: {
        name: uniqueName,
        originalName,
        mimeType,
        size: BigInt(size),
        checksum,
        storagePath: s3Key,
        userId: uploadTarget.ownerId,
        folderId,
        category,
        isVault: uploadTarget.isVault,
      },
      include: { folder: true },
    });

    await PlanService.updateQuotaUsed(uploadTarget.ownerId, size);
    await AuditService.createLog(userId, 'UPLOAD', {
      fileName: uniqueName,
      fileId: file.id,
      folderId,
      ownerId: uploadTarget.ownerId,
    });

    SocketService.emitToUser(userId, 'file_uploaded', file);
    if (uploadTarget.ownerId !== userId) SocketService.emitToUser(uploadTarget.ownerId, 'file_uploaded', file);
    if (folderId) SocketService.emitToUser(userId, 'folder_updated', { folderId });

    FileIndexService.indexFileAsync(file.id, uploadTarget.ownerId, uploadTarget.encryptionDek);

    return file;
  }

  static async replaceFileContent(
    fileId: string,
    userId: string,
    newFilePath: string,
    newFileName: string,
    newFileSize: number,
    newMimeType: string,
    dek?: Buffer,
    checksum?: string
  ) {
    if (checksum) {
      await VersionService.createVersion(fileId, userId, newFilePath, newFileName, newFileSize, newMimeType, dek, checksum);
    } else {
      await VersionService.createVersion(fileId, userId, newFilePath, newFileName, newFileSize, newMimeType, dek);
    }
    FileIndexService.indexFileAsync(fileId, userId, dek);

    return prisma.file.findUnique({
      where: { id: fileId },
      include: { folder: true, tags: { include: { tag: true } } },
    });
  }
}
