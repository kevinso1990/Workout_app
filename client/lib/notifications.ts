import { api } from "./api";

const NOTIFICATION_ENABLED_KEY = "notification_enabled";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function isNotificationsSupported(): boolean {
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!isNotificationsSupported()) return "unsupported";
  return Notification.permission;
}

export async function isNotificationsEnabled(): Promise<boolean> {
  try {
    return localStorage.getItem(NOTIFICATION_ENABLED_KEY) === "true";
  } catch {
    return false;
  }
}

export async function requestNotificationPermissions(): Promise<boolean> {
  if (!isNotificationsSupported()) return false;
  const result = await Notification.requestPermission();
  return result === "granted";
}

export async function subscribeToPush(): Promise<boolean> {
  if (!isNotificationsSupported()) return false;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const registration = await navigator.serviceWorker.ready;
    const { publicKey } = await api.getVapidPublicKey();
    if (!publicKey) return false;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }

    const subJson = subscription.toJSON();
    await api.subscribePush({
      endpoint: subJson.endpoint!,
      keys: {
        p256dh: subJson.keys!.p256dh!,
        auth: subJson.keys!.auth!,
      },
    });

    localStorage.setItem(NOTIFICATION_ENABLED_KEY, "true");
    return true;
  } catch (err) {
    console.error("Push subscription failed:", err);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const endpoint = subscription.endpoint;
      await subscription.unsubscribe();
      await api.unsubscribePush(endpoint).catch(() => {});
    }
    localStorage.setItem(NOTIFICATION_ENABLED_KEY, "false");
    return true;
  } catch (err) {
    console.error("Push unsubscription failed:", err);
    return false;
  }
}
