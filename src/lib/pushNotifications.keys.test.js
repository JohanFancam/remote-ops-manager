import { vapidKeysMatch, keyToBytes, urlBase64ToUint8Array, normalizePushKeys } from './pushKeys.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const raw = new Uint8Array([1, 2, 3, 4, 5, 250, 251, 252]);
let binary = '';
raw.forEach((b) => { binary += String.fromCharCode(b); });
const sample = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const bytes = urlBase64ToUint8Array(sample);
assert(bytes.length === raw.length, 'decodes url-safe base64');
assert(vapidKeysMatch(sample, bytes), 'string key matches ArrayBuffer bytes');
assert(!vapidKeysMatch(sample, 'AAAA'), 'mismatching keys fail');
assert(keyToBytes('').length === 0, 'empty key is empty bytes');

const nested = normalizePushKeys(JSON.stringify({ p256dh: 'abc', auth: 'def' }));
assert(nested.p256dh === 'abc' && nested.auth === 'def', 'parses stringified keys');
assert(Object.keys(normalizePushKeys('nope')).length === 0, 'corrupt keys become empty');

console.log('push key tests passed');
