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
    replaceFileId?: string
  ) {
    const isVault = await VaultService.isVaultFolder(userId, folderId || null);
    await VaultService.assertUnlockedIfVault(userId, isVault);

    const fileSizeAllowed = await PlanService.checkFileSize(userId, size);
    if (!fileSizeAllowed) {
      await deleteFile(storagePath);
      throw new Error('Fichier trop volumineux pour votre plan. Passez à un plan supérieur.');
    }

    const hasSpace = await PlanService.checkQuota(userId, size);
    if (!hasSpace) {
      await deleteFile(storagePath);
      throw new Error('Quota exceeded');
    }

    const targetFileId = replaceFileId;

    if (targetFileId) {
      // Replaces existing file content (creates a new version)
      const updatedFile = await this.replaceFileContent(
        targetFileId,
        userId,
        storagePath,
        name,
        size,
        mimeType,
        dek
      );
      // Clean up temporary file as replaceFileContent (via createVersion) uploads it to S3
      await deleteFile(storagePath).catch(() => undefined);
      return updatedFile;
    }

    const uniqueName = await getUniqueFileName(name, folderId, userId);
    const category = getCategoryFromMimeType(mimeType);

    // Chiffrer et uploader vers S3 avec le DEK utilisateur (ou clé globale en fallback)
    const s3Key = `files/${userId}/${path.basename(storagePath)}`;
    await EncryptionService.encryptFileToS3(storagePath, s3Key, dek);

    const file = await prisma.file.create({
      data: { name: uniqueName, originalName, mimeType, size: BigInt(size), storagePath: s3Key, userId, folderId, category, isVault },
      include: { folder: true },
    });

    await PlanService.updateQuotaUsed(userId, size);
    await AuditService.createLog(userId, 'UPLOAD', { fileName: uniqueName, fileId: file.id, folderId });

    SocketService.emitToUser(userId, 'file_uploaded', file);
    if (folderId) SocketService.emitToUser(userId, 'folder_updated', { folderId });

    FileIndexService.indexFileAsync(file.id, userId);

    return file;
  }

  static async replaceFileContent(
    fileId: string,
    userId: string,
    newFilePath: string,
    newFileName: string,
    newFileSize: number,
    newMimeType: string,
    dek?: Buffer
  ) {
    await VersionService.createVersion(fileId, userId, newFilePath, newFileName, newFileSize, newMimeType, dek);
    FileIndexService.indexFileAsync(fileId, userId);

    return prisma.file.findFirst({
      where: { id: fileId, userId, isDeleted: false },
      include: { folder: true, tags: { include: { tag: true } } },
    });
  }
}
