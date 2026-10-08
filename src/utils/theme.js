export const THEME_STORAGE_KEY = 'rom_theme';

export const THEME_DEFAULTS = {
  canvas: '#1f2021',
  surface: '#292a2a',
  accent: '#f97316',
  line: '#5a5c5c',
};

export const THEME_SETTING_KEYS = {
  canvas: 'theme_canvas',
  surface: 'theme_surface',
  accent: 'theme_accent',
  line: 'theme_line',
};

const HEX6 = /^#?([0-9a-fA-F]{6})$/;

export function normalizeHexColor(value, fallback = THEME_DEFAULTS.canvas) {
  const match = String(value || '').trim().match(HEX6);
  if (!match) return fallback;
  return `#${match[1].toLowerCase()}`;
}

export function isHexColor(value) {
  return HEX6.test(String(value || '').trim());
}

export function parseTheme(source = {}) {
  const src = source?.public_settings || source || {};
  return {
    canvas: normalizeHexColor(src.theme_canvas || src.canvas, THEME_DEFAULTS.canvas),
    surface: normalizeHexColor(src.theme_surface || src.surface, THEME_DEFAULTS.surface),
    accent: normalizeHexColor(src.theme_accent || src.accent, THEME_DEFAULTS.accent),
    line: normalizeHexColor(src.theme_line || src.line, THEME_DEFAULTS.line),
    logo: String(src.app_logo_url || src.logo || '').trim(),
    splash: String(src.splash_image_url || src.splash || '').trim(),
  };
}

function hexToRgb(hex) {
  const h = normalizeHexColor(hex, THEME_DEFAULTS.accent).slice(1);
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function readCachedTheme() {
  if (typeof window === 'undefined' || !window.localStorage) return parseTheme();
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return parseTheme();
    return parseTheme(JSON.parse(raw));
  } catch {
    return parseTheme();
  }
}

export function applyTheme(source = {}) {
  const theme = parseTheme(source);
  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.style.setProperty('--rom-canvas', theme.canvas);
    root.style.setProperty('--rom-surface', theme.surface);
    root.style.setProperty('--rom-accent', theme.accent);
    root.style.setProperty('--rom-line', theme.line);
    const { r, g, b } = hexToRgb(theme.accent);
    root.style.setProperty('--rom-accent-soft', `rgba(${r}, ${g}, ${b}, 0.16)`);
    root.style.backgroundColor = theme.canvas;
    if (document.body) document.body.style.backgroundColor = theme.canvas;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', theme.canvas);
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
    } catch {
      // ignore quota / private-mode failures
    }
  }
  return theme;
}

export function setAppReady(ready) {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('rom-ready', !!ready);
}
