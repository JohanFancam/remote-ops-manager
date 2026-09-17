/**
 * Web Push (VAPID). Subscriptions stored as PushSubscription entities.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import webpush from 'web-push';
import { listEntities, createEntity, deleteEntity, filterEntities } from './entities.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function vapidPath() {
  const dbPath = process.env.DATABASE_PATH || path.join(__dirname, 'data', 'remote-ops.db');
  return path.join(path.dirname(dbPath), 'vapid-keys.json');
}

function loadOrCreateVapidKeys() {
  const file = vapidPath();
  const fromEnv = {
    publicKey: process.env.VAPID_PUBLIC_KEY || '',
    privateKey: process.env.VAPID_PRIVATE_KEY || '',
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@example.com',
  };
  if (fromEnv.publicKey && fromEnv.privateKey) return fromEnv;

  try {
    if (fs.existsSync(file)) {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (saved.publicKey && saved.privateKey) {
        return { ...saved, subject: saved.subject || fromEnv.subject };
      }
    }
  } catch {
    // ignore corrupt file
  }

  const generated = webpush.generateVAPIDKeys();
  const keys = {
    publicKey: generated.publicKey,
    privateKey: generated.privateKey,
    subject: fromEnv.subject,
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(keys, null, 2));
  return keys;
}

const vapid = loadOrCreateVapidKeys();
webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

export function getVapidPublicKey() {
  return vapid.publicKey;
}

export function savePushSubscription(user, subscription) {
  if (!user?.email || !subscription?.endpoint) {
    const err = new Error('Invalid push subscription');
    err.status = 400;
    throw err;
  }

  const email = String(user.email).toLowerCase();
  const existing = filterEntities('PushSubscription', { endpoint: subscription.endpoint });
  for (const row of existing) {
    deleteEntity('PushSubscription', row.id);
  }

  return createEntity('PushSubscription', {
    user_email: email,
    user_id: user.id || null,
    endpoint: subscription.endpoint,
    keys: subscription.keys || {},
    expirationTime: subscription.expirationTime || null,
  }, user);
}

export function removePushSubscription(endpoint, userEmail = null) {
  if (!endpoint) return { removed: 0 };
  let rows = filterEntities('PushSubscription', { endpoint });
  if (userEmail) {
    const email = String(userEmail).toLowerCase();
    rows = rows.filter((r) => String(r.user_email || '').toLowerCase() === email);
  }
  for (const row of rows) deleteEntity('PushSubscription', row.id);
  return { removed: rows.length };
}

export async function sendPushToEmails(emails, payload) {
  const targets = [...new Set((emails || []).map((e) => String(e || '').trim().toLowerCase()).filter(Boolean))];
  if (!targets.length) return { sent: 0, failed: 0 };

  const all = listEntities('PushSubscription', '-created_date', 5000);
  const subs = all.filter((s) => targets.includes(String(s.user_email || '').toLowerCase()));
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);

  let sent = 0;
  let failed = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys || {} },
        body,
      );
      sent += 1;
    } catch (err) {
      failed += 1;
      if (err.statusCode === 404 || err.statusCode === 410) {
        try { deleteEntity('PushSubscription', sub.id); } catch { /* ignore */ }
      } else {
        console.warn('Web push failed:', err.statusCode || err.message);
      }
    }
  }
  return { sent, failed };
}
