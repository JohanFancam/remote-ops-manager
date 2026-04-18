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

export function getPrimaryShootDateTime(shoot) {
  const phaseDates = getScheduleDateTimes(shoot);
  return (
    phaseDates.setup ||
    phaseDates.pre_shoot ||
    phaseDates.game ||
    (shoot?.date ? new Date(`${shoot.date}T${shoot.game_time || shoot.start_time || '23:59'}`) : null)
  );
}

export function isShootCancelled(shoot) {
  return shoot?.status === 'cancelled';
}

export function isShootCompleted(shoot) {
  return !!shoot?.phase_status?.shoot_complete || shoot?.status === 'completed';
}

export function hasShootStarted(shoot, now = new Date()) {
  if (isShootCancelled(shoot) || isShootCompleted(shoot)) return false;

  const phase = shoot?.phase_status || {};
  if (
    phase.setup_complete ||
    phase.pre_shoot_started ||
    phase.attention_started ||
    phase.sound_started ||
    phase.game_started ||
    shoot?.status === 'in_progress'
  ) {
    return true;
  }

  const primary = getPrimaryShootDateTime(shoot);
  return !!primary && primary <= now;
}

export function isShootCurrent(shoot, now = new Date()) {
  if (isShootCancelled(shoot) || isShootCompleted(shoot) || !shoot?.date) return false;

  const todayStr = new Date(now).toISOString().slice(0, 10);
  if (shoot.date !== todayStr) return false;

  return hasShootStarted(shoot, now);
}

export function isShootUpcoming(shoot, now = new Date()) {
  if (isShootCancelled(shoot) || isShootCompleted(shoot)) return false;
  if (isShootCurrent(shoot, now)) return false;

  const primary = getPrimaryShootDateTime(shoot);
  if (!primary) return false;

  return primary > now;
}

export function sortShootsAroundNow(shoots = [], now = new Date()) {
  const current = [];
  const upcoming = [];
  const past = [];

  shoots.forEach((shoot) => {
    if (isShootCancelled(shoot)) return;

    if (isShootCurrent(shoot, now)) {
      current.push(shoot);
      return;
    }

    if (isShootUpcoming(shoot, now)) {
      upcoming.push(shoot);
      return;
    }

    past.push(shoot);
  });

  current.sort((a, b) => getPrimaryShootDateTime(a) - getPrimaryShootDateTime(b));
  upcoming.sort((a, b) => getPrimaryShootDateTime(a) - getPrimaryShootDateTime(b));
  past.sort((a, b) => getPrimaryShootDateTime(b) - getPrimaryShootDateTime(a));

  return { current, upcoming, past, ordered: [...current, ...upcoming, ...past] };
}

export function buildRelativeShootPager(shoots = [], itemsPerPage = 3, now = new Date()) {
  const { current, upcoming, past } = sortShootsAroundNow(shoots, now);

  const makeChunks = (items) => {
    const chunks = [];
    for (let i = 0; i < items.length; i += itemsPerPage) {
      chunks.push(items.slice(i, i + itemsPerPage));
    }
    return chunks;
  };

  const anchorItems = [...current, ...upcoming].slice(0, itemsPerPage);
  const remainingFuture = [...current, ...upcoming].slice(itemsPerPage);

  const futurePages = anchorItems.length > 0
    ? [anchorItems, ...makeChunks(remainingFuture)]
    : [];

  const pastPages = makeChunks(past);

  const getVisibleShoots = (offset = 0) => {
    if (offset < 0) return pastPages[Math.abs(offset) - 1] || [];
    if (futurePages.length > 0) return futurePages[offset] || [];
    return pastPages[offset] || [];
  };

  const minOffset = pastPages.length > 0 ? -pastPages.length : 0;
  const maxOffset = futurePages.length > 0
    ? futurePages.length - 1
    : Math.max(0, pastPages.length - 1);

  return {
    current,
    upcoming,
    past,
    pastPages,
    futurePages,
    minOffset,
    maxOffset,
    hasAnchorPage: futurePages.length > 0,
    getVisibleShoots,
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
