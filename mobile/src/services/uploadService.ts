import * as SecureStore from 'expo-secure-store';
import * as DocumentPicker from 'expo-document-picker';
import api from './api';

export const uploadService = {
  async pickAndUpload(
    folderId?: string,
    onProgress?: (progress: number) => void,
  ): Promise<{ success: boolean; count: number }> {
    const result = await DocumentPicker.getDocumentAsync({
      multiple: true,
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.length) {
      return { success: false, count: 0 };
    }

    const formData = new FormData();
    for (const asset of result.assets) {
      formData.append('files', {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || 'application/octet-stream',
      } as any);
    }
    if (folderId) {
      formData.append('folderId', folderId);
    }

    await api.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (e.total && onProgress) {
          onProgress(Math.round((e.loaded * 100) / e.total));
        }
      },
    });

    return { success: true, count: result.assets.length };
  },
};
