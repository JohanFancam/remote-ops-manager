/** Chrome Remote Desktop machines stored on a rig setting. */

export function normalizeRemoteRigs(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    if (typeof item === 'string') {
      const name = item.trim();
      return name ? { name, url: '' } : null;
    }
    if (!item || typeof item !== 'object') return null;
    const name = String(item.name || item.label || '').trim();
    const url = String(item.url || item.href || '').trim();
    if (!name && !url) return null;
    return { name: name || 'Remote', url };
  }).filter(Boolean);
}

export function remoteRigHref(item) {
  const url = String(item?.url || '').trim();
  if (!url || /^javascript:/i.test(url)) return '';
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return url;
  return `https://${url}`;
}

export function openRemoteRig(item) {
  const href = remoteRigHref(item);
  if (!href || typeof window === 'undefined') return false;
  window.open(href, '_blank', 'noopener,noreferrer');
  return true;
}
