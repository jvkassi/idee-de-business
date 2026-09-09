import webpush from "web-push";
import { query, ready } from "./db";

const publicKey = process.env.VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;
const configured = Boolean(publicKey && privateKey);

if (configured) {
  webpush.setVapidDetails("mailto:contact@idee-de-business.app", publicKey!, privateKey!);
}

export type PushSubscriptionInput = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function saveSubscription(userId: number, sub: PushSubscriptionInput): Promise<void> {
  await ready();
  await query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (endpoint) DO UPDATE SET user_id = $1, p256dh = $3, auth = $4`,
    [userId, sub.endpoint, sub.keys.p256dh, sub.keys.auth],
  );
}

export async function removeSubscription(endpoint: string): Promise<void> {
  await ready();
  await query("DELETE FROM push_subscriptions WHERE endpoint = $1", [endpoint]);
}

export type PushPayload = { title: string; body: string; url?: string };

/**
 * Envoie une notif à tous les appareils abonnés d'un utilisateur. Best
 * effort : un abonnement expiré (410/404) est nettoyé, une autre erreur
 * n'empêche pas les autres envois ni le reste du flux appelant.
 */
export async function notifyUser(userId: number, payload: PushPayload): Promise<void> {
  if (!configured) return;
  await ready();
  const subs = await query<{ endpoint: string; p256dh: string; auth: string }>(
    "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1",
    [userId],
  );
  await Promise.allSettled(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
      } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await removeSubscription(s.endpoint);
        }
      }
    }),
  );
}
