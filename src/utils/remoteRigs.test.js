import { normalizeRemoteRigs, remoteRigHref } from './remoteRigs.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const fromNames = normalizeRemoteRigs(['LA-Remote-01', '  ', 'BOS-Remote-01']);
assert(fromNames.length === 2, 'keeps named remotes');
assert(fromNames[0].name === 'LA-Remote-01' && fromNames[0].url === '', 'legacy strings have empty url');

const mixed = normalizeRemoteRigs([
  { name: 'Garden-01', url: 'https://remotedesktop.google.com/access/session/abc' },
  { label: 'Garden-02', href: 'remotedesktop.google.com/access/session/def' },
]);
assert(mixed[0].url.includes('session/abc'), 'keeps full url');
assert(remoteRigHref(mixed[1]).startsWith('https://'), 'adds https when the scheme is missing');
assert(remoteRigHref({ url: 'javascript:alert(1)' }) === '', 'blocks javascript urls');
assert(remoteRigHref({ url: '' }) === '', 'empty url is not a button');

console.log('remoteRigs tests passed');
