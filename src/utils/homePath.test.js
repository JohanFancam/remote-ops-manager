import { homePathForUser } from './homePath.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

assert(homePathForUser({ role: 'admin' }) === '/', 'admin lands on dashboard');
assert(homePathForUser({ role: 'user' }) === '/', 'remote lands on dashboard');
assert(homePathForUser({ role: 'standby' }) === '/', 'standby lands on dashboard');
assert(homePathForUser({ role: 'viewer' }) === '/', 'viewer lands on dashboard');
assert(homePathForUser({ role: 'analytics' }) === '/', 'data user lands on dashboard');
assert(homePathForUser({ role: 'accounts' }) === '/AccountsDashboard', 'accounts lands on accounts dashboard');
assert(homePathForUser(null) === '/', 'missing user lands on dashboard');

console.log('homePath.test.js: ok');
