/** Resolve sports-team watermarks from a shoot title. ESPN CDN + letter fallback. */

import { shortenTitle } from '@/components/utils/scheduleUtils';

const ESPN = {
  nba: (abbr) => `https://a.espncdn.com/i/teamlogos/nba/500/${abbr}.png`,
  nhl: (abbr) => `https://a.espncdn.com/i/teamlogos/nhl/500/${abbr}.png`,
  mlb: (abbr) => `https://a.espncdn.com/i/teamlogos/mlb/500/${abbr}.png`,
  nfl: (abbr) => `https://a.espncdn.com/i/teamlogos/nfl/500/${abbr}.png`,
  soccer: (id) => `https://a.espncdn.com/i/teamlogos/soccer/500/${id}.png`,
};

const NBA = {
  hawks: 'atl', atlanta: 'atl', celtics: 'bos', boston: 'bos', nets: 'bkn', brooklyn: 'bkn',
  hornets: 'cha', charlotte: 'cha', bulls: 'chi', cavaliers: 'cle', cavs: 'cle',
  mavericks: 'dal', mavs: 'dal', nuggets: 'den', pistons: 'det', warriors: 'gs',
  rockets: 'hou', pacers: 'ind', clippers: 'lac', lakers: 'lal', grizzlies: 'mem',
  heat: 'mia', bucks: 'mil', timberwolves: 'min', wolv: 'min', pelicans: 'no',
  knicks: 'ny', thunder: 'okc', magic: 'orl', '76ers': 'phi', sixers: 'phi',
  suns: 'phx', blazers: 'por', 'trail blazers': 'por', kings: 'sac', spurs: 'sa',
  raptors: 'tor', jazz: 'utah', wizards: 'wsh',
};

const NHL = {
  ducks: 'ana', coyotes: 'ari', utah: 'utah', bruins: 'bos', sabres: 'buf',
  flames: 'cgy', hurricanes: 'car', canes: 'car', blackhawks: 'chi', avalanche: 'col',
  'blue jackets': 'cbj', jackets: 'cbj', stars: 'dal', 'red wings': 'det', wings: 'det',
  oilers: 'edm', panthers: 'fla', kings: 'la', wild: 'min', canadiens: 'mtl',
  habs: 'mtl', predators: 'nsh', preds: 'nsh', devils: 'nj', islanders: 'nyi',
  rangers: 'nyr', senators: 'ott', sens: 'ott', flyers: 'phi', penguins: 'pit',
  pens: 'pit', sharks: 'sj', kraken: 'sea', blues: 'stl', lightning: 'tb',
  'maple leafs': 'tor', leafs: 'tor', canucks: 'van', 'golden knights': 'vgk',
  knights: 'vgk', jets: 'wpg', capitals: 'wsh', caps: 'wsh',
};

const MLB = {
  diamondbacks: 'ari', dbacks: 'ari', braves: 'atl', orioles: 'bal', os: 'bal',
  'red sox': 'bos', cubs: 'chc', 'white sox': 'cws', reds: 'cin', guardians: 'cle',
  rockies: 'col', tigers: 'det', astros: 'hou', royals: 'kc', angels: 'laa',
  dodgers: 'lad', marlins: 'mia', brewers: 'mil', twins: 'min', mets: 'nym',
  yankees: 'nyy', athletics: 'oak', as: 'oak', phillies: 'phi', pirates: 'pit',
  padres: 'sd', giants: 'sf', mariners: 'sea', cardinals: 'stl', 'rays': 'tb',
  rangers: 'tex', 'blue jays': 'tor', jays: 'tor', nationals: 'wsh', nats: 'wsh',
};

const NFL = {
  cardinals: 'ari', falcons: 'atl', ravens: 'bal', bills: 'buf', panthers: 'car',
  bears: 'chi', bengals: 'cin', browns: 'cle', cowboys: 'dal', broncos: 'den',
  lions: 'det', packers: 'gb', texans: 'hou', colts: 'ind', jaguars: 'jax',
  jags: 'jax', chiefs: 'kc', raiders: 'lv', chargers: 'lac', rams: 'lar',
  dolphins: 'mia', vikings: 'min', patriots: 'ne', pats: 'ne', saints: 'no',
  giants: 'nyg', jets: 'nyj', eagles: 'phi', steelers: 'pit', seahawks: 'sea',
  '49ers': 'sf', niners: 'sf', buccaneers: 'tb', bucs: 'tb', titans: 'ten',
  commanders: 'wsh',
};

const SOCCER = {
  arsenal: '359', chelsea: '363', tottenham: '367', spurs: '367', liverpool: '364',
  'manchester united': '360', 'man united': '360', 'man utd': '360',
  'manchester city': '382', 'man city': '382', 'west ham': '371',
  newcastle: '361', 'aston villa': '362', villa: '362', brighton: '331',
  fulham: '370', wolves: '380', everton: '368', 'crystal palace': '384',
  palace: '384', brentford: '337', bournemouth: '349', 'nottingham forest': '393',
  forest: '393', southampton: '376', leicester: '375', leeds: '357',
  celtic: '345', 'real madrid': '86', barcelona: '83', 'bayern munich': '132',
  psg: '160', 'inter miami': '20232',
};

