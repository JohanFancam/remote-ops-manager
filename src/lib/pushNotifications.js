/**
 * Register service worker + subscribe to Web Push.
 */
import { api } from '@/api/client';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function pushSupported() {
  return typeof window !== 'undefined'
    && 'serviceWorker' in navigator
    && 'PushManager' in window
    && 'Notification' in window;
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;
  try {
    return await navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' });
  } catch (err) {
    console.warn('Service worker registration failed:', err);
    return null;
  }
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
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });
    }
    await api.push.subscribe(subscription.toJSON());
    try {
      localStorage.setItem('rom_push_enabled', '1');
    } catch {
      // ignore
    }
    return subscription;
  } catch (err) {
    console.warn('Could not refresh push subscription:', err);
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

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });
  }

  await api.push.subscribe(subscription.toJSON());
  try {
    localStorage.setItem('rom_push_enabled', '1');
  } catch {
    // ignore
  }
  return subscription;
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
