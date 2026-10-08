/** Chrome Remote Desktop machines stored on a rig setting. */

const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CRD_HOST = /(?:^https?:\/\/)?(?:www\.)?remotedesktop\.google\.com\//i;

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

export function remoteRigHref(item) {
  let url = stripWrap(item?.url);
  if (!url && looksLikeRemoteUrl(item?.name)) url = stripWrap(item.name);
  if (!url || /^javascript:/i.test(url)) return '';
  if (SESSION_ID.test(url)) {
    return `https://remotedesktop.google.com/access/session/${url}`;
  }
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  return `https://${url}`;
}

export function openRemoteRig(item) {
  const href = remoteRigHref(item);
  if (!href || typeof window === 'undefined') return false;
  // Do not pass noopener as a windowFeatures flag — Chrome/PWA can ignore the
  // open entirely. Clear opener after a successful open instead.
  let popup = null;
  try {
    popup = window.open(href, '_blank');
  } catch {
    popup = null;
  }
  if (popup) {
    try { popup.opener = null; } catch { /* ignore */ }
    return true;
  }
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  return true;
}
