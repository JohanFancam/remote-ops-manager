import { LIVE_REFRESH_MS, LIVE_REFRESH_QUERY_KEYS, startLiveRefresh } from './liveRefresh.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

assert(LIVE_REFRESH_MS === 5000, 'refresh interval is 5 seconds');
assert(LIVE_REFRESH_QUERY_KEYS.some((key) => key[0] === 'shootNotifications'), 'refreshes popup notifications');
assert(LIVE_REFRESH_QUERY_KEYS.some((key) => key[0] === 'notificationHistory'), 'refreshes the notifications page');
assert(LIVE_REFRESH_QUERY_KEYS.some((key) => key[0] === 'shoots'), 'refreshes shoots for reminder popups');

const seen = [];
const stop = startLiveRefresh({
  invalidateQueries: ({ queryKey }) => { seen.push(queryKey[0]); },
}, { intervalMs: 10 });

await new Promise((resolve) => setTimeout(resolve, 35));
stop();

assert(seen.includes('shootNotifications'), 'interval invalidates shoot notifications');
assert(seen.includes('shoots'), 'interval invalidates shoots');
assert(typeof startLiveRefresh(null) === 'function', 'missing client still returns a stopper');

console.log('live refresh tests passed');
