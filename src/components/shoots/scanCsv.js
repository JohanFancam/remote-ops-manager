// Helpers for parsing the same CSV format used by CSVImportModal:
// team, opponent, date (YYYY-MM-DD), time (HH:MM), venue, type (Data/Fancam/Data-Fancam)
import { stripCityFromTeam } from '@/components/utils/scheduleUtils';

export function parseScanCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, '').toLowerCase());
  return lines.slice(1).map(line => {
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
  }).filter(r => r.team && r.date);
}

export const normalizeRigType = (val) => {
  const v = (val || '').toLowerCase().trim();
  if (!v) return '';
  if (v.includes('fancam') && v.includes('data')) return 'Data/Fancam';
  if (v.includes('fancam')) return 'Fancam';
  if (v.includes('data')) return 'Data';
  return '';
};

export const namesMatch = (a, b) => {
  const na = (a || '').toLowerCase().trim();
  const nb = (b || '').toLowerCase().trim();
  if (!na || !nb) return false;
  return na === nb || na.includes(nb) || nb.includes(na);
};

// Splits a "Team vs Opponent" shoot title into its two team parts.
const splitTitle = (title) => {
  const match = (title || '').match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  return match ? { team: match[1].trim(), opponent: match[2].trim() } : { team: (title || '').trim(), opponent: '' };
};

// Compares a CSV team/opponent name against a shoot's stored name, accounting for
// the app's shortened naming (e.g. "KC Current" in the CSV vs "Current" in the app).
const teamNamesMatch = (csvName, shootName) => {
  if (!csvName || !shootName) return false;
  return namesMatch(csvName, shootName) || namesMatch(stripCityFromTeam(csvName), stripCityFromTeam(shootName));
};

// Matches a CSV row to an existing shoot by team vs opponent only (not date/time).
export const isTeamMatch = (row, shoot) => {
  const { team: shootTeam, opponent: shootOpponent } = splitTitle(shoot.title);
  const teamMatch = teamNamesMatch(row.team, shootTeam) || teamNamesMatch(row.team, shoot.client);
  if (!teamMatch) return false;
  if (!row.opponent) return true;
  return teamNamesMatch(row.opponent, shootOpponent) || teamNamesMatch(row.opponent, shoot.client);
};

// Normalizes a time string (24h "H:MM", "HH:MM", or "H:MM am/pm") to "HH:MM" 24h format for comparison.
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