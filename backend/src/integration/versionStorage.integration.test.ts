import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { FileUploadService } from '../services/fileUploadService';
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

async function expectMissingLocalFile(filePath: string): Promise<void> {
  await expect(fs.access(filePath)).rejects.toMatchObject({ code: 'ENOENT' });
}

async function createOwnerS3File(content: Buffer, userId: string, filename = 'version-file.bin') {
  const tempPath = await writeTempUpload(content, filename);
  const file = await FileUploadService.createFile(
    userId,
    filename,
    filename,
    'application/octet-stream',
    content.length,
    tempPath
  );

  trackIntegrationObject(file.storagePath);
  await expectMissingLocalFile(tempPath);
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

  await expectMissingLocalFile(tempPath);
  return version;
}

async function userQuotaUsed(userId: string): Promise<bigint> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { quotaUsed: true },
  });
  return user?.quotaUsed ?? BigInt(-1);
}

describe('versioning S3 storage integration', () => {
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

  it('createVersion creates a new S3 key and stores the previous current key as FileVersion', async () => {
    const owner = await createIntegrationUser();
    const oldContent = Buffer.from('initial version content');
    const newContent = Buffer.from('replacement version content is larger');
    const file = await createOwnerS3File(oldContent, owner.id, 'create-initial.bin');
    const oldStoragePath = file.storagePath;

    const version = await createVersionFromContent(file.id, owner.id, newContent, 'create-v2.bin');
    const updatedFile = await prisma.file.findUnique({ where: { id: file.id } });
    const storedVersion = await prisma.fileVersion.findUnique({ where: { id: version.id } });

    expect(updatedFile).not.toBeNull();
    expect(storedVersion).not.toBeNull();

    trackIntegrationObject(updatedFile!.storagePath);

    expect(updatedFile!.storagePath).toMatch(new RegExp(`^versions/${file.id}/`));
    expect(updatedFile!.storagePath).not.toBe(oldStoragePath);
    expect(storedVersion!.storagePath).toBe(oldStoragePath);
    expect(updatedFile!.storagePath).not.toBe(storedVersion!.storagePath);
    expect(updatedFile!.size).toBe(BigInt(newContent.length));
    expect(storedVersion!.size).toBe(BigInt(oldContent.length));
    expect(await integrationObjectExists(updatedFile!.storagePath)).toBe(true);
    expect(await integrationObjectExists(oldStoragePath)).toBe(true);
    expect(await userQuotaUsed(owner.id)).toBe(BigInt(oldContent.length + newContent.length));
  });

  it('deleteVersion removes the version object and row while preserving the current object and quota', async () => {
    const owner = await createIntegrationUser();
    const oldContent = Buffer.from('delete old version content');
    const newContent = Buffer.from('delete current version content');
    const file = await createOwnerS3File(oldContent, owner.id, 'delete-initial.bin');

    const version = await createVersionFromContent(file.id, owner.id, newContent, 'delete-v2.bin');
    const currentFile = await prisma.file.findUnique({ where: { id: file.id } });
    const versionBeforeDelete = await prisma.fileVersion.findUnique({ where: { id: version.id } });

    expect(currentFile).not.toBeNull();
    expect(versionBeforeDelete).not.toBeNull();
    trackIntegrationObject(currentFile!.storagePath);

    await VersionService.deleteVersion(version.id, file.id, owner.id);

    expect(await integrationObjectExists(versionBeforeDelete!.storagePath)).toBe(false);
    expect(await prisma.fileVersion.findUnique({ where: { id: version.id } })).toBeNull();
    expect(await integrationObjectExists(currentFile!.storagePath)).toBe(true);
    expect(await userQuotaUsed(owner.id)).toBe(BigInt(newContent.length));
  });

  it('restoreVersion copies the target version, keeps the target object and creates a backup of the previous current object', async () => {
    const owner = await createIntegrationUser();
    const v1Content = Buffer.from('restore target v1');
    const v2Content = Buffer.from('restore current v2 content');
    const file = await createOwnerS3File(v1Content, owner.id, 'restore-initial.bin');

    const targetVersion = await createVersionFromContent(file.id, owner.id, v2Content, 'restore-v2.bin');
    const currentBeforeRestore = await prisma.file.findUnique({ where: { id: file.id } });
    const v1Path = targetVersion.storagePath;
    const v2Path = currentBeforeRestore!.storagePath;

    trackIntegrationObject(v2Path);

    await VersionService.restoreVersion(targetVersion.id, file.id, owner.id);

    const restoredFile = await prisma.file.findUnique({ where: { id: file.id } });
    const versions = await prisma.fileVersion.findMany({
      where: { fileId: file.id },
      orderBy: { versionNumber: 'asc' },
    });
    const v2Backup = versions.find((version) => version.storagePath === v2Path);

    expect(restoredFile).not.toBeNull();
    trackIntegrationObject(restoredFile!.storagePath);
    versions.forEach((version) => trackIntegrationObject(version.storagePath));

    expect(restoredFile!.storagePath).not.toBe(v1Path);
    expect(restoredFile!.storagePath).not.toBe(v2Path);
    expect(await integrationObjectExists(restoredFile!.storagePath)).toBe(true);
    expect(await integrationObjectExists(v1Path)).toBe(true);
    expect(await integrationObjectExists(v2Path)).toBe(true);
    expect(v2Backup).toBeDefined();
    expect(v2Backup!.size).toBe(BigInt(v2Content.length));
    expect(restoredFile!.size).toBe(BigInt(v1Content.length));
    expect(await userQuotaUsed(owner.id)).toBe(BigInt(v1Content.length + v2Content.length + v1Content.length));
  });
});