const LEAGUES = [
  { id: 'nba', sport: 'nba', map: NBA, url: ESPN.nba },
  { id: 'nhl', sport: 'nhl', map: NHL, url: ESPN.nhl },
  { id: 'mlb', sport: 'mlb', map: MLB, url: ESPN.mlb },
  { id: 'nfl', sport: 'nfl', map: NFL, url: ESPN.nfl },
  { id: 'soccer', sport: 'soccer', map: SOCCER, url: ESPN.soccer },
];

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanSide(raw) {
  return String(raw || '').replace(/\s*\([^)]*\)\s*$/g, '').trim();
}

export function parseMatchupTeams(title) {
  const cleaned = cleanSide(title);
  const match = cleaned.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  if (match) return [cleanSide(match[1]), cleanSide(match[2])];
  return cleaned ? [cleaned] : [];
}

function lookupKeys(name) {
  const full = norm(name);
  const short = norm(shortenTitle(name));
  const keys = [full, short];
  const words = full.split(' ');
  if (words.length > 1) keys.push(words[words.length - 1]);
  if (words.length >= 2) keys.push(words.slice(-2).join(' '));
  return [...new Set(keys.filter(Boolean))];
}

function sportHint(raw) {
  const s = norm(raw);
  if (!s) return '';
  if (s.includes('nba') || s.includes('basket')) return 'nba';
  if (s.includes('nhl') || s.includes('hockey')) return 'nhl';
  if (s.includes('mlb') || s.includes('baseball')) return 'mlb';
  if (s.includes('nfl') || (s.includes('football') && !s.includes('soccer'))) return 'nfl';
  if (s.includes('soccer') || s.includes('premier') || s.includes('football club')) return 'soccer';
  return s;
}

function findInLeague(league, name) {
  for (const key of lookupKeys(name)) {
    const abbr = league.map[key];
    if (abbr) return { league: league.id, url: league.url(abbr), key };
  }
  return null;
}

function resolveOne(name, preferredSport = '') {
  if (!name) return null;
  const hint = sportHint(preferredSport);
  const ordered = hint
    ? [...LEAGUES.filter((l) => l.sport === hint), ...LEAGUES.filter((l) => l.sport !== hint)]
    : LEAGUES;
  for (const league of ordered) {
    const hit = findInLeague(league, name);
    if (hit) return hit;
  }
  return null;
}

function inferLeague(names, preferredSport = '') {
  const hint = sportHint(preferredSport);
  if (hint && LEAGUES.some((l) => l.sport === hint)) return hint;
  if (names.length < 2) return '';
  const scores = LEAGUES.map((league) => ({
    id: league.sport,
    hits: names.filter((n) => findInLeague(league, n)).length,
  }));
  scores.sort((a, b) => b.hits - a.hits);
  return scores[0]?.hits >= 2 ? scores[0].id : '';
}

function monogramFor(name) {
  const short = shortenTitle(name) || name || '';
  const words = short.trim().split(/\s+/);
  if (words.length >= 2 && words[0].length <= 3) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return (words[words.length - 1] || short || '?').slice(0, 1).toUpperCase();
}

export const TILE_LOGO_TONE_FILTER = 'brightness(0) invert(1)';

export function normalizeTeamKey(value) {
  return norm(value);
}

export function parseTileLogoOverrides(raw) {
  if (!raw) return {};
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const out = {};
    for (const [key, value] of Object.entries(parsed)) {
      const normKey = norm(key);
      if (!normKey) continue;
      if (typeof value === 'string' && value.trim()) {
        out[normKey] = { url: value.trim(), label: key };
      } else if (value && typeof value === 'object' && value.url) {
        out[normKey] = {
          url: String(value.url).trim(),
          label: String(value.label || key).trim() || key,
        };
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeTileLogoOverrides(overrides = {}) {
  return JSON.stringify(overrides || {});
}

function findOverride(name, overrides = {}) {
  if (!name || !overrides || typeof overrides !== 'object') return null;
  const nameKeys = lookupKeys(name);
  for (const key of nameKeys) {
    if (overrides[key]?.url) return overrides[key];
  }
  for (const [okey, value] of Object.entries(overrides)) {
    if (!value?.url) continue;
    const overrideKeys = lookupKeys(value.label || okey);
    if (nameKeys.some((key) => key.length >= 3 && overrideKeys.includes(key))) {
      return value;
    }
  }
  return null;
}

export function readTileLogoSettings(appSettings = []) {
  const get = (key) => appSettings.find((item) => item.key === key)?.value;
  const enabledRaw = String(get('tile_logos_enabled') ?? 'true').toLowerCase();
  const size = Number(get('tile_logos_size'));
  const opacity = Number(get('tile_logos_opacity'));
  return {
    enabled: enabledRaw !== 'false' && enabledRaw !== '0',
    sizePercent: Number.isFinite(size) ? Math.min(160, Math.max(60, size)) : 100,
    opacityPercent: Number.isFinite(opacity) ? Math.min(100, Math.max(10, opacity)) : 70,
    overrides: parseTileLogoOverrides(get('tile_logo_overrides')),
  };
}

export function resolveTeamMarks(title, sport = '', overrides = {}) {
  const names = parseMatchupTeams(title);
  const league = inferLeague(names, sport);
  return names.map((name) => {
    const custom = findOverride(name, overrides);
    const hit = resolveOne(name, league || sport);
    return {
      name,
      label: shortenTitle(name) || name,
      url: custom?.url || hit?.url || '',
      monogram: monogramFor(name),
      custom: Boolean(custom),
    };
  });
}
