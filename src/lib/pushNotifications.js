/**
 * Register service worker + subscribe to Web Push.
 */
import { api } from '@/api/client';
import { urlBase64ToUint8Array, vapidKeysMatch } from './pushKeys';

export { urlBase64ToUint8Array, vapidKeysMatch } from './pushKeys';

const VAPID_CACHE_KEY = 'rom_vapid_public';

export function pushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
    registration.update?.().catch(() => {});
    return registration;
  } catch (err) {
    console.warn('Service worker registration failed:', err);
    return null;
  }
}

async function subscribeWithPublicKey(registration, publicKey) {
  const applicationServerKey = urlBase64ToUint8Array(publicKey);
  let subscription = await registration.pushManager.getSubscription();
  const existingKey = subscription?.options?.applicationServerKey;
  const cachedKey = (() => {
    try { return localStorage.getItem(VAPID_CACHE_KEY) || ''; } catch { return ''; }
  })();

  if (subscription) {
    const mismatch = cachedKey !== publicKey
      || (existingKey && !vapidKeysMatch(existingKey, publicKey));
    if (mismatch) {
      try { await subscription.unsubscribe(); } catch { /* ignore */ }
      subscription = null;
    }
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
  }

  await api.push.subscribe(subscription.toJSON());
  try {
    localStorage.setItem('rom_push_enabled', '1');
    localStorage.setItem(VAPID_CACHE_KEY, publicKey);
  } catch {
    // ignore
  }
  return subscription;
}

export async function ensurePushSubscription() {
  if (!pushSupported()) return null;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return null;
  try {
    const registration = await registerServiceWorker();
    if (!registration) return null;
    await navigator.serviceWorker.ready;
    const { publicKey } = await api.push.vapidPublicKey();
    if (!publicKey) return null;
    return await subscribeWithPublicKey(registration, publicKey);
  } catch (err) {
    console.warn('Could not refresh push subscription:', err);
    try {
      const registration = await navigator.serviceWorker.ready;
      const stale = await registration.pushManager.getSubscription();
      if (stale) await stale.unsubscribe();
      const { publicKey } = await api.push.vapidPublicKey();
      if (publicKey) return await subscribeWithPublicKey(registration, publicKey);
    } catch {
      // ignore
    }
    return null;
  }
}

export async function enablePushNotifications() {
  if (!pushSupported()) {
    throw new Error('Push notifications are not supported in this browser');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted');
  }

  const registration = await registerServiceWorker();
  if (!registration) throw new Error('Could not register service worker');

  await navigator.serviceWorker.ready;
  const { publicKey } = await api.push.vapidPublicKey();
  if (!publicKey) throw new Error('Server is missing VAPID public key');

  return subscribeWithPublicKey(registration, publicKey);
}

export async function disablePushNotifications() {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const subscription = await registration?.pushManager?.getSubscription();
  if (subscription) {
    try {
      await api.push.unsubscribe(subscription.endpoint);
    } catch {
      // ignore API errors
    }
    await subscription.unsubscribe();
  }
  try {
    localStorage.removeItem('rom_push_enabled');
    localStorage.removeItem(VAPID_CACHE_KEY);
  } catch {
    // ignore
  }
}

export function isPushEnabledLocally() {
  try {
    return localStorage.getItem('rom_push_enabled') === '1';
  } catch {
    return false;
  }
}

export async function sendTestPush() {
  return api.push.test();
}
