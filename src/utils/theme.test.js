import { THEME_DEFAULTS, isHexColor, normalizeHexColor, parseTheme } from './theme.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

assert(normalizeHexColor('#ABC123', THEME_DEFAULTS.canvas) === '#abc123', 'normalizes 6-digit hex');
assert(normalizeHexColor('5a5c5c', 'fallback') === '#5a5c5c', 'accepts hex without a hash');
assert(normalizeHexColor('navy', '#1f2021') === '#1f2021', 'falls back on invalid colour');
assert(isHexColor('#f97316') === true, 'accepts valid accent');
assert(isHexColor('#fff') === false, 'rejects 3-digit hex');

const defaults = parseTheme({});
assert(defaults.canvas === THEME_DEFAULTS.canvas, 'default canvas');
assert(defaults.surface === THEME_DEFAULTS.surface, 'default surface');
assert(defaults.accent === THEME_DEFAULTS.accent, 'default accent');
assert(defaults.line === THEME_DEFAULTS.line, 'visible default card border');
assert(defaults.logo === '', 'empty logo by default');

const nested = parseTheme({
  public_settings: {
    theme_canvas: '#101111',
    theme_surface: '#222324',
    theme_accent: 'ea580c',
    theme_line: '#6b6d6d',
    app_logo_url: '/api/uploads/icon.png',
  },
});
assert(nested.canvas === '#101111', 'reads canvas from public settings');
assert(nested.surface === '#222324', 'reads surface from public settings');
assert(nested.accent === '#ea580c', 'reads accent from public settings');
assert(nested.line === '#6b6d6d', 'reads line from public settings');
assert(nested.logo === '/api/uploads/icon.png', 'reads uploaded logo');

console.log('theme tests passed');
