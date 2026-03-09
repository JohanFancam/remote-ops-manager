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

export function getSchedule(shoot) {
  const gameTime = shoot?.game_time || shoot?.start_time;
  if (!gameTime) return null;
  const base = timeToMinutes(gameTime);
  return {
    setup: minutesToTime(base + (shoot?.setup_offset ?? -150)),
    pre_shoot: minutesToTime(base + (shoot?.pre_shoot_offset ?? -120)),
    attention: minutesToTime(base + (shoot?.attention_offset ?? -30)),
    sound: minutesToTime(base + (shoot?.sound_offset ?? -30)),
    game: gameTime,
  };
}

// Known 2-word team nicknames
const TWO_WORD_NICKNAMES = [
  'Blue Jackets', 'Red Wings', 'Maple Leafs', 'Golden Knights',
  'Trail Blazers', 'Red Sox', 'Blue Jays', 'White Sox',
  'Black Hawks', 'Blue Devils', 'Space Force',
];

function stripCityFromTeam(team) {
  const trimmed = team.trim();
  const words = trimmed.split(/\s+/);
  if (words.length <= 2) return trimmed;
  const lastTwo = words.slice(-2).join(' ');
  if (TWO_WORD_NICKNAMES.some(n => n.toLowerCase() === lastTwo.toLowerCase())) return lastTwo;
  return words[words.length - 1];
}

export function shortenTitle(title) {
  if (!title) return title;
  // Handle "Team A vs Team B" patterns
  const match = title.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  if (match) {
    return `${stripCityFromTeam(match[1])} vs ${stripCityFromTeam(match[2])}`;
  }
  // Single team name: strip city
  const words = title.trim().split(/\s+/);
  if (words.length <= 2) return title;
  return stripCityFromTeam(title);
}

export function getGameDateTime(shoot) {
  const gameTime = shoot?.game_time || shoot?.start_time;
  if (!shoot?.date || !gameTime) return null;
  const [year, month, day] = shoot.date.split('-').map(Number);
  const [h, m] = gameTime.split(':').map(Number);
  return new Date(year, month - 1, day, h, m, 0, 0);
}