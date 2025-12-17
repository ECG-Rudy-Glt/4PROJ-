import jwt from 'jsonwebtoken';
import { File } from '@prisma/client';
import prisma from '../config/database';

// URL interne Docker pour la communication backend -> OnlyOffice
const ONLYOFFICE_INTERNAL_URL = process.env.ONLYOFFICE_URL || 'http://onlyoffice:80';
// URL publique accessible depuis le navigateur
const ONLYOFFICE_PUBLIC_URL = process.env.ONLYOFFICE_PUBLIC_URL || 'http://localhost:8080';
const ONLYOFFICE_JWT_SECRET = process.env.ONLYOFFICE_JWT_SECRET || 'your-secret-key-change-in-production';
// URL publique de l'API accessible depuis le navigateur et depuis OnlyOffice
const API_URL = process.env.API_URL || 'http://localhost:5001';
// URL interne de l'API pour le callback OnlyOffice -> Backend (dans Docker)
const API_INTERNAL_URL = process.env.API_INTERNAL_URL || 'http://backend:5001';
// Secret pour les tokens d'accès fichier OnlyOffice
const FILE_ACCESS_SECRET = process.env.JWT_SECRET || 'your-secret-key';

export class OnlyOfficeService {
  /**
   * Génère un token d'accès temporaire pour un fichier (pour OnlyOffice)
   */
  static generateFileAccessToken(fileId: string, userId: string): string {
    return jwt.sign(
      { fileId, userId, purpose: 'onlyoffice-access' },
      FILE_ACCESS_SECRET,
      { expiresIn: '2h' }
    );
  }

  /**
   * Vérifie un token d'accès fichier
   */
  static verifyFileAccessToken(token: string): { fileId: string; userId: string } | null {
    try {
      const decoded = jwt.verify(token, FILE_ACCESS_SECRET) as any;
      if (decoded.purpose === 'onlyoffice-access') {
        return { fileId: decoded.fileId, userId: decoded.userId };
      }
      return null;
    } catch {
      return null;
    }
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
    user: { email: string; firstName?: string; lastName?: string },
    mode: 'view' | 'edit' = 'edit'
  ) {
    const fileExtension = file.name.split('.').pop() || '';
    const documentType = this.getDocumentType(file.mimeType);

    // Générer un token d'accès temporaire pour le fichier
    const fileAccessToken = this.generateFileAccessToken(file.id, userId);

    // URL pour télécharger le fichier - avec token d'accès pour OnlyOffice
    const fileUrl = `${API_INTERNAL_URL}/api/onlyoffice/file/${file.id}?access_token=${fileAccessToken}`;

    // URL de callback pour sauvegarder les modifications - OnlyOffice appelle le backend en interne
    const callbackUrl = `${API_INTERNAL_URL}/api/onlyoffice/callback/${file.id}`;

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
        mode: mode,
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

    // Ajouter le callback uniquement en mode edit
    if (mode === 'edit') {
      config.editorConfig.callbackUrl = callbackUrl;
    }

    // Signer la configuration avec JWT
    const token = jwt.sign(config, ONLYOFFICE_JWT_SECRET, { expiresIn: '1h' });

    return {
      config,
      token,
      // URL publique pour le navigateur (pas l'URL interne Docker)
      onlyofficeUrl: `${ONLYOFFICE_PUBLIC_URL}/web-apps/apps/api/documents/api.js`,
    };
  }

  /**
   * Traite le callback d'OnlyOffice après une édition
   */
  static async processCallback(fileId: string, callbackData: any) {
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
      // Document is ready to be saved
      // Télécharger le fichier modifié depuis l'URL fournie
      return {
        error: 0,
        shouldSave: true,
        downloadUrl: url,
      };
    }

    if (status === 1) {
      // Document is being edited - nothing to do
      return { error: 0 };
    }

    if (status === 4) {
      // Document closed with no changes
      return { error: 0 };
    }

    if (status === 3 || status === 7) {
      // Error occurred
      console.error('OnlyOffice callback error:', callbackData);
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
    size: number
  ) {
    const file = await prisma.file.findUnique({
      where: { id: fileId },
      include: {
        versions: {
          orderBy: { versionNumber: 'desc' },
          take: 1,
        },
      },
    });

    if (!file) {
      throw new Error('File not found');
    }

    const latestVersion = file.versions[0];
    const newVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

    await prisma.fileVersion.create({
      data: {
        file: { connect: { id: fileId } },
        versionNumber: newVersionNumber,
        name: file.name,
        storagePath,
        size,
        mimeType: file.mimeType,
        createdBy: { connect: { id: userId } },
      },
    });

    // Mettre à jour le fichier principal
    await prisma.file.update({
      where: { id: fileId },
      data: {
        storagePath,
        size,
        updatedAt: new Date(),
      },
    });
  }
}
