// Per-user standby colors, admin-managed via AppSettings key `standby_colors`
// (a JSON object mapping email -> color name). Falls back to role-based defaults.

export const STANDBY_COLORS = [
  { name: 'green', label: 'Green',
    badge: 'bg-green-950/40 border-green-700/40 text-green-300',
    shield: 'text-green-400', borderL: 'border-l-green-500', swatch: 'bg-green-500',
    toggleMine: 'border-green-500/40 bg-green-500/15 text-green-300 hover:bg-green-500/20',
    toggleOther: 'border-green-500/40 bg-green-500/10 text-green-300 hover:bg-green-500/20',
    textMine: 'text-green-300 hover:bg-green-950/30 hover:text-green-200',
    textOther: 'text-green-300 hover:bg-green-950/30 hover:text-green-200' },
  { name: 'yellow', label: 'Yellow',
    badge: 'bg-yellow-950/40 border-yellow-700/40 text-yellow-300',
    shield: 'text-yellow-400', borderL: 'border-l-yellow-500', swatch: 'bg-yellow-500',
    toggleMine: 'border-yellow-500/40 bg-yellow-500/15 text-yellow-300 hover:bg-yellow-500/20',
    toggleOther: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20',
    textMine: 'text-yellow-300 hover:bg-yellow-950/30 hover:text-yellow-200',
    textOther: 'text-yellow-300 hover:bg-yellow-950/30 hover:text-yellow-200' },
  { name: 'purple', label: 'Purple',
    badge: 'bg-purple-950/40 border-purple-700/40 text-purple-300',
    shield: 'text-purple-400', borderL: 'border-l-purple-500', swatch: 'bg-purple-500',
    toggleMine: 'border-purple-500/40 bg-purple-500/15 text-purple-300 hover:bg-purple-500/20',
    toggleOther: 'border-purple-500/40 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20',
    textMine: 'text-purple-300 hover:bg-purple-950/30 hover:text-purple-200',
    textOther: 'text-purple-300 hover:bg-purple-950/30 hover:text-purple-200' },
  { name: 'blue', label: 'Blue',
    badge: 'bg-blue-950/40 border-blue-700/40 text-blue-300',
    shield: 'text-blue-400', borderL: 'border-l-blue-500', swatch: 'bg-blue-500',
    toggleMine: 'border-blue-500/40 bg-blue-500/15 text-blue-300 hover:bg-blue-500/20',
    toggleOther: 'border-blue-500/40 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20',
    textMine: 'text-blue-300 hover:bg-blue-950/30 hover:text-blue-200',
    textOther: 'text-blue-300 hover:bg-blue-950/30 hover:text-blue-200' },
  { name: 'orange', label: 'Orange',
    badge: 'bg-orange-950/40 border-orange-700/40 text-orange-300',
    shield: 'text-orange-400', borderL: 'border-l-orange-500', swatch: 'bg-orange-500',
    toggleMine: 'border-orange-500/40 bg-orange-500/15 text-orange-300 hover:bg-orange-500/20',
    toggleOther: 'border-orange-500/40 bg-orange-500/10 text-orange-300 hover:bg-orange-500/20',
    textMine: 'text-orange-300 hover:bg-orange-950/30 hover:text-orange-200',
    textOther: 'text-orange-300 hover:bg-orange-950/30 hover:text-orange-200' },
  { name: 'pink', label: 'Pink',
    badge: 'bg-pink-950/40 border-pink-700/40 text-pink-300',
    shield: 'text-pink-400', borderL: 'border-l-pink-500', swatch: 'bg-pink-500',
    toggleMine: 'border-pink-500/40 bg-pink-500/15 text-pink-300 hover:bg-pink-500/20',
    toggleOther: 'border-pink-500/40 bg-pink-500/10 text-pink-300 hover:bg-pink-500/20',
    textMine: 'text-pink-300 hover:bg-pink-950/30 hover:text-pink-200',
    textOther: 'text-pink-300 hover:bg-pink-950/30 hover:text-pink-200' },
];

export const colorByName = (name) => STANDBY_COLORS.find(c => c.name === name) || null;

export const getStandbyColorMap = (appSettings = []) => {
  const raw = Array.isArray(appSettings)
    ? appSettings.find(s => s.key === 'standby_colors')?.value
    : null;
  if (!raw) return {};
  try { return JSON.parse(raw) || {}; } catch { return {}; }
};

// Resolve a color object for a standby person's email, falling back to
// role-based defaults (operator_standby = purple, me = blue, other = green).
export const resolveStandbyColor = (email, { colorMap = {}, allUsers = [], currentUserEmail } = {}) => {
  if (email && colorMap[email]) {
    const c = colorByName(colorMap[email]);
    if (c) return c;
  }
  const u = allUsers.find(x => (x.email || '').toLowerCase() === (email || '').toLowerCase());
  const role = u?.role;
  if (role === 'operator_standby') return colorByName('purple');
  if (email && currentUserEmail && email.toLowerCase() === currentUserEmail.toLowerCase()) return colorByName('blue');
  return colorByName('green');
};