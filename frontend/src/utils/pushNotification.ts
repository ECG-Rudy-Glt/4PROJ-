import api from '@/services/api';

let swRegistration: ServiceWorkerRegistration | null = null;

export async function initPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications non supportées par ce navigateur');
    return;
  }

  try {
    // Enregistrer le service worker
    swRegistration = await navigator.serviceWorker.register('/sw-push.js');

    // Récupérer la clé VAPID publique
    const { data } = await api.get('/push/vapid-public-key');
    if (!data.publicKey) return;

    // Demander la permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    // S'abonner au push
    const subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey).buffer as ArrayBuffer,
    });

    // Envoyer la subscription au backend
    await api.post('/push/subscribe', { subscription: subscription.toJSON() });
  } catch (error) {
    console.error('Erreur lors de l\'initialisation du push:', error);
  }
}

export async function unsubscribePush() {
  if (!swRegistration) return;

  try {
    const subscription = await swRegistration.pushManager.getSubscription();
    if (subscription) {
      await api.post('/push/unsubscribe', { endpoint: subscription.endpoint });
      await subscription.unsubscribe();
    }
  } catch (error) {
    console.error('Erreur lors de la désinscription push:', error);
  }
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
