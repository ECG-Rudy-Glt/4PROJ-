import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { Readable } from 'stream';
import fs from 'fs';
import { deleteFile } from '../utils/fileUtils';

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT!,
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY_ID!,
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
  },
  forcePathStyle: true, // Obligatoire pour MinIO (path-style: /{bucket}/{key})
});

const BUCKET = process.env.S3_BUCKET || 'supfile-uploads';

export class StorageService {
  /**
   * Détecte si un chemin est une clé S3 (format "files/…", "versions/…", "thumbnails/…")
   * plutôt qu'un chemin disque local.
   */
  static isS3Key(path: string): boolean {
    return (
      path.startsWith('files/') ||
      path.startsWith('versions/') ||
      path.startsWith('thumbnails/')
    );
  }

  /**
   * Upload depuis un Readable stream (multipart automatique pour les gros fichiers).
   */
  static async upload(key: string, stream: Readable): Promise<void> {
    const upload = new Upload({
      client: s3Client,
      params: { Bucket: BUCKET, Key: key, Body: stream },
      queueSize: 4,
      partSize: 8 * 1024 * 1024, // 8 MB par part
    });
    await upload.done();
  }

  /**
   * Upload depuis un fichier local (stream vers S3).
   */
  static async uploadFromFile(key: string, filePath: string): Promise<void> {
    const stream = fs.createReadStream(filePath);
    await this.upload(key, stream);
  }

  /**
   * Taille de l'objet S3 en octets (HEAD request).
   */
  static async getObjectSize(key: string): Promise<number> {
    const response = await s3Client.send(
      new HeadObjectCommand({ Bucket: BUCKET, Key: key })
    );
    return response.ContentLength ?? 0;
  }

  /**
   * Stream d'un objet S3, avec support optionnel des ranged GETs.
   */
  static async getStream(
    key: string,
    range?: { start: number; end: number }
  ): Promise<Readable> {
    const params: { Bucket: string; Key: string; Range?: string } = {
      Bucket: BUCKET,
      Key: key,
    };
    if (range) {
      params.Range = `bytes=${range.start}-${range.end}`;
    }
    const response = await s3Client.send(new GetObjectCommand(params));
    return response.Body as Readable;
  }

  /**
   * Buffer d'un objet S3 (ou d'une plage de bytes).
   */
  static async getBuffer(
    key: string,
    range?: { start: number; end: number }
  ): Promise<Buffer> {
    const stream = await this.getStream(key, range);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  /**
   * Suppression d'un objet S3.
   */
  static async delete(key: string): Promise<void> {
    await s3Client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  }

  /**
   * Copie d'un objet S3 (utilisé pour les versions de fichiers).
   */
  static async copy(sourceKey: string, destKey: string): Promise<void> {
    await s3Client.send(
      new CopyObjectCommand({
        Bucket: BUCKET,
        CopySource: `${BUCKET}/${sourceKey}`,
        Key: destKey,
      })
    );
  }

  /**
   * Suppression unifiée : détecte automatiquement clé S3 ou chemin local.
   * Remplace deleteFile() pour tous les fichiers de l'application.
   */
  static async deleteStorageFile(pathOrKey: string): Promise<void> {
    if (this.isS3Key(pathOrKey)) {
      await this.delete(pathOrKey);
    } else {
      await deleteFile(pathOrKey);
    }
  }
}
