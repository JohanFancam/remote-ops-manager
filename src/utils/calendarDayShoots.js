import { displayYmdForSource } from './timezone.js';

const EMPTY_SHOOTS = [];

export function groupShootsByDisplayDate(shoots, timeZone) {
  const map = new Map();
  for (const shoot of shoots || []) {
    if (!shoot?.date) continue;
    const key = displayYmdForSource(shoot.date, shoot.game_time || shoot.start_time, timeZone);
    if (!key) continue;
    const bucket = map.get(key);
    if (bucket) bucket.push(shoot);
    else map.set(key, [shoot]);
  }
  for (const bucket of map.values()) {
    bucket.sort((a, b) => String(a.game_time || a.start_time || '').localeCompare(String(b.game_time || b.start_time || '')));
  }
  return map;
}

export function shootsForDisplayDate(grouped, dateStr) {
  return grouped.get(dateStr) || EMPTY_SHOOTS;
}
