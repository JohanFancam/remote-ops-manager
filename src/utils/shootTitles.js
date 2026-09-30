import { isManualShootTitle } from './assignmentLock.js';

const KEEP_FULL_TEAMS = ['Charlotte FC', 'KC Current', 'Kansas City Current'];
const TWO_WORD_NICKNAMES = [
  'Blue Jackets', 'Red Wings', 'Maple Leafs', 'Golden Knights',
  'Trail Blazers', 'Red Sox', 'Blue Jays', 'White Sox',
  'Black Hawks', 'Blue Devils', 'Space Force', 'Football Club',
];

function isExempt(team) {
  return KEEP_FULL_TEAMS.some((e) => e.toLowerCase() === team.trim().toLowerCase());
}

function stripCityFromTeam(team) {
  const trimmed = team.trim();
  if (!trimmed) return trimmed;
  if (isExempt(trimmed)) return trimmed;

  const fcMatch = trimmed.match(/^(.+?)\s+Football Club$/i);
  if (fcMatch) return fcMatch[1];

  const words = trimmed.split(/\s+/);
  if (words.length === 1) return trimmed;

  const lastTwo = words.length >= 2 ? words.slice(-2).join(' ') : '';
  const isTwoWordNickname = TWO_WORD_NICKNAMES.some((n) => n.toLowerCase() === lastTwo.toLowerCase());

  if (words.length >= 3 && isTwoWordNickname) return lastTwo;
  if (words.length === 2 && isTwoWordNickname) return trimmed;
  return words[words.length - 1];
}

/** Calendar tiles shorten city+team. Manual games keep the full stored title. */
export function shortenTitle(title) {
  if (!title) return title;
  if (isManualShootTitle(title)) return String(title);
  if (isExempt(title)) return title;
  const match = title.match(/^(.+?)\s+vs\.?\s+(.+)$/i);
  if (match) {
    return `${stripCityFromTeam(match[1])} vs ${stripCityFromTeam(match[2])}`;
  }
  return stripCityFromTeam(title);
}
