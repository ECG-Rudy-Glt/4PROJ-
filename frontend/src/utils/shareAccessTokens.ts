const FOLDER_SHARE_ACCESS_PREFIX = 'supfile:share-access:folder:';

export type SharePasswordAccessErrorContext = {
  kind?: 'shared-file' | 'shared-folder';
  shareId?: string;
  fileId?: string;
  folderId?: string;
};

export function getFolderShareAccessToken(folderId?: string | null): string | undefined {
  if (!folderId || typeof sessionStorage === 'undefined') return undefined;
  return sessionStorage.getItem(`${FOLDER_SHARE_ACCESS_PREFIX}${folderId}`) || undefined;
}

export function setFolderShareAccessToken(folderId: string, token?: string | null): void {
  if (!folderId || typeof sessionStorage === 'undefined') return;

  const key = `${FOLDER_SHARE_ACCESS_PREFIX}${folderId}`;
  if (token) {
    sessionStorage.setItem(key, token);
  } else {
    sessionStorage.removeItem(key);
  }
}

export function folderShareAccessHeaders(folderId?: string | null): Record<string, string> | undefined {
  const token = getFolderShareAccessToken(folderId);
  return token ? { 'X-Share-Access-Token': token } : undefined;
}

export function getSharePasswordAccessError(error: unknown): SharePasswordAccessErrorContext | null {
  const typed = error as {
    response?: {
      status?: number;
      data?: {
        error?: unknown;
        share?: SharePasswordAccessErrorContext;
      };
    };
  } | null | undefined;

  const status = typed?.response?.status;
  const errorCode = typed?.response?.data?.error;
  const isPasswordError = status === 423
    || errorCode === 'SHARE_PASSWORD_REQUIRED'
    || errorCode === 'SHARE_PASSWORD_INVALID';

  if (!isPasswordError) return null;
  return typed?.response?.data?.share || {};
}
