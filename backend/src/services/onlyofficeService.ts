import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { File } from '@prisma/client';
import { VersionService } from './versionService';
import logger from '../config/logger';
import { getOnlyOfficeJwtSecret } from '../config/secrets';

// URL interne Docker pour la communication backend -> OnlyOffice
const ONLYOFFICE_INTERNAL_URL = process.env.ONLYOFFICE_URL || 'http://onlyoffice:80';
// URL publique accessible depuis le navigateur
const ONLYOFFICE_PUBLIC_URL = process.env.ONLYOFFICE_PUBLIC_URL || 'http://localhost:8080';
// URL interne de l'API pour le callback OnlyOffice -> Backend (dans Docker)
const API_INTERNAL_URL = process.env.API_INTERNAL_URL || 'http://backend:5001';
const ONLYOFFICE_SESSION_TTL_MS = 2 * 60 * 60 * 1000;

type OnlyOfficeSession = {
  fileId: string;
  userId: string;
  wrappedDek?: string;
  mode: 'view' | 'edit';
  expiresAt: number;
};

type CallbackResult = {
  error: number;
  shouldSave?: boolean;
  downloadUrl?: string;
};

function allowedOnlyOfficeOrigins(): Set<string> {
  return new Set([
    new URL(ONLYOFFICE_INTERNAL_URL).origin,
    new URL(ONLYOFFICE_PUBLIC_URL).origin,
  ]);
}

export class OnlyOfficeService {
  private static sessions = new Map<string, OnlyOfficeSession>();

  private static cleanupExpiredSessions(): void {
    const now = Date.now();
    for (const [token, session] of this.sessions.entries()) {
      if (session.expiresAt <= now) {
        this.sessions.delete(token);
      }
    }
  }

  private static createSession(
    fileId: string,
    userId: string,
    wrappedDek: string | undefined,
    mode: 'view' | 'edit'
  ): string {
    this.cleanupExpiredSessions();
    const token = crypto.randomBytes(32).toString('base64url');
    this.sessions.set(token, {
      fileId,
      userId,
      wrappedDek,
      mode,
      expiresAt: Date.now() + ONLYOFFICE_SESSION_TTL_MS,
    });
    return token;
  }

  private static getSession(token: string | undefined): OnlyOfficeSession | null {
    if (!token) return null;

    this.cleanupExpiredSessions();
    const session = this.sessions.get(token);
    if (!session || session.expiresAt <= Date.now()) {
      if (token) this.sessions.delete(token);
      return null;
    }

    return session;
  }

  /**
   * Genere un token opaque temporaire pour un fichier OnlyOffice.
   * Il ne contient plus de userId ni de wrappedDek decodable dans l'URL.
   */
  static generateFileAccessToken(
    fileId: string,
    userId: string,
    wrappedDek?: string,
    mode: 'view' | 'edit' = 'view'
  ): string {
    return this.createSession(fileId, userId, wrappedDek, mode);
  }

  /**
   * Verifie un token d'acces fichier opaque.
   */
  static verifyFileAccessToken(token: string): { fileId: string; userId: string; wrappedDek?: string } | null {
    const session = this.getSession(token);
    return session
      ? { fileId: session.fileId, userId: session.userId, wrappedDek: session.wrappedDek }
      : null;
  }

  static verifyCallbackToken(token: string | undefined): { fileId: string; userId: string; wrappedDek?: string } | null {
    const session = this.getSession(token);
    return session && session.mode === 'edit'
      ? { fileId: session.fileId, userId: session.userId, wrappedDek: session.wrappedDek }
      : null;
  }

  static verifyCallbackRequest(callbackData: any, authorizationHeader?: string): boolean {
    const bearerToken = authorizationHeader?.startsWith('Bearer ')
      ? authorizationHeader.substring(7)
      : undefined;
    const callbackToken = typeof callbackData?.token === 'string' ? callbackData.token : undefined;
    const token = bearerToken || callbackToken;

    if (!token) return false;

    try {
      jwt.verify(token, getOnlyOfficeJwtSecret());
      return true;
    } catch {
      return false;
    }
  }

  static assertSafeDownloadUrl(downloadUrl: string): string {
    const parsed = new URL(downloadUrl);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('OnlyOffice download URL protocol is not allowed');
    }

    if (!allowedOnlyOfficeOrigins().has(parsed.origin)) {
      throw new Error('OnlyOffice download URL origin is not allowed');
    }

