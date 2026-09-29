/**
 * Put back shoots Google sync hard-deleted, with the operators who were on them.
 *
 * Sources (best first):
 * 1. data/deleted-shoots.json snapshots (written before later deletes)
 * 2. lastSyncChanges deleted/duplicate rows
 * 3. ShootNotification google_sync_delete rows
 * 4. assigned / approved / day_of / starting_soon notifications for those shoot ids
 */
import { listEntities, restoreEntity, updateEntity } from './entities.js';
import { getGoogleSettings, saveGoogleSettings } from './googleCalendar.js';
import { readDeletedShootArchive } from './shootArchive.js';
import { normalizeGameTime, titlesAreEquivalent } from './shootTitleMatch.js';

const ASSIGN_IN_TYPES = new Set(['assigned', 'approved', 'day_of', 'starting_soon']);
const RESTORE_SETTING_KEY = 'sync_delete_restore_at';

function normEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function uniqueEmails(list = []) {
  return [...new Set((list || []).map(normEmail).filter(Boolean))];
}

function hintKey(hint) {
  return `${hint.shootId || ''}|${hint.date || ''}|${String(hint.title || '').trim().toLowerCase()}`;
}

export function recoverAssigneesFromNotifications(notifications = [], {
  shootId = '',
  title = '',
  date = '',
} = {}) {
  const related = (notifications || []).filter((note) => {
    if (shootId && note.shoot_id === shootId) return true;
    if (title && date && note.shoot_date === date && titlesAreEquivalent(note.shoot_title || '', title)) {
      return true;
    }
    return false;
  });
  related.sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));

  const status = new Map();
  for (const note of related) {
    for (const email of uniqueEmails(note.assigned_operators || [])) {
      status.set(email, 'in');
    }
    const email = normEmail(note.target_user_email);
    if (!email) continue;
    if (ASSIGN_IN_TYPES.has(note.type)) status.set(email, 'in');
    if (note.type === 'unassigned') status.set(email, 'out');
    if (note.type === 'schedule_change' || note.type === 'cancelled') {
      if (!status.has(email)) status.set(email, 'in');
    }
  }
  return [...status.entries()].filter(([, value]) => value === 'in').map(([email]) => email).slice(0, 1);
}

export function collectDeletedShootHints({
  lastSyncChanges = [],
  notifications = [],
  archive = [],
} = {}) {
  const hints = [];

  for (const item of archive || []) {
    const shoot = item?.shoot;
    if (!shoot?.title || !shoot.date) continue;
    hints.push({
      shootId: shoot.id || '',
      title: shoot.title,
      date: shoot.date,
      time: shoot.game_time || shoot.start_time || '',
      calendar: shoot.google_calendar_label || '',
      assigned: uniqueEmails(shoot.assigned_operators),
      pending: uniqueEmails(shoot.pending_operators),
      snapshot: shoot,
    });
  }

  for (const note of notifications || []) {
    const key = String(note.notification_key || '');
    const isDelete = note.type === 'google_sync'
      && (note.title === 'Shoot removed from calendar' || key.startsWith('google_sync_delete:'));
    if (!isDelete || !note.shoot_title || !note.shoot_date) continue;
    hints.push({
      shootId: note.shoot_id || (key.startsWith('google_sync_delete:') ? key.split(':')[1] : ''),
      title: note.shoot_title,
      date: note.shoot_date,
      time: note.shoot_time || '',
      assigned: uniqueEmails(note.assigned_operators),
    });
  }

  for (const change of lastSyncChanges || []) {
    if (change.action !== 'deleted' && change.action !== 'duplicate') continue;
    if (!change.title || !change.date) continue;
    hints.push({
      shootId: change.shootId || '',
      title: change.title,
      date: change.date,
      time: change.time || '',
      calendar: change.calendar || '',
      assigned: uniqueEmails(change.assigned_operators),
    });
  }

  const seen = new Set();
  const merged = [];
  for (const hint of hints) {
    const key = hint.shootId || hintKey(hint);
    if (seen.has(key)) {
      const existing = merged.find((item) => (item.shootId && item.shootId === hint.shootId) || hintKey(item) === hintKey(hint));
      if (existing && !existing.snapshot && hint.snapshot) existing.snapshot = hint.snapshot;
      if (existing && !existing.assigned.length && hint.assigned.length) existing.assigned = hint.assigned;
      continue;
    }
    seen.add(key);
    merged.push({ ...hint, assigned: hint.assigned || [], pending: hint.pending || [] });
  }
  return merged;
}

export function findLivingMatch(shoots, hint) {
  const list = shoots || [];
  if (hint.shootId) {
    const byId = list.find((shoot) => shoot.id === hint.shootId);
    if (byId) return byId;
  }
  const sameDate = list.filter((shoot) => (
    shoot.date === hint.date && titlesAreEquivalent(shoot.title, hint.title)
  ));
  if (sameDate.length === 1) return sameDate[0];
  if (sameDate.length > 1 && hint.time) {
    const wanted = normalizeGameTime(hint.time);
    const timed = sameDate.filter((shoot) => (
      normalizeGameTime(shoot.game_time || shoot.start_time) === wanted
    ));
    if (timed.length === 1) return timed[0];
  }
  return sameDate[0] || null;
}

