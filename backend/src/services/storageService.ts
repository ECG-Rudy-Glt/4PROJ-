import {
  S3Client,
  GetObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { Readable } from 'stream';
import fs from 'fs';
import { deleteFile } from '../utils/fileUtils';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[StorageService] Variable d'environnement manquante : ${name}. ` +
      'Vérifiez votre fichier .env avant de démarrer le backend.',
    );
  }
  return value;
}

const s3Client = new S3Client({
  endpoint: requireEnv('S3_ENDPOINT'),
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: requireEnv('S3_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('S3_SECRET_ACCESS_KEY'),
  },
  forcePathStyle: true, // Obligatoire pour MinIO (path-style: /{bucket}/{key})
  // Timeouts pour éviter les connexions keep-alive stales avec MinIO
  requestHandler: new NodeHttpHandler({
    connectionTimeout: 5_000,   // 5s pour établir la connexion
    socketTimeout: 600_000,     // 10 min — nécessaire pour les gros fichiers (vidéos)
  }),
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
   * Upload depuis un Readable stream vers S3 via PutObject.
   * Le multipart upload de @aws-sdk/lib-storage est incompatible avec cette version de MinIO
   * (bug XML : &#xD; mal parsé dans la réponse CreateMultipartUpload).
   * contentLength est obligatoire pour que MinIO accepte le stream sans le bufferiser entier.
   */
  static async upload(key: string, stream: Readable, contentLength?: number): Promise<void> {
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: stream,
      ...(contentLength !== undefined ? { ContentLength: contentLength } : {}),
    }));
  }

  /**
   * Upload depuis un fichier local (stream vers S3).
   */
  static async uploadFromFile(key: string, filePath: string): Promise<void> {
    const stat = fs.statSync(filePath);
    const stream = fs.createReadStream(filePath);
    await this.upload(key, stream, stat.size);
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
   * Encode une clé S3 pour l'utiliser dans CopySource, en conservant les
   * séparateurs de chemin `/`.
   */
  private static encodeCopySourceKey(key: string): string {
    return key.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  }

  /**
   * Copie d'un objet S3 (utilisé pour les versions de fichiers).
   */
  static async copy(sourceKey: string, destKey: string): Promise<void> {
    const encodedSourceKey = this.encodeCopySourceKey(sourceKey);
    await s3Client.send(
      new CopyObjectCommand({
        Bucket: BUCKET,
        CopySource: `${BUCKET}/${encodedSourceKey}`,
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
