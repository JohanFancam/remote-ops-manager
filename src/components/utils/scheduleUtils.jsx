export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function minutesToTime(totalMinutes) {
  const mins = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Shoot times are stored in South African Standard Time (SAST = UTC+2, no DST).
const SA_OFFSET_MIN = 120;

export function getGameDateTime(shoot) {
  const gameTime = shoot?.game_time || shoot?.start_time;
  if (!shoot?.date || !gameTime) return null;
  const [year, month, day] = shoot.date.split('-').map(Number);
  const [h, m] = gameTime.split(':').map(Number);
  // Interpret the stored SAST wall-clock as the true UTC instant.
  return new Date(Date.UTC(year, month - 1, day, h, m, 0, 0) - SA_OFFSET_MIN * 60000);
}

export function getScheduleDateTimes(shoot, rigOffsets) {
  const gameDate = getGameDateTime(shoot);
  if (!gameDate) {
    return {
      setup: null,
      pre_shoot: null,
      attention: null,
      sound: null,
      game: null,
    };
  }

  const withOffset = (offsetMinutes) => {
    const d = new Date(gameDate);
    d.setMinutes(d.getMinutes() + offsetMinutes);
    return d;
  };

  // Offsets are defined per rig setting by default; a shoot's own offset fields
  // (legacy / per-shoot override) take next priority, falling back to defaults.
  const resolve = (key, fallback) =>
    rigOffsets?.[key] ?? shoot?.[key] ?? fallback;

  return {
    setup: withOffset(resolve('setup_offset', -150)),
    pre_shoot: withOffset(resolve('pre_shoot_offset', -120)),
    attention: withOffset(resolve('attention_offset', -30)),
    sound: withOffset(resolve('sound_offset', -30)),
    game: gameDate,
  };
}

import { formatInTz } from '@/components/utils/timezoneUtils';

export function getSchedule(shoot, rigOffsets) {
  const gameTime = shoot?.game_time || shoot?.start_time;
  if (!gameTime) return null;
  const dates = getScheduleDateTimes(shoot, rigOffsets);
  return {
    setup: dates.setup ? formatInTz(dates.setup, 'HH:mm') : null,
    pre_shoot: dates.pre_shoot ? formatInTz(dates.pre_shoot, 'HH:mm') : null,
    attention: dates.attention ? formatInTz(dates.attention, 'HH:mm') : null,
    sound: dates.sound ? formatInTz(dates.sound, 'HH:mm') : null,
    game: formatInTz(dates.game, 'HH:mm'),
  };
}

const KEEP_FULL_TEAMS = ['Charlotte FC', 'KC Current', 'Kansas City Current'];
const TWO_WORD_NICKNAMES = [
  'Blue Jackets', 'Red Wings', 'Maple Leafs', 'Golden Knights',
  'Trail Blazers', 'Red Sox', 'Blue Jays', 'White Sox',
  'Black Hawks', 'Blue Devils', 'Space Force',
];

function isExempt(team) {
  return KEEP_FULL_TEAMS.some((e) => e.toLowerCase() === team.trim().toLowerCase());
}

export function stripCityFromTeam(team) {
  const trimmed = team.trim();
  if (isExempt(trimmed)) return trimmed;
  const words = trimmed.split(/\s+/);
  const lastTwo = words.slice(-2).join(' ');
  if (TWO_WORD_NICKNAMES.some((n) => n.toLowerCase() === lastTwo.toLowerCase())) return lastTwo;
  return words[words.length - 1];
}

// Returns just the home team (first side of a "vs" title), stripped of city prefix.
export function homeTeamFromTitle(title) {
  if (!title) return '';
  if (isExempt(title)) return title;
  const match = title.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  const home = match ? match[1] : title;
  return stripCityFromTeam(home);
}

export function shortenTitle(title) {
  if (!title) return title;
  if (isExempt(title)) return title;
  const match = title.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  if (match) {
    return `${stripCityFromTeam(match[1])} vs ${stripCityFromTeam(match[2])}`;
  }
  return stripCityFromTeam(title);
}

// Venues are often imported as full addresses; show just the stadium name
// (everything before the first comma). Falls back to the whole string.
export function shortenVenue(venue) {
  if (!venue) return venue;
  const trimmed = String(venue).trim();
  const commaIdx = trimmed.indexOf(',');
  return commaIdx > 0 ? trimmed.slice(0, commaIdx).trim() : trimmed;
}

// Effective shoot location: a shoot's own location (legacy / per-shoot) takes
// priority, otherwise fall back to the matched rig setting's venue so the
// location set on the team's rig settings pulls through automatically.
export function getShootLocation(shoot, rig) {
  return shoot?.location || rig?.location || '';
}