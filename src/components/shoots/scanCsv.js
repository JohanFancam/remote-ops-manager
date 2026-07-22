// Helpers for parsing the same CSV format used by CSVImportModal:
// team, opponent, date (YYYY-MM-DD), time (HH:MM), venue, type (Data/Fancam/Data-Fancam)

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

// Matches a CSV row to an existing shoot by team vs opponent only (not date/time).
export const isTeamMatch = (row, shoot) => {
  const teamMatch = namesMatch(row.team, shoot.client) || namesMatch(row.team, shoot.title);
  if (!teamMatch) return false;
  if (!row.opponent) return true;
  return namesMatch(row.opponent, shoot.title) || namesMatch(row.opponent, shoot.client);
};