import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import api from './api';

type UploadAsset = { uri: string; name: string; type: string };
export type UploadError = { fileName?: string; error: string };
export type UploadResult = {
  success: boolean;
  count: number;
  total?: number;
  failed?: number;
  partial?: boolean;
  errors?: UploadError[];
};

function toNumber(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function unwrapUploadBody(body: any): any {
  return body?.success === true && Object.prototype.hasOwnProperty.call(body, 'data')
    ? body.data
    : body;
}

function normalizeErrors(errors: unknown): UploadError[] {
  return Array.isArray(errors)
    ? errors.map((err: any) => ({
      fileName: err?.fileName,
      error: err?.error || err?.message || 'Upload failed',
    }))
    : [];
}

function parseUploadSuccess(responseText: string, fallbackTotal: number): UploadResult {
  if (!responseText.trim()) {
    return { success: true, count: fallbackTotal, total: fallbackTotal, failed: 0, partial: false, errors: [] };
  }

  const parsed = JSON.parse(responseText);
  if (parsed?.success === false) {
    throw parseUploadError(responseText, 200);
  }

  const body = unwrapUploadBody(parsed);
  const summary = body?.summary ?? {};
  const errors = normalizeErrors(body?.errors);
  const count = toNumber(summary.success, Array.isArray(body?.files) ? body.files.length : fallbackTotal);
  const total = toNumber(summary.total, fallbackTotal);
  const failed = toNumber(summary.failed, errors.length);

  return {
    success: count > 0,
    count,
    total,
    failed,
    partial: failed > 0,
    errors,
  };
}

function parseUploadError(responseText: string, status: number): Error {
  if (!responseText.trim()) {
    return new Error(`Erreur ${status}`);
  }

  try {
    const body = unwrapUploadBody(JSON.parse(responseText));
    const errors = normalizeErrors(body?.errors);
    const message = body?.error || body?.message || errors[0]?.error || `Erreur ${status}`;
    return Object.assign(new Error(message), { errors, status });
  } catch {
    return new Error(`Erreur ${status}`);
  }
}

// XMLHttpRequest natif pour avoir de vrais événements de progression sur React Native
// (axios onUploadProgress ne fonctionne pas sur RN)
function doUpload(
  assets: UploadAsset[],
  folderId?: string,
  onProgress?: (progress: number) => void,
  onAbortReady?: (abort: () => void) => void,
): Promise<UploadResult> {
  return new Promise(async (resolve, reject) => {
    const formData = new FormData();
    for (const asset of assets) {
      formData.append('files', { uri: asset.uri, name: asset.name, type: asset.type } as any);
    }
    if (folderId) formData.append('folderId', folderId);

    const token = await SecureStore.getItemAsync('token');
    const switchSession = await SecureStore.getItemAsync('switchSessionId');
    const baseUrl = api.defaults.baseURL ?? '';

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${baseUrl}/files/upload`);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    if (switchSession) xhr.setRequestHeader('X-Switch-Session', switchSession);

    if (onAbortReady) onAbortReady(() => xhr.abort());

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onabort = () => reject(Object.assign(new Error('Annulé'), { cancelled: true }));

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(parseUploadSuccess(xhr.responseText || '', assets.length));
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Réponse upload invalide'));
        }
      } else {
        reject(parseUploadError(xhr.responseText || '', xhr.status));
      }
    };

    xhr.onerror = () => reject(new Error('Erreur réseau'));
    xhr.ontimeout = () => reject(new Error('Délai dépassé'));
    xhr.timeout = 10 * 60 * 1000;

    xhr.send(formData);
  });
}

export const uploadService = {
  async pickAndUpload(
    folderId?: string,
    onStart?: () => void,
    onAbortReady?: (abort: () => void) => void,
    onProgress?: (progress: number) => void,
  ): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      Alert.alert(
        'Importer',
        'Choisissez le type de fichier',
        [
          {
            text: 'Document / Fichier',
            onPress: async () => {
              const result = await DocumentPicker.getDocumentAsync({
                multiple: true,
                copyToCacheDirectory: true,
              });
              if (result.canceled || !result.assets?.length) {
                resolve({ success: false, count: 0 });
                return;
              }
              onStart?.();
              const assets = result.assets.map((a) => ({
                uri: a.uri,
                name: a.name ?? 'file',
                type: a.mimeType ?? 'application/octet-stream',
              }));
              try {
                resolve(await doUpload(assets, folderId, onProgress, onAbortReady));
              } catch (error) {
                reject(error);
              }
            },
          },
          {
            text: 'Photo / Vidéo',
            onPress: async () => {
              const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!perm.granted) {
                Alert.alert('Permission refusée', "L'accès à la galerie est nécessaire.");
                resolve({ success: false, count: 0 });
                return;
              }
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images', 'videos'],
                allowsMultipleSelection: true,
                quality: 1,
                videoExportPreset: ImagePicker.VideoExportPreset.Passthrough,
              });
              if (result.canceled || !result.assets?.length) {
                resolve({ success: false, count: 0 });
                return;
              }
              onStart?.();
              const assets = result.assets.map((a) => {
                const ext = a.uri.split('.').pop() ?? 'mp4';
                const name = a.fileName ?? `media_${Date.now()}.${ext}`;
                const type = a.mimeType ?? (a.type === 'video' ? 'video/mp4' : 'image/jpeg');
                return { uri: a.uri, name, type };
              });
              try {
                resolve(await doUpload(assets, folderId, onProgress, onAbortReady));
              } catch (error) {
                reject(error);
              }
            },
          },
          { text: 'Annuler', style: 'cancel', onPress: () => resolve({ success: false, count: 0 }) },
        ],
      );
    });
  },
};
