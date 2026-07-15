import { db, getSetting } from '../db.js';
import { normalizeEmail } from '../middleware/auth.js';

export const AUTO_APPROVE_LIMIT = 6;
export const PHASE_ORDER = [
  'setup_complete',
  'pre_shoot_started',
  'attention_started',
  'sound_started',
  'shoot_complete',
];

export const PHASE_LABELS = {
  setup_complete: 'Setup Complete',
  pre_shoot_started: 'Pre-Shoot Started',
  attention_started: 'Attention Started',
  sound_started: 'Sound Started',
  shoot_complete: 'Shoot Complete',
};

export function todayStr(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = String(timeStr).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function getRigSettingForShoot(shoot) {
  if (!shoot?.client && !shoot?.title) return null;
  const team = shoot.client || shoot.title;
  return db.prepare(
    'SELECT * FROM rig_settings WHERE team = ? COLLATE NOCASE'
  ).get(team) || null;
}

export function parseRigCam(json) {
  if (!json) return null;
  try {
    return typeof json === 'string' ? JSON.parse(json) : json;
  } catch {
    return null;
  }
}

export function formatRigRecipe(rig) {
  if (!rig) return null;
  return {
    team: rig.team,
    venueType: rig.venue_type,
    sport: rig.sport,
    rigType: rig.rig_type,
    shootPlan: rig.shoot_plan,
    remoteRigs: rig.remote_rigs ? JSON.parse(rig.remote_rigs) : [],
    dataEnabled: !!rig.data_enabled,
    dataHd: parseRigCam(rig.data_hd),
    dataWide: parseRigCam(rig.data_wide),
    attentionEnabled: !!rig.attention_enabled,
    attentionHd: parseRigCam(rig.attention_hd),
    soundEnabled: !!rig.sound_enabled,
    notes: rig.notes,
  };
}

export function getAssignmentsForShoot(shootId) {
  return db.prepare(
    `SELECT * FROM shoot_assignments WHERE shoot_id = ? ORDER BY created_at`
  ).all(shootId);
}

export function getPhasesForShoot(shootId) {
  const rows = db.prepare(
    'SELECT phase, completed_at, completed_by FROM shoot_phases WHERE shoot_id = ?'
  ).all(shootId);
  const map = {};
  for (const r of rows) {
    map[r.phase] = { at: r.completed_at, by: r.completed_by };
  }
  return map;
}

export function serializeShoot(shoot, { email = null } = {}) {
  const assignments = getAssignmentsForShoot(shoot.id);
  const phases = getPhasesForShoot(shoot.id);
  const rig = formatRigRecipe(getRigSettingForShoot(shoot));
  const pending = assignments.filter((a) => a.state === 'pending').map((a) => a.operator_email);
  const assigned = assignments.filter((a) => a.state === 'assigned').map((a) => a.operator_email);
  const preApproved = assignments.filter((a) => a.state === 'pre_approved').map((a) => a.operator_email);
  const autoPaired = assignments.filter((a) => a.auto_paired).map((a) => a.operator_email);

  let myState = null;
  if (email) {
    const mine = assignments.filter((a) => normalizeEmail(a.operator_email) === normalizeEmail(email));
    if (mine.some((a) => a.state === 'assigned')) myState = 'assigned';
    else if (mine.some((a) => a.state === 'pending')) myState = 'pending';
    else if (mine.some((a) => a.state === 'pre_approved')) myState = 'pre_approved';
  }

  return {
    id: shoot.id,
    title: shoot.title,
    client: shoot.client,
    location: shoot.location,
    date: shoot.date,
    gameTime: shoot.game_time,
    setupOffset: shoot.setup_offset,
    preShootOffset: shoot.pre_shoot_offset,
    attentionOffset: shoot.attention_offset,
    soundOffset: shoot.sound_offset,
    status: shoot.status,
    notes: shoot.notes,
    standbyAdmin: shoot.standby_admin,
    pendingOperators: pending,
    assignedOperators: assigned,
    preApprovedOperators: preApproved,
    autoPairedFor: autoPaired,
    phases,
    nextPhase: getNextPhase(phases, rig),
    myState,
    rig,
  };
}

export function visiblePhases(rig) {
  return PHASE_ORDER.filter((phase) => {
    if (phase === 'attention_started') return !!rig?.attentionEnabled;
    if (phase === 'sound_started') return !!rig?.soundEnabled;
    return true;
  });
}

export function getNextPhase(phases, rig) {
  const visible = visiblePhases(rig);
  for (const phase of visible) {
    if (!phases[phase]) return phase;
  }
  return null;
}

export function getPreApprovedCount(email, excludeShootId = null) {
  const today = todayStr();
  const e = normalizeEmail(email);
  const rows = db.prepare(`
    SELECT sa.shoot_id
    FROM shoot_assignments sa
    JOIN shoots s ON s.id = sa.shoot_id
    WHERE sa.operator_email = ?
      AND sa.state = 'pre_approved'
      AND s.date >= ?
      AND s.status NOT IN ('cancelled', 'completed')
      ${excludeShootId ? 'AND sa.shoot_id != ?' : ''}
  `).all(...(excludeShootId ? [e, today, excludeShootId] : [e, today]));
  return rows.length;
}

function isLinkedTeam(shoot, autoAssignTeams) {
  const label = `${shoot.client || ''} ${shoot.title || ''}`.toLowerCase();
  return autoAssignTeams.some((t) => label.includes(String(t).toLowerCase()));
}

function isShootAvailableForAutoAssign(shootId) {
  const count = db.prepare(`
    SELECT COUNT(*) AS c FROM shoot_assignments
    WHERE shoot_id = ? AND state IN ('assigned', 'pending')
  `).get(shootId).c;
  return count === 0;
}

export function findPairedShoot(shoot) {
  const autoAssignTeams = getSetting('auto_assign_teams', ['Reds', 'Red Sox', 'Rangers']);
  const windowMinutes = getSetting('auto_assign_window_minutes', 120);
  if (!autoAssignTeams?.length) return null;

  const all = db.prepare(`
    SELECT * FROM shoots
    WHERE date = ? AND id != ? AND status NOT IN ('cancelled', 'completed')
  `).all(shoot.date, shoot.id);

  const shootMins = timeToMinutes(shoot.game_time);
  const clickedIsLinked = isLinkedTeam(shoot, autoAssignTeams);

  const nearby = all.filter((s) =>
    isShootAvailableForAutoAssign(s.id) &&
    Math.abs(timeToMinutes(s.game_time) - shootMins) <= windowMinutes
  );

  const linkedNearby = nearby.filter((s) => isLinkedTeam(s, autoAssignTeams));

  if (!clickedIsLinked) {
    if (linkedNearby.length >= 2) return null;
    if (linkedNearby.length === 1) return linkedNearby[0];
    return null;
  }

  if (linkedNearby.length > 0) {
    linkedNearby.sort(
      (a, b) =>
        Math.abs(timeToMinutes(a.game_time) - shootMins) -
        Math.abs(timeToMinutes(b.game_time) - shootMins)
    );
    return linkedNearby[0];
  }

  const nonLinked = nearby.filter((s) => !isLinkedTeam(s, autoAssignTeams));
  if (!nonLinked.length) return null;
  nonLinked.sort(
    (a, b) =>
      Math.abs(timeToMinutes(a.game_time) - shootMins) -
      Math.abs(timeToMinutes(b.game_time) - shootMins)
  );
  return nonLinked[0];
}

export function addAssignment(shootId, email, state, { autoPaired = false, pairedShootId = null } = {}) {
  const id = crypto.randomUUID();
  db.prepare(`
    INSERT INTO shoot_assignments (id, shoot_id, operator_email, state, auto_paired, paired_shoot_id)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(shoot_id, operator_email, state) DO NOTHING
  `).run(id, shootId, normalizeEmail(email), state, autoPaired ? 1 : 0, pairedShootId);
  return id;
}

export function removeOperatorFromShoot(shootId, email) {
  db.prepare(`
    DELETE FROM shoot_assignments WHERE shoot_id = ? AND operator_email = ?
  `).run(shootId, normalizeEmail(email));
}

export function operatorOnShoot(shootId, email) {
  return db.prepare(`
    SELECT * FROM shoot_assignments
    WHERE shoot_id = ? AND operator_email = ?
  `).all(shootId, normalizeEmail(email));
}

export function canAdvancePhase(shoot, phase, user) {
  const onShoot = operatorOnShoot(shoot.id, user.email);
  const isAssigned = onShoot.some((a) => a.state === 'assigned');
  if (user.role === 'admin' || user.role === 'standby') return true;
  if (user.role === 'user' && isAssigned) return true;
  return false;
}

export function assertPhaseOrder(shootId, phase, rig) {
  const visible = visiblePhases(rig);
  if (!visible.includes(phase)) {
    const err = new Error(`Phase ${phase} not available for this rig`);
    err.status = 400;
    throw err;
  }
  const phases = getPhasesForShoot(shootId);
  if (phases[phase]) {
    const err = new Error(`Phase ${phase} already completed`);
    err.status = 409;
    throw err;
  }
  const idx = visible.indexOf(phase);
  for (let i = 0; i < idx; i++) {
    if (!phases[visible[i]]) {
      const err = new Error(`Complete ${PHASE_LABELS[visible[i]]} before ${PHASE_LABELS[phase]}`);
      err.status = 400;
      throw err;
    }
  }
}

export function phaseMessage(shoot, phase) {
  const team = shoot.client || shoot.title;
  const label = PHASE_LABELS[phase] || phase;
  const templates = getSetting('phase_messages', {});
  const custom = templates[phase];
  if (custom) {
    return custom.replaceAll('{team}', team).replaceAll('{label}', label);
  }
  return `${label} — ${team}`;
}

export function shootCueTimes(shoot) {
  const gameMins = timeToMinutes(shoot.game_time || shoot.gameTime);
  const toClock = (offset) => {
    const total = ((gameMins + offset) % (24 * 60) + 24 * 60) % (24 * 60);
    const h = Math.floor(total / 60);
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };
  return {
    setupAt: toClock(shoot.setup_offset ?? shoot.setupOffset ?? -150),
    preShootAt: toClock(shoot.pre_shoot_offset ?? shoot.preShootOffset ?? -120),
    attentionAt: toClock(shoot.attention_offset ?? shoot.attentionOffset ?? -30),
    soundAt: toClock(shoot.sound_offset ?? shoot.soundOffset ?? -30),
    gameAt: shoot.game_time || shoot.gameTime,
  };
}
