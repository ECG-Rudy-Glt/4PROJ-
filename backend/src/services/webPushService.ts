import webpush from 'web-push';
import prisma from '../config/database';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    'mailto:noreply@supfile.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
  );
}

export class WebPushService {
  static getPublicKey() {
    return VAPID_PUBLIC_KEY;
  }

  static async subscribe(userId: string, subscription: { endpoint: string; keys: { p256dh: string; auth: string } }) {
    return prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      update: { userId, p256dh: subscription.keys.p256dh, auth: subscription.keys.auth },
      create: {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    });
  }

  static async unsubscribe(userId: string, endpoint: string) {
    return prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
  }

  static async sendToUser(userId: string, title: string, body: string, data?: Record<string, any>) {
    if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;

    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId },
    });

    const payload = JSON.stringify({ title, body, data });

    const results = await Promise.allSettled(
      subscriptions.map((sub) =>
        webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payload
        )
      )
    );

    // Supprimer les subscriptions expirées (410 Gone)
    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'rejected' && (result.reason as any)?.statusCode === 410) {
        await prisma.pushSubscription.delete({
          where: { id: subscriptions[i].id },
        }).catch(() => {});
      }
    }
  }
}
