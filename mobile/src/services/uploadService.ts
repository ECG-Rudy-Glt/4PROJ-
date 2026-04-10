import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import api from './api';

type UploadAsset = { uri: string; name: string; type: string };

// XMLHttpRequest natif pour avoir de vrais événements de progression sur React Native
// (axios onUploadProgress ne fonctionne pas sur RN)
function doUpload(
  assets: UploadAsset[],
  folderId?: string,
  onProgress?: (progress: number) => void,
): Promise<{ success: boolean; count: number }> {
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

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve({ success: true, count: assets.length });
      } else {
        try {
          const err = JSON.parse(xhr.responseText);
          reject(new Error(err?.error || err?.message || `Erreur ${xhr.status}`));
        } catch {
          reject(new Error(`Erreur ${xhr.status}`));
        }
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
  ): Promise<{ success: boolean; count: number }> {
    return new Promise((resolve) => {
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
              resolve(await doUpload(assets, folderId));
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
              resolve(await doUpload(assets, folderId));
            },
          },
          { text: 'Annuler', style: 'cancel', onPress: () => resolve({ success: false, count: 0 }) },
        ],
      );
    });
  },
};