function resolveAssignees(hint, notifications) {
  const fromHint = uniqueEmails(hint.assigned);
  if (fromHint.length) return fromHint.slice(0, 1);
  return recoverAssigneesFromNotifications(notifications, {
    shootId: hint.shootId,
    title: hint.title,
    date: hint.date,
  });
}

function upsertRestoreSetting(value) {
  const settings = listEntities('AppSettings', null, 500);
  const existing = settings.find((row) => row.key === RESTORE_SETTING_KEY);
  if (existing) return updateEntity('AppSettings', existing.id, { value });
  return restoreEntity('AppSettings', {
    key: RESTORE_SETTING_KEY,
    value,
    description: 'When Google sync delete restore last ran',
  });
}

/**
 * Recreate missing shoots and put recovered operators back.
 * Idempotent: living title+date matches are updated only when they have no assignee.
 */
export function restoreSyncDeletedShoots({ force = false } = {}) {
  const settings = listEntities('AppSettings', null, 500);
  const already = settings.find((row) => row.key === RESTORE_SETTING_KEY)?.value;
  if (already && !force) {
    return { skipped: true, restoredAt: already, recreated: 0, reassigned: 0, hints: 0 };
  }

  const notifications = listEntities('ShootNotification', '-created_at', 8000);
  const archive = readDeletedShootArchive();
  const lastSyncChanges = getGoogleSettings().lastSyncChanges || [];
  const hints = collectDeletedShootHints({ lastSyncChanges, notifications, archive });

  let recreated = 0;
  let reassigned = 0;
  const details = [];

  for (const hint of hints) {
    const livingShoots = listEntities('Shoot', '-date', 5000);
    const living = findLivingMatch(livingShoots, hint);
    const assignees = resolveAssignees(hint, notifications);

    if (living) {
      const current = uniqueEmails(living.assigned_operators);
      if (!current.length && assignees.length) {
        updateEntity('Shoot', living.id, { assigned_operators: assignees, pending_operators: [] });
        reassigned += 1;
        details.push({ action: 'reassigned', id: living.id, title: living.title, date: living.date, assigned: assignees });
      }
      continue;
    }

    const snapshot = hint.snapshot || {};
    const created = restoreEntity('Shoot', {
      id: hint.shootId || undefined,
      title: snapshot.title || hint.title,
      client: snapshot.client || '',
      location: snapshot.location || '',
      date: snapshot.date || hint.date,
      game_time: snapshot.game_time || hint.time || '',
      start_time: snapshot.start_time || snapshot.game_time || hint.time || '',
      status: snapshot.status && snapshot.status !== 'cancelled' ? snapshot.status : 'upcoming',
      description: snapshot.description || '',
      assigned_operators: assignees,
      pending_operators: assignees.length ? [] : uniqueEmails(hint.pending || snapshot.pending_operators),
      pre_approved_operators: snapshot.pre_approved_operators || [],
      auto_assigned_for: snapshot.auto_assigned_for || [],
      phase_status: snapshot.phase_status || {},
      assignment_locked: snapshot.assignment_locked || false,
      rig_type_override: snapshot.rig_type_override || '',
      google_event_id: snapshot.google_event_id || '',
      google_calendar_id: snapshot.google_calendar_id || '',
      google_calendar_label: snapshot.google_calendar_label || hint.calendar || '',
      last_synced_at: snapshot.last_synced_at || '',
      source: snapshot.source || 'google_calendar',
      google_sync_cancelled: false,
      google_sync_flag: 'restored',
      setup_offset: snapshot.setup_offset ?? -150,
      pre_shoot_offset: snapshot.pre_shoot_offset ?? -120,
      attention_offset: snapshot.attention_offset ?? -30,
      sound_offset: snapshot.sound_offset ?? -30,
      notes: snapshot.notes || '',
      rate: snapshot.rate,
      rate_type: snapshot.rate_type,
      live_data: snapshot.live_data,
      game_pk: snapshot.game_pk || '',
      backbone_id: snapshot.backbone_id || '',
    });
    if (created) {
      recreated += 1;
      details.push({
        action: 'recreated',
        id: created.id,
        title: created.title,
        date: created.date,
        assigned: created.assigned_operators || [],
      });
    }
  }

  const restoredAt = new Date().toISOString();
  upsertRestoreSetting(restoredAt);
  if (recreated || reassigned) {
    saveGoogleSettings({
      lastRestoreAt: restoredAt,
      lastRestoreStats: { recreated, reassigned, hints: hints.length },
    });
  }

  return { skipped: false, restoredAt, recreated, reassigned, hints: hints.length, details };
}

export function peekRestorePlan() {
  const notifications = listEntities('ShootNotification', '-created_at', 8000);
  const archive = readDeletedShootArchive();
  const lastSyncChanges = getGoogleSettings().lastSyncChanges || [];
  const hints = collectDeletedShootHints({ lastSyncChanges, notifications, archive });
  const living = listEntities('Shoot', '-date', 5000);
  return hints.map((hint) => ({
    ...hint,
    livingId: findLivingMatch(living, hint)?.id || '',
    recoveredAssignees: resolveAssignees(hint, notifications),
    snapshot: undefined,
  }));
}
