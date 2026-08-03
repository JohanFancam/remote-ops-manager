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

export function getScheduleDateTimes(shoot) {
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

  return {
    setup: withOffset(shoot?.setup_offset ?? -150),
    pre_shoot: withOffset(shoot?.pre_shoot_offset ?? -120),
    attention: withOffset(shoot?.attention_offset ?? -30),
    sound: withOffset(shoot?.sound_offset ?? -30),
    game: gameDate,
  };
}

import { formatInTz } from '@/components/utils/timezoneUtils';

export function getSchedule(shoot) {
  const gameTime = shoot?.game_time || shoot?.start_time;
  if (!gameTime) return null;
  const dates = getScheduleDateTimes(shoot);
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
  if (words.length <= 2) return trimmed;
  const lastTwo = words.slice(-2).join(' ');
  if (TWO_WORD_NICKNAMES.some((n) => n.toLowerCase() === lastTwo.toLowerCase())) return lastTwo;
  return words[words.length - 1];
}

export function shortenTitle(title) {
  if (!title) return title;
  if (isExempt(title)) return title;
  const match = title.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  if (match) {
    return `${stripCityFromTeam(match[1])} vs ${stripCityFromTeam(match[2])}`;
  }
  const words = title.trim().split(/\s+/);
  if (words.length <= 2) return title;
  return stripCityFromTeam(title);
}