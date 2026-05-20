import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import api from './api';

export interface PushSubscription {
  id: string;
  endpoint: string;
  createdAt: string;
}

function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as any).easConfig?.projectId ??
    undefined
  );
}

/** Returns true when running inside Expo Go (not a standalone/dev-client build) */
function isExpoGo(): boolean {
  return Constants.executionEnvironment === 'storeClient';
}

async function getExpoPushToken(): Promise<string> {
  if (isExpoGo()) {
    throw new Error(
      'Les notifications push ne sont pas disponibles dans Expo Go (SDK 53+).\n' +
      'Utilisez un development build.'
    );
  }

  if (!Device.isDevice) {
    throw new Error('Les notifications push nécessitent un appareil physique.');
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    throw new Error('Permission de notification refusée.');
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const projectId = getProjectId();
  if (!projectId || projectId === 'supfile-local-dev') {
    throw new Error(
      'Push non configuré — exécutez "npx eas init" dans le dossier mobile.'
    );
  }

  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  return tokenData.data;
}

export const pushService = {
  /** Returns true if push notifications are supported in the current environment */
  isSupported(): boolean {
    return !isExpoGo() && Device.isDevice === true;
  },

  async subscribe(): Promise<void> {
    const token = await getExpoPushToken();
    await api.post('/push/expo/subscribe', { token, platform: Platform.OS });
  },

  async unsubscribe(): Promise<void> {
    const token = await getExpoPushToken().catch(() => null);
    if (!token) return;
    await api.post('/push/expo/unsubscribe', { token });
  },

  async getPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
    const { status } = await Notifications.getPermissionsAsync();
    return status;
  },
};
