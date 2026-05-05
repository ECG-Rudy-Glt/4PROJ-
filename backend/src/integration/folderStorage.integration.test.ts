import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { FileUploadService } from '../services/fileUploadService';
import { FolderService } from '../services/folderService';
import { VersionService } from '../services/versionService';
import {
  cleanIntegrationDb,
  createIntegrationUser,
  disconnectIntegrationDb,
  prisma,
} from '../test/integrationDb';
import {
  cleanupIntegrationStorage,
  integrationObjectExists,
  putIntegrationObject,
  trackIntegrationObject,
} from '../test/integrationStorage';

const tempFiles = new Set<string>();

async function writeTempUpload(content: Buffer, filename: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'supfile-itest-'));
  const filePath = path.join(dir, filename);
  await fs.writeFile(filePath, content);
  tempFiles.add(filePath);
  return filePath;
}

async function cleanupTempFiles(): Promise<void> {
  await Promise.all([...tempFiles].map(async (filePath) => {
    await fs.rm(path.dirname(filePath), { recursive: true, force: true });
    tempFiles.delete(filePath);
  }));
}

async function createFolder(userId: string, name = 'folder') {
  return prisma.folder.create({
    data: {
      name,
      path: `/${name}`,
      userId,
    },
  });
}

async function createOwnerS3File(content: Buffer, userId: string, folderId: string, filename = 'folder-file.bin') {
  const tempPath = await writeTempUpload(content, filename);
  const file = await FileUploadService.createFile(
    userId,
    filename,
    filename,
    'application/octet-stream',
    content.length,
    tempPath,
    folderId
  );

  trackIntegrationObject(file.storagePath);
  return file;
}

async function createVersionFromContent(fileId: string, userId: string, content: Buffer, filename: string) {
  const tempPath = await writeTempUpload(content, filename);
  const version = await VersionService.createVersion(
    fileId,
    userId,
    tempPath,
    filename,
    content.length,
    'application/octet-stream'
  );

  return version;
}

async function userQuotaUsed(userId: string): Promise<bigint> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { quotaUsed: true },
  });
  return user?.quotaUsed ?? BigInt(-1);
}

describe('folder permanent delete S3 integration', () => {
  beforeEach(async () => {
    await cleanIntegrationDb();
  });

  afterEach(async () => {
    await cleanupIntegrationStorage();
    await cleanupTempFiles();
    await cleanIntegrationDb();
  });

  afterAll(async () => {
    await cleanupIntegrationStorage();
    await cleanupTempFiles();
    await disconnectIntegrationDb();
  });

  it('permanently deletes a folder current S3 file, DB rows and decrements quota', async () => {
    const owner = await createIntegrationUser();
    const folder = await createFolder(owner.id, 'simple-folder');
    const content = Buffer.from('folder permanent delete content');
    const file = await createOwnerS3File(content, owner.id, folder.id, 'simple-file.bin');

    expect(await prisma.file.findUnique({ where: { id: file.id } })).not.toBeNull();
    expect(await integrationObjectExists(file.storagePath)).toBe(true);
    expect(await userQuotaUsed(owner.id)).toBe(BigInt(content.length));

    await FolderService.deleteFolder(folder.id, owner.id, true);

    expect(await integrationObjectExists(file.storagePath)).toBe(false);
    expect(await prisma.file.findUnique({ where: { id: file.id } })).toBeNull();
    expect(await prisma.folder.findUnique({ where: { id: folder.id } })).toBeNull();
    expect(await userQuotaUsed(owner.id)).toBe(BigInt(0));
  });

  it('permanently deletes a folder current S3 file and thumbnail object', async () => {
    const owner = await createIntegrationUser();
    const folder = await createFolder(owner.id, 'thumbnail-folder');
    const content = Buffer.from('folder thumbnail content');
    const file = await createOwnerS3File(content, owner.id, folder.id, 'thumbnail-file.bin');
    const thumbnailPath = `thumbnails/${owner.id}/folder-thumb.webp`;

    await putIntegrationObject(thumbnailPath, Buffer.from('fake thumbnail bytes'));
    await prisma.file.update({
      where: { id: file.id },
      data: { thumbnailPath },
    });

    expect(await integrationObjectExists(file.storagePath)).toBe(true);
    expect(await integrationObjectExists(thumbnailPath)).toBe(true);

    await FolderService.deleteFolder(folder.id, owner.id, true);

    expect(await integrationObjectExists(file.storagePath)).toBe(false);
    expect(await integrationObjectExists(thumbnailPath)).toBe(false);
    expect(await prisma.file.findUnique({ where: { id: file.id } })).toBeNull();
    expect(await prisma.folder.findUnique({ where: { id: folder.id } })).toBeNull();
    expect(await userQuotaUsed(owner.id)).toBe(BigInt(0));
  });

  it('documents current gap: permanent folder delete leaves version S3 objects orphaned', async () => {
    const owner = await createIntegrationUser();
    const folder = await createFolder(owner.id, 'versioned-folder');
    const v1Content = Buffer.from('folder version v1');
    const v2Content = Buffer.from('folder version current v2');
    const file = await createOwnerS3File(v1Content, owner.id, folder.id, 'versioned-v1.bin');
    const v1Path = file.storagePath;

    const version = await createVersionFromContent(file.id, owner.id, v2Content, 'versioned-v2.bin');
    const currentFile = await prisma.file.findUnique({ where: { id: file.id } });
    const versionBeforeDelete = await prisma.fileVersion.findUnique({ where: { id: version.id } });

    expect(currentFile).not.toBeNull();
    expect(versionBeforeDelete).not.toBeNull();

    const currentPath = currentFile!.storagePath;
    const versionPath = versionBeforeDelete!.storagePath;
    trackIntegrationObject(currentPath);
    trackIntegrationObject(versionPath);

    expect(versionPath).toBe(v1Path);
    expect(await integrationObjectExists(currentPath)).toBe(true);
    expect(await integrationObjectExists(versionPath)).toBe(true);
    expect(await userQuotaUsed(owner.id)).toBe(BigInt(v1Content.length + v2Content.length));

    await FolderService.deleteFolder(folder.id, owner.id, true);

    expect(await prisma.file.findUnique({ where: { id: file.id } })).toBeNull();
    expect(await prisma.fileVersion.findUnique({ where: { id: version.id } })).toBeNull();
    expect(await integrationObjectExists(currentPath)).toBe(false);
    expect(await integrationObjectExists(versionPath)).toBe(true);
    expect(await userQuotaUsed(owner.id)).toBe(BigInt(v1Content.length));
  });
});
