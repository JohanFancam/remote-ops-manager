import { isStandaloneDisplay, normalizeRemoteRigs, remoteRigHref } from './remoteRigs.js';

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

const lightning = 'https://remotedesktop.google.com/access/session/e0078c73-1776-5ea2-fc7f-2d67f7b5c239';
assert(remoteRigHref({ name: 'Lightning 1-1', url: lightning }) === lightning, 'keeps the pasted CRD session url');
assert(
  remoteRigHref({ url: 'e0078c73-1776-5ea2-fc7f-2d67f7b5c239' }).endsWith('e0078c73-1776-5ea2-fc7f-2d67f7b5c239'),
  'session ids become CRD session urls'
);
assert(
  remoteRigHref({ name: lightning, url: '' }) === lightning,
  'a url pasted into the name still opens'
);

assert(isStandaloneDisplay() === false, 'node is not a standalone display');

console.log('remoteRigs tests passed');
