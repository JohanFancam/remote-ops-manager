import {
  crdAccountChooserHref,
  crdAndroidIntentHref,
  formatRemoteDueLabel,
  isAndroidUserAgent,
  isRemoteDisabled,
  isStandaloneDisplay,
  normalizeCrdAccount,
  normalizeDueDate,
  normalizeRemoteRigs,
  remoteRigHref,
  remoteRigLaunchHref,
  withCrdAccount,
} from './remoteRigs.js';

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

assert(normalizeCrdAccount(' Ops@Fancam.com ') === 'ops@fancam.com', 'normalizes the registered Google account');
assert(normalizeCrdAccount('not-an-email') === '', 'rejects a non-email account');
assert(normalizeCrdAccount('') === '', 'blank account stays empty');

const withUser = remoteRigHref({ url: lightning }, 'ops@fancam.com');
assert(withUser.includes('authuser=ops%40fancam.com') || withUser.includes('authuser=ops@fancam.com'), 'adds authuser to the CRD session');
assert(withUser.startsWith('https://remotedesktop.google.com/'), 'keeps the CRD origin so Chrome can open the app');
assert(remoteRigHref({ url: lightning }, 'nope') === lightning, 'ignores an invalid account');

const hinted = withCrdAccount(lightning, 'ops@fancam.com');
assert(hinted.includes('authuser='), 'withCrdAccount sets authuser');

const chooser = crdAccountChooserHref(hinted, 'ops@fancam.com');
assert(chooser.startsWith('https://accounts.google.com/AccountChooser'), 'AccountChooser is the signed-in landing');
assert(chooser.includes('Email=ops%40fancam.com'), 'AccountChooser pins the registered email');
assert(decodeURIComponent(chooser).includes('remotedesktop.google.com/access/session/'), 'AccountChooser continues into the CRD session');

const intent = crdAndroidIntentHref(hinted);
assert(intent.startsWith('intent://remotedesktop.google.com/'), 'Android intent targets CRD');
assert(intent.includes('package=com.google.chromeremotedesktop'), 'Android intent forces the CRD app');
assert(intent.includes('S.browser_fallback_url='), 'Android intent has an https fallback');

assert(isAndroidUserAgent('Mozilla/5.0 (Linux; Android 14) Chrome/120') === true, 'detects Android');
assert(isAndroidUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)') === false, 'desktop is not Android');

const androidLaunch = remoteRigLaunchHref({ url: lightning }, { account: 'ops@fancam.com', android: true });
assert(androidLaunch.startsWith('intent://'), 'Android launch uses the CRD app intent');
assert(androidLaunch.includes('authuser='), 'Android intent still carries the registered account');

const desktopLaunch = remoteRigLaunchHref({ url: lightning }, { account: 'ops@fancam.com', android: false });
assert(desktopLaunch.startsWith('https://remotedesktop.google.com/'), 'desktop launch stays on the CRD origin');
assert(desktopLaunch.includes('authuser='), 'desktop launch asks Chrome for the registered account');

const chooserLaunch = remoteRigLaunchHref({ url: lightning }, {
  account: 'ops@fancam.com',
  android: false,
  chooseAccount: true,
});
assert(chooserLaunch.startsWith('https://accounts.google.com/AccountChooser'), 'chooseAccount wraps AccountChooser');

const down = normalizeRemoteRigs([
  { name: 'Garden-01', url: lightning, disabled: true, due_date: '2026-10-12' },
  { name: 'Garden-02', url: lightning, disabled: false, due_date: '2026-10-12' },
  { name: 'Garden-03', unavailable: true, dueDate: '12 Oct 2026' },
]);
assert(isRemoteDisabled(down[0]) === true, 'disabled remotes are unavailable');
assert(down[0].due_date === '2026-10-12', 'keeps a due date on a disabled remote');
assert(isRemoteDisabled(down[1]) === false, 'working remotes stay available');
assert(down[1].due_date === '', 'clears a due date when the remote is working');
assert(isRemoteDisabled(down[2]) === true, 'unavailable alias still disables');
assert(normalizeDueDate('2026-13-99') === '', 'rejects an invalid due date');
assert(formatRemoteDueLabel('2026-10-12') === '12 Oct 2026', 'formats the due date for the chip');

console.log('remoteRigs tests passed');
