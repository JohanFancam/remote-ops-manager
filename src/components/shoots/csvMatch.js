// Shared helpers for CSV import: parsing, matching and dedupe logic.
// Times in the CSV are expected to be in South African time (SAST).
import { stripCityFromTeam } from '@/components/utils/scheduleUtils';

export function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
  return lines.slice(1).map((line) => {
    const cols = [];
    let inQ = false, cur = '';
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    cols.push(cur.trim());
    const obj = {};
    headers.forEach((h, i) => { obj[h] = cols[i] || ''; });
    return obj;
  });
}

export const normalizeRigType = (val) => {
  const v = (val || '').toLowerCase().trim();
  if (!v) return '';
  if (v.includes('fancam') && v.includes('data')) return 'Data/Fancam';
  if (v.includes('fancam')) return 'Fancam';
  if (v.includes('data')) return 'Data';
  return '';
};

// Normalize a time string (24h "H:MM", "HH:MM", or "H:MM am/pm") to "HH:MM" 24h format.
export const normalizeTime = (t) => {
  if (!t) return '';
  const s = t.trim().toLowerCase();
  const ampm = s.match(/^(\d{1,2}):?(\d{2})?\s*(am|pm)$/);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = (ampm[2] || '00').padStart(2, '0');
    if (ampm[3] === 'pm' && h !== 12) h += 12;
    if (ampm[3] === 'am' && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m}`;
  }
  const [h, m] = s.split(':');
  const hour = parseInt(h, 10);
  if (isNaN(hour)) return s;
  return `${String(hour).padStart(2, '0')}:${(m || '00').padStart(2, '0')}`;
};

const namesMatch = (a, b) => {
  const na = (a || '').toLowerCase().trim();
  const nb = (b || '').toLowerCase().trim();
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
};

// Splits a "Team vs Opponent" title into its two parts.
const splitTitle = (title) => {
  const match = (title || '').match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  return match ? { team: match[1].trim(), opponent: match[2].trim() } : { team: (title || '').trim(), opponent: '' };
};

// Compare a CSV team name against a stored team name, accounting for the app's
// shortened naming convention (e.g. "KC Current" in the CSV vs "Current" in the app).
const teamNamesMatch = (csvName, storedName) => {
  if (!csvName || !storedName) return false;
  return namesMatch(csvName, storedName) || namesMatch(stripCityFromTeam(csvName), stripCityFromTeam(storedName));
};

// Compares two "Team vs Opponent" titles (case-insensitive, city-stripped).
export const titlesMatch = (csvTitle, storedTitle) => {
  const a = splitTitle(csvTitle);
  const b = splitTitle(storedTitle);
  if ((a.team || '').toLowerCase() === (b.team || '').toLowerCase() && (a.opponent || '').toLowerCase() === (b.opponent || '').toLowerCase()) return true;
  const teamMatch = teamNamesMatch(a.team, b.team) || teamNamesMatch(a.team, b.opponent);
  if (!teamMatch) return false;
  if (!a.opponent || !b.opponent) return true;
  return teamNamesMatch(a.opponent, b.opponent) || teamNamesMatch(a.opponent, b.team);
};

// Build the shoot title from a CSV row.
export const buildTitle = (row) =>
  (row.opponent ? `${row.team} vs ${row.opponent}` : row.team).trim();

// Determine whether a CSV row is a duplicate of an existing shoot (same title + date + time).
export const isDuplicateRow = (row, existing) => {
  const title = buildTitle(row);
  const tNorm = normalizeTime(row.time || '');
  const dateStr = row.date;
  return existing.some((s) => {
    if (!s || (s.date || '') !== dateStr) return false;
    const sTime = normalizeTime(s.game_time || s.start_time || '');
    if (tNorm && sTime && tNorm !== sTime) return false;
    const sTitle = (s.title || '').trim();
    if (!sTitle) return false;
    return titlesMatch(title, sTitle);
  });
};