import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import api from './api';

export interface PushSubscription {
  id: string;
  endpoint: string;
  createdAt: string;
}

async function getExpoPushToken(): Promise<string> {
  if (!Device.isDevice) {
    throw new Error('Les notifications push ne fonctionnent que sur un appareil physique.');
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

  const tokenData = await Notifications.getExpoPushTokenAsync();
  return tokenData.data;
}

export const pushService = {
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
