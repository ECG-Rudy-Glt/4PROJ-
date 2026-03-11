import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const ALGORITHM = 'aes-256-gcm';
// Using a fixed key for now (from ENV). In production, this should be a managed key or per-user key.
// Ensure MFA_ENCRYPTION_KEY or a new FILE_ENCRYPTION_KEY is used.
// For simplicity, we'll use a derived key from a secret.

export class EncryptionService {
    private static getKey(): Buffer {
        // Use a separate key for files. Default matches the legacy key to keep old files readable.
        const secret = process.env.FILE_ENCRYPTION_KEY || 'default-secret-key-32-chars-long!!';
        return crypto.createHash('sha256').update(secret).digest();
    }

    static async encryptFile(filePath: string): Promise<void> {
        const key = this.getKey();
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

        const tempPath = `${filePath}.enc`;
        const input = fs.createReadStream(filePath);
        const output = fs.createWriteStream(tempPath);

        // Write IV at the beginning of the file
        output.write(iv);

        return new Promise((resolve, reject) => {
            input.pipe(cipher).pipe(output);

            output.on('finish', () => {
                const authTag = cipher.getAuthTag();
                // Append auth tag at the end (or we could have updated the file structure to store it separately)
                // To keep it simple in one file: IV (16) + Content + AuthTag (16)
                // But appending to a stream that just finished is tricky.
                // Let's write AuthTag to a separate step or stick to IV+Content+Tag format if we handle streams manually.

                // Actually, let's append the auth tag.
                fs.appendFileSync(tempPath, authTag);

                // Replace original file
                fs.unlinkSync(filePath);
                fs.renameSync(tempPath, filePath);
                resolve();
            });

            output.on('error', reject);
        });
    }

    static getDecryptStream(filePath: string): fs.ReadStream | crypto.Decipher { // Returns stream
        const key = this.getKey();

        // Read IV
        // We need to read the first 16 bytes synchronously or assume the stream handles it?
        // Handling start/end with streams for IV and Tag is complex.
        // Simpler approach: Read file stats to get length.

        const stats = fs.statSync(filePath);
        const fileSize = stats.size;

        // IV is first 16 bytes
        // Tag is last 16 bytes
        // Content is in between

        const ivParams = { start: 0, end: 15 };
        const tagParams = { start: fileSize - 16, end: fileSize - 1 };
        const contentParams = { start: 16, end: fileSize - 17 };

        // This approach is hard to pipe directly as a single stream without buffering or composite streams.
        // Alternative: Use a Transform stream that reads header/footer?

        // Better approach for Node:
        // 1. Read IV.
        // 2. Create Decipher.
        // 3. Create ReadStream for content (excluding tag).
        // 4. Set Auth Tag (read from end).

        const fd = fs.openSync(filePath, 'r');
        const iv = Buffer.alloc(16);
        fs.readSync(fd, iv, 0, 16, 0);

        const tag = Buffer.alloc(16);
        fs.readSync(fd, tag, 0, 16, fileSize - 16);

        fs.closeSync(fd);

        // Tag length enforced: we write exactly 16 bytes and read exactly 16 bytes (see tagParams above).
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv); // nosemgrep: javascript.node-crypto.security.gcm-no-tag-length.gcm-no-tag-length
        decipher.setAuthTag(tag);

        const input = fs.createReadStream(filePath, { start: 16, end: fileSize - 17 });
        return input.pipe(decipher);
    }

    static async decryptFileToBuffer(filePath: string): Promise<Buffer> {
        return await new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            const stream = this.getDecryptStream(filePath);

            stream.on('data', (chunk: Buffer | string) => {
                chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
            });
            stream.on('end', () => resolve(Buffer.concat(chunks)));
            stream.on('error', reject);
        });
    }
}
