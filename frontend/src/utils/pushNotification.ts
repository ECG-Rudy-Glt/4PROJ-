import api from '@/services/api';

let swRegistration: ServiceWorkerRegistration | null = null;

function waitForActive(reg: ServiceWorkerRegistration): Promise<void> {
  return new Promise((resolve) => {
    const sw = reg.installing || reg.waiting || reg.active;
    if (reg.active) {
      resolve();
      return;
    }
    sw?.addEventListener('statechange', function listener() {
      if (sw.state === 'activated') {
        sw.removeEventListener('statechange', listener);
        resolve();
      }
    });
  });
}

export async function initPushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('[Push] Non supporté par ce navigateur');
    return;
  }

  try {
    // Enregistrer le service worker et attendre qu'il soit actif
    swRegistration = await navigator.serviceWorker.register('/sw-push.js');
    console.log('[Push] Service worker enregistré');
    await waitForActive(swRegistration);
    console.log('[Push] Service worker actif');

    // Vérifier si déjà abonné
    const existingSub = await swRegistration.pushManager.getSubscription();
    if (existingSub) {
      console.log('[Push] Déjà abonné');
      return;
    }

    // Récupérer la clé VAPID publique
    const { data } = await api.get('/push/vapid-public-key');
    if (!data.publicKey) {
      console.warn('[Push] Pas de clé VAPID configurée');
      return;
    }

    // Demander la permission
    const permission = await Notification.requestPermission();
    console.log('[Push] Permission:', permission);
    if (permission !== 'granted') return;

    // S'abonner au push
    const subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(data.publicKey).buffer as ArrayBuffer,
    });

    // Envoyer la subscription au backend
    await api.post('/push/subscribe', { subscription: subscription.toJSON() });
    console.log('[Push] Subscription envoyée au backend');
  } catch (error) {
    console.error('[Push] Erreur:', error);
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
    console.error('[Push] Erreur désinscription:', error);
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
