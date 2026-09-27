export const DEFAULT_OFFSETS = {
  setup_offset: -150,
  pre_shoot_offset: -120,
  attention_offset: -30,
  sound_offset: -30,
  sound_trigger_offset: 10,
};

export const DEFAULT_GAME_DURATION_MINUTES = 150;

export function matchRig(shoot, rigSettings = []) {
  if (!shoot) return null;
  const client = String(shoot.client || '').toLowerCase().trim();
  const title = String(shoot.title || '').toLowerCase().trim();
  const hay = `${client} ${title}`.replace(/\s+/g, ' ').trim();
  const vs = hay.match(/(.+?)\s+vs\.?\s+(.+)/);
  const home = String(vs?.[1] || client || '').trim();

  let best = null;
  let bestScore = 0;
  for (const rig of rigSettings || []) {
    const team = String(rig.team || '').toLowerCase().trim();
    if (!team) continue;
    const last = team.split(/\s+/).pop();
    let score = 0;
    if (team === client || team === title) score = 100;
    else if (hay.includes(team)) score = 80 + team.length;
    else if (last && last.length >= 4 && hay.includes(last)) score = 40 + last.length;
    else continue;
    if (home && (home.includes(team) || team.includes(home) || (last.length >= 4 && home.includes(last)))) {
      score += 15;
    }
    if (score > bestScore) {
      best = rig;
      bestScore = score;
    }
  }
  return best;
}

export function offsetsFromRig(rig, shoot = {}) {
  return {
    setup_offset: Number(rig?.setup_offset ?? shoot?.setup_offset ?? DEFAULT_OFFSETS.setup_offset),
    pre_shoot_offset: Number(rig?.pre_shoot_offset ?? shoot?.pre_shoot_offset ?? DEFAULT_OFFSETS.pre_shoot_offset),
    attention_offset: Number(rig?.attention_offset ?? shoot?.attention_offset ?? DEFAULT_OFFSETS.attention_offset),
    sound_offset: Number(rig?.sound_offset ?? shoot?.sound_offset ?? DEFAULT_OFFSETS.sound_offset),
    sound_trigger_offset: Number(rig?.sound_trigger_offset ?? shoot?.sound_trigger_offset ?? DEFAULT_OFFSETS.sound_trigger_offset),
  };
}

export function resolveShootLocation(shoot, rig) {
  return shoot?.location || rig?.location || '';
}

export function expectedGameEnd(shoot, rig) {
  const gameTime = shoot?.game_time || shoot?.start_time;
  if (!shoot?.date || !gameTime) return null;
  const [year, month, day] = shoot.date.split('-').map(Number);
  const [h, m] = gameTime.split(':').map(Number);
  const start = new Date(year, month - 1, day, h, m, 0, 0);
  const duration = Number(rig?.game_duration_minutes ?? DEFAULT_GAME_DURATION_MINUTES);
  return new Date(start.getTime() + duration * 60 * 1000);
}

export const SHOOT_COMPLETE_REMINDER_LEAD_MINUTES = 20;

export function isShootIncomplete(shoot) {
  const status = String(shoot?.status || '').toLowerCase();
  if (status === 'completed' || status === 'cancelled' || status === 'postponed') return false;
  if (shoot?.phase_status?.shoot_complete) return false;
  return true;
}

export function shootCompleteReminderDue(shoot, rig, now = new Date()) {
  if (!isShootIncomplete(shoot)) return null;
  const end = expectedGameEnd(shoot, rig);
  if (!end) return null;
  const remindAt = new Date(end.getTime() - SHOOT_COMPLETE_REMINDER_LEAD_MINUTES * 60 * 1000);
  const expireAt = new Date(end.getTime() + 6 * 60 * 60 * 1000);
  if (now < remindAt || now > expireAt) return null;
  return { end, remindAt };
}

export const RIG_SECTION_LABELS = {
  data: 'Data Settings',
  outdoor_day: 'Outdoor Day Settings',
  outdoor_night: 'Outdoor Night Settings',
  attention: 'Attention Settings',
  indoor: 'Indoor Settings',
  sound: 'Sound Recording',
  sound_trigger: 'Sound Trigger',
};
