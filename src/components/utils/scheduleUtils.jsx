import { format } from 'date-fns';

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

export function getGameDateTime(shoot) {
  const gameTime = shoot?.game_time || shoot?.start_time;
  if (!shoot?.date || !gameTime) return null;
  const [year, month, day] = shoot.date.split('-').map(Number);
  const [h, m] = gameTime.split(':').map(Number);
  return new Date(year, month - 1, day, h, m, 0, 0);
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

export function getPrimaryDateTime(shoot) {
  const phaseDates = getScheduleDateTimes(shoot);
  return (
    phaseDates.setup ||
    phaseDates.pre_shoot ||
    phaseDates.game ||
    (shoot?.date ? new Date(`${shoot.date}T${shoot.game_time || shoot.start_time || '23:59'}`) : null)
  );
}

export function isShootComplete(shoot) {
  return !!shoot?.phase_status?.shoot_complete || shoot?.status === 'completed';
}

export function isShootCancelled(shoot) {
  return shoot?.status === 'cancelled';
}

export function isShootStarted(shoot, now = new Date()) {
  if (isShootCancelled(shoot) || isShootComplete(shoot)) return false;
  const phase = shoot?.phase_status || {};
  if (shoot?.status === 'in_progress') return true;
  if (
    phase.setup_complete ||
    phase.pre_shoot_started ||
    phase.attention_started ||
    phase.sound_started ||
    phase.game_started
  ) {
    return true;
  }
  const primaryDate = getPrimaryDateTime(shoot);
  return !!primaryDate && primaryDate <= now;
}

export function isShootCurrent(shoot, now = new Date()) {
  if (isShootCancelled(shoot) || isShootComplete(shoot)) return false;
  if (!shoot?.date) return false;
  return shoot.date === format(now, 'yyyy-MM-dd') && isShootStarted(shoot, now);
}

export function getCurrentOrNextShootIndex(shoots = [], now = new Date()) {
  const currentIndex = shoots.findIndex((shoot) => isShootCurrent(shoot, now));
  if (currentIndex >= 0) return currentIndex;

  const upcomingIndex = shoots.findIndex((shoot) => {
    if (isShootCancelled(shoot) || isShootComplete(shoot)) return false;
    const primaryDate = getPrimaryDateTime(shoot);
    return primaryDate && primaryDate >= now;
  });

  if (upcomingIndex >= 0) return upcomingIndex;
  return Math.max(0, shoots.length - 1);
}

export function getStandbyWindowDateTimes(standbyDay) {
  const startDate = standbyDay?.start_date || standbyDay?.date;
  const endDate = standbyDay?.end_date || startDate;
  if (!startDate) return null;

  return {
    start: new Date(`${startDate}T${standbyDay?.start_time || '00:00'}`),
    end: new Date(`${endDate}T${standbyDay?.end_time || '23:59:59'}`),
  };
}

export function isShootWithinStandbyWindow(shoot, standbyDay) {
  const windowRange = getStandbyWindowDateTimes(standbyDay);
  const primaryDate = getPrimaryDateTime(shoot);
  if (!windowRange || !primaryDate) return false;
  return primaryDate >= windowRange.start && primaryDate <= windowRange.end;
}

export function getSchedule(shoot) {
  const gameTime = shoot?.game_time || shoot?.start_time;
  if (!gameTime) return null;
  const dates = getScheduleDateTimes(shoot);
  return {
    setup: dates.setup ? minutesToTime(dates.setup.getHours() * 60 + dates.setup.getMinutes()) : null,
    pre_shoot: dates.pre_shoot ? minutesToTime(dates.pre_shoot.getHours() * 60 + dates.pre_shoot.getMinutes()) : null,
    attention: dates.attention ? minutesToTime(dates.attention.getHours() * 60 + dates.attention.getMinutes()) : null,
    sound: dates.sound ? minutesToTime(dates.sound.getHours() * 60 + dates.sound.getMinutes()) : null,
    game: gameTime,
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

function stripCityFromTeam(team) {
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
