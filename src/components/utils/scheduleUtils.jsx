import { isSchedulePhaseEnabled } from './schedulePhases';
import { formatHmInTz, getDisplayTimeZone, parseSourceDateTime } from '@/utils/timezone';

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
  return parseSourceDateTime(shoot.date, gameTime);
}

export function getScheduleDateTimes(shoot, rig) {
  const gameDate = getGameDateTime(shoot);
  if (!gameDate) {
    return {
      setup: null,
      pre_shoot: null,
      attention: null,
      sound: null,
      sound_trigger: null,
      game: null,
    };
  }

  const withOffset = (offsetMinutes) => {
    const d = new Date(gameDate);
    d.setMinutes(d.getMinutes() + Number(offsetMinutes || 0));
    return d;
  };

  const maybe = (phase, date) => (isSchedulePhaseEnabled(rig, phase) ? date : null);
  return {
    setup: maybe('setup', withOffset(rig?.setup_offset ?? shoot?.setup_offset ?? -150)),
    pre_shoot: maybe('pre_shoot', withOffset(rig?.pre_shoot_offset ?? shoot?.pre_shoot_offset ?? -120)),
    attention: maybe('attention', withOffset(rig?.attention_offset ?? shoot?.attention_offset ?? -30)),
    sound: maybe('sound', withOffset(rig?.sound_offset ?? shoot?.sound_offset ?? -30)),
    sound_trigger: maybe('sound_trigger', withOffset(rig?.sound_trigger_offset ?? shoot?.sound_trigger_offset ?? 10)),
    game: gameDate,
  };
}

export function getSchedule(shoot, rig) {
  const gameTime = shoot?.game_time || shoot?.start_time;
  if (!gameTime) return null;
  const dates = getScheduleDateTimes(shoot, rig);
  const tz = getDisplayTimeZone();
  const hm = (date) => (date ? formatHmInTz(date, tz) : null);
  return {
    setup: hm(dates.setup),
    pre_shoot: hm(dates.pre_shoot),
    attention: hm(dates.attention),
    sound: hm(dates.sound),
    sound_trigger: hm(dates.sound_trigger),
    game: hm(dates.game) || gameTime,
  };
}

export { shortenTitle } from '@/utils/shootTitles';
