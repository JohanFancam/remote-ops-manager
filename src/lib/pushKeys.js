export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function keyToBytes(key) {
  if (!key) return new Uint8Array();
  if (typeof key === 'string') return urlBase64ToUint8Array(key);
  return key instanceof Uint8Array ? key : new Uint8Array(key);
}

export function vapidKeysMatch(a, b) {
  const left = keyToBytes(a);
  const right = keyToBytes(b);
  if (!left.length || !right.length || left.length !== right.length) return false;
  return left.every((value, index) => value === right[index]);
}

export function normalizePushKeys(keys) {
  if (!keys) return {};
  let parsed = keys;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return {};
    }
  }
  if (typeof parsed !== 'object') return {};
  return {
    p256dh: parsed.p256dh,
    auth: parsed.auth,
  };
}
