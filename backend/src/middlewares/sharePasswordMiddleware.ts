import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';
import prisma from '../config/database';
import jwt from 'jsonwebtoken';
import { findSharedFolderAccessRoot } from './permissions';

const SHARE_ACCESS_SECRET = `${process.env.JWT_SECRET || 'secret'}:share-access`;
const SHARE_ACCESS_PURPOSE = 'share-password-access';
const SHARE_ACCESS_HEADER = 'x-share-access-token';

function getShareAccessToken(req: AuthRequest): string | undefined {
  const value = typeof req.get === 'function'
    ? req.get(SHARE_ACCESS_HEADER)
    : req.headers?.[SHARE_ACCESS_HEADER];
  return Array.isArray(value) ? value[0] : value;
}

function getPasswordFingerprint(passwordHash: string): string {
  return passwordHash.slice(-16);
}

function getRequestedFolderId(req: AuthRequest): string | undefined {
  const queryFolderId = typeof req.query.folderId === 'string' ? req.query.folderId : undefined;
  const queryParentId = typeof req.query.parentId === 'string' ? req.query.parentId : undefined;
  return req.params.folderId || queryFolderId || queryParentId;
}

type ProtectedShareContext = {
  kind: 'shared-file' | 'shared-folder';
  shareId: string;
  userId: string;
  passwordHash: string;
  fileId?: string;
  folderId?: string;
};

function shareAccessErrorPayload(
  error: 'SHARE_PASSWORD_REQUIRED' | 'SHARE_PASSWORD_INVALID',
  message: string,
  expected: ProtectedShareContext
) {
  return {
    error,
    message,
    share: {
      kind: expected.kind,
      shareId: expected.shareId,
      fileId: expected.fileId,
      folderId: expected.folderId,
    },
  };
}

function requireShareAccessToken(res: Response, expected: ProtectedShareContext): void {
  res.status(423).json(shareAccessErrorPayload(
    'SHARE_PASSWORD_REQUIRED',
    'Mot de passe requis pour ce partage',
    expected
  ));
}

function rejectShareAccessToken(res: Response, expected: ProtectedShareContext): void {
  res.status(403).json(shareAccessErrorPayload(
    'SHARE_PASSWORD_INVALID',
    'Mot de passe ou token invalide',
    expected
  ));
}

function verifyTokenContext(
  token: string | undefined,
  expected: {
    kind: 'shared-file' | 'shared-folder';
    shareId: string;
    userId: string;
    fingerprint: string;
    fileId?: string;
    folderId?: string;
  }
): boolean {
  if (!token) return false;

  const decoded = jwt.verify(token, SHARE_ACCESS_SECRET) as any;
  if (
    decoded.purpose !== SHARE_ACCESS_PURPOSE ||
    decoded.kind !== expected.kind ||
    decoded.shareId !== expected.shareId ||
    decoded.userId !== expected.userId ||
    decoded.fingerprint !== expected.fingerprint
  ) {
    return false;
  }

  if (expected.fileId && decoded.fileId !== expected.fileId) return false;
  if (expected.folderId && decoded.folderId !== expected.folderId) return false;

  return true;
}

function validateProtectedShare(
  req: AuthRequest,
  res: Response,
  expected: ProtectedShareContext
): boolean {
  const token = getShareAccessToken(req);
  if (!token) {
    requireShareAccessToken(res, expected);
    return false;
  }

  try {
    const fingerprint = getPasswordFingerprint(expected.passwordHash);
    if (!verifyTokenContext(token, { ...expected, fingerprint })) {
      throw new Error('Invalid token context');
    }
  } catch (error) {
    rejectShareAccessToken(res, expected);
    return false;
  }

  return true;
}

export const verifyDirectSharePassword = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const fileId = req.params.fileId || req.params.id;
    const folderId = getRequestedFolderId(req);

    if (!fileId && !folderId) return next();

    if (fileId) {
      const file = await prisma.file.findUnique({ where: { id: fileId } });
      if (!file || file.userId === userId) {
        // Not found or owner: leave the normal permission/controller flow unchanged.
        return next();
      }

      const sharedFile = await prisma.sharedFile.findFirst({
        where: {
          fileId,
          sharedWithId: userId,
          accepted: true,
          file: { is: { isDeleted: false } },
        },
      });

      if (sharedFile) {
        if (sharedFile.passwordHash && !validateProtectedShare(req, res, {
          kind: 'shared-file',
          shareId: sharedFile.id,
          userId,
          passwordHash: sharedFile.passwordHash,
          fileId,
        })) {
          return;
        }

        // Direct file shares are independent from folder shares.
        return next();
      }

      if (file.folderId) {
        const sharedFolder = await findSharedFolderAccessRoot(userId, file.folderId, 'read');
        if (sharedFolder?.passwordHash && !validateProtectedShare(req, res, {
          kind: 'shared-folder',
          shareId: sharedFolder.id,
          userId,
          passwordHash: sharedFolder.passwordHash,
          folderId: sharedFolder.folderId,
        })) {
          return;
        }
      }
    } else if (folderId) {
      const folder = await prisma.folder.findUnique({ where: { id: folderId } });
      if (!folder || folder.userId === userId) {
        return next();
      }

      const sharedFolder = await findSharedFolderAccessRoot(userId, folderId, 'read');
      if (sharedFolder?.passwordHash && !validateProtectedShare(req, res, {
        kind: 'shared-folder',
        shareId: sharedFolder.id,
        userId,
        passwordHash: sharedFolder.passwordHash,
        folderId: sharedFolder.folderId,
      })) {
        return;
      }
    }

    next();
  } catch (error) {
    next(error);
  }
};