    return parsed.toString();
  }

  /**
   * Détermine si un fichier peut être édité dans OnlyOffice
   */
  static canEdit(mimeType: string): boolean {
    const editableMimeTypes = [
      // Word
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/msword', // .doc
      'application/vnd.oasis.opendocument.text', // .odt

      // Excel
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/vnd.oasis.opendocument.spreadsheet', // .ods

      // PowerPoint
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'application/vnd.ms-powerpoint', // .ppt
      'application/vnd.oasis.opendocument.presentation', // .odp

      // Text
      'text/plain', // .txt
    ];

    return editableMimeTypes.includes(mimeType);
  }

  /**
   * Obtient le type de document pour OnlyOffice
   */
  static getDocumentType(mimeType: string): string {
    // Vérifier d'abord les types spécifiques (avant 'document' qui est trop général)
    if (mimeType.includes('spreadsheet') || mimeType.includes('sheet') || mimeType.includes('excel')) {
      return 'cell';
    }
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint') || mimeType.includes('slide')) {
      return 'slide';
    }
    if (mimeType.includes('word') || mimeType.includes('text') || mimeType.includes('wordprocessing')) {
      return 'word';
    }
    return 'word'; // default
  }

  /**
   * Génère la configuration OnlyOffice pour un fichier
   */
  static async generateConfig(
    file: File,
    userId: string,
    user: { email: string; firstName?: string | null; lastName?: string | null },
    mode: 'view' | 'edit' = 'edit',
    wrappedDek?: string
  ) {
    const fileExtension = file.name.split('.').pop() || '';
    const documentType = this.getDocumentType(file.mimeType);
    const sessionToken = this.generateFileAccessToken(file.id, userId, wrappedDek, mode);

    // URLs internes appelees par OnlyOffice. Le token est opaque et redige dans les logs.
    const fileUrl = `${API_INTERNAL_URL}/api/onlyoffice/file/${file.id}/${sessionToken}`;
    const callbackUrl = `${API_INTERNAL_URL}/api/onlyoffice/callback/${file.id}/${sessionToken}`;

    const config: any = {
      document: {
        fileType: fileExtension,
        key: `${file.id}_${file.updatedAt.getTime()}`, // Version unique du document
        title: file.name,
        url: fileUrl,
        permissions: {
          comment: mode === 'edit',
          download: true,
          edit: mode === 'edit',
          fillForms: mode === 'edit',
          modifyFilter: mode === 'edit',
          modifyContentControl: mode === 'edit',
          review: mode === 'edit',
          print: true,
        },
      },
      documentType,
      editorConfig: {
        mode,
        lang: 'fr',
        user: {
          id: userId,
          name: user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`
            : user.email,
        },
        customization: {
          autosave: mode === 'edit',
          forcesave: mode === 'edit',
          comments: mode === 'edit',
          compactHeader: true,
          help: true,
          hideRightMenu: mode === 'view',
          plugins: mode === 'edit',
        },
      },
      type: 'desktop',
    };

    if (mode === 'edit') {
      config.editorConfig.callbackUrl = callbackUrl;
    }

    const token = jwt.sign(config, getOnlyOfficeJwtSecret(), { expiresIn: '1h' });

    return {
      config,
      token,
      onlyofficeUrl: `${ONLYOFFICE_PUBLIC_URL}/web-apps/apps/api/documents/api.js`,
    };
  }

  /**
   * Traite le callback d'OnlyOffice après une édition
   */
  static async processCallback(fileId: string, callbackData: any): Promise<CallbackResult> {
    const { status, url, users, key } = callbackData;

    // Status codes from OnlyOffice:
    // 0 - No document with the key identifier could be found
    // 1 - Document is being edited
    // 2 - Document is ready for saving
    // 3 - Document saving error has occurred
    // 4 - Document is closed with no changes
    // 6 - Document is being edited, but the current document state is saved
    // 7 - Error has occurred while force saving the document

    if (status === 2 || status === 6) {
      return {
        error: 0,
        shouldSave: true,
        downloadUrl: url,
      };
    }

    if (status === 1 || status === 4) {
      return { error: 0 };
    }

    if (status === 3 || status === 7) {
      logger.error(
        { fileId, status, key, usersCount: Array.isArray(users) ? users.length : undefined },
        'OnlyOffice callback error'
      );
      return { error: 1 };
    }

    return { error: 0 };
  }

  /**
   * Crée une nouvelle version du fichier
   */
  static async createFileVersion(
    fileId: string,
    userId: string,
    storagePath: string,
    fileName: string,
    size: number,
    mimeType: string,
    dek?: Buffer
  ) {
    await VersionService.createVersion(
      fileId,
      userId,
      storagePath,
      fileName,
      size,
      mimeType,
      dek
    );
  }
}
