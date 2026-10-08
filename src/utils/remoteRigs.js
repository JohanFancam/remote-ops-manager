/** Chrome Remote Desktop machines stored on a rig setting. */

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CRD_HOST = /(?:^https?:\/\/)?(?:www\.)?remotedesktop\.google\.com\//i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CRD_ANDROID_PACKAGE = 'com.google.chromeremotedesktop';
export const CRD_GOOGLE_ACCOUNT_KEY = 'crd_google_account';

function stripWrap(value) {
  return String(value || '').trim().replace(/^['"]+|['"]+$/g, '').trim();
}

export function looksLikeRemoteUrl(value) {
  const text = stripWrap(value);
  if (!text) return false;
  if (SESSION_ID.test(text)) return true;
  if (CRD_HOST.test(text)) return true;
  return /^https?:\/\//i.test(text);
}

export function normalizeRemoteRigs(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === 'string') {
      const text = item.trim();
      if (!text) return null;
      if (looksLikeRemoteUrl(text)) return { name: 'Remote', url: text };
      return { name: text, url: '' };
    }
    if (!item || typeof item !== 'object') return null;
    let name = String(item.name || item.label || '').trim();
    let url = String(item.url || item.href || '').trim();
    if (!url && looksLikeRemoteUrl(name)) {
      url = name;
      name = 'Remote';
    }
    if (!name && !url) return null;
    return { name: name || 'Remote', url };
  }).filter(Boolean);
}

export function normalizeCrdAccount(value) {
  const email = String(value || '').trim().toLowerCase();
  return EMAIL.test(email) ? email : '';
}

function asOptions(accountOrOptions) {
  if (accountOrOptions == null || typeof accountOrOptions === 'string') {
    return { account: accountOrOptions };
  }
  return accountOrOptions;
}

export function remoteSessionHref(item) {
  let url = stripWrap(item?.url);
  if (!url && looksLikeRemoteUrl(item?.name)) url = stripWrap(item.name);
  if (!url || /^javascript:/i.test(url)) return '';
  if (SESSION_ID.test(url)) {
    return `https://remotedesktop.google.com/access/session/${url}`;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  return `https://${url}`;
}

export function withCrdAccount(href, account) {
  const email = normalizeCrdAccount(account);
  if (!href || !email) return href || '';
  try {
    const parsed = new URL(href);
    if (/remotedesktop\.google\.com$/i.test(parsed.hostname)) {
      parsed.searchParams.set('authuser', email);
      return parsed.toString();
    }
  } catch {
    // ignore invalid urls
  }
  return href;
}

export function crdAccountChooserHref(sessionHref, account) {
  const email = normalizeCrdAccount(account);
  if (!sessionHref || !email) return sessionHref || '';
  const chooser = new URL('https://accounts.google.com/AccountChooser');
  chooser.searchParams.set('Email', email);
  chooser.searchParams.set('continue', sessionHref);
  chooser.searchParams.set('hl', 'en');
  return chooser.toString();
}

export function crdAndroidIntentHref(httpsHref) {
  const href = String(httpsHref || '').trim();
  if (!href) return '';
  const path = href.replace(/^https?:\/\//i, '');
  return `intent://${path}#Intent;scheme=https;package=${CRD_ANDROID_PACKAGE};S.browser_fallback_url=${encodeURIComponent(href)};end`;
}

export function isAndroidUserAgent(ua) {
  const agent = ua ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  return /Android/i.test(String(agent || ''));
}

/** Session URL, with authuser when a registered Google account is set. */
export function remoteRigHref(item, accountOrOptions) {
  const { account } = asOptions(accountOrOptions);
  return withCrdAccount(remoteSessionHref(item), account);
}

/**
 * URL the OS / Chrome should actually open.
 * Android: Chrome Remote Desktop app intent. Elsewhere: the session URL so
 * Chrome can hand off to the installed Remote Desktop app. A registered
 * Google account is passed as authuser (and via AccountChooser when the
 * caller asks for a signed-in landing).
 */
export function remoteRigLaunchHref(item, accountOrOptions) {
  const options = asOptions(accountOrOptions);
  const session = remoteRigHref(item, options);
  if (!session) return '';
  const android = options.android ?? isAndroidUserAgent(options.userAgent);
  if (android) return crdAndroidIntentHref(session);
  if (options.chooseAccount && normalizeCrdAccount(options.account)) {
    return crdAccountChooserHref(session, options.account);
  }
  return session;
}

export function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
    if (window.matchMedia?.('(display-mode: fullscreen)').matches) return true;
  } catch {
    // ignore
  }
  return window.navigator?.standalone === true;
}

/**
 * Chrome 139+ only captures a click into the installed Chrome Remote Desktop
 * app when it is a normal new-tab navigation — not a named popup / window.open
 * auxiliary window.
 */
export function openRemoteRig(item, accountOrOptions) {
  if (typeof document === 'undefined') return false;
  const options = asOptions(accountOrOptions);
  const href = remoteRigLaunchHref(item, options);
  if (!href) return false;
  const android = options.android ?? isAndroidUserAgent(options.userAgent);
  const link = document.createElement('a');
  link.href = href;
  if (!android) {
    link.target = '_blank';
    link.rel = 'noopener';
  }
  link.referrerPolicy = 'no-referrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
  return true;
}
