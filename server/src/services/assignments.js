import {
  db,
  withTransaction,
  getSetting,
  newId,
  nowIso,
  todayStr,
  timeToMinutes,
} from '../db.js';
import { ROLES, normalizeRole } from '../permissions.js';

export class AssignmentError extends Error {
  constructor(message, { status = 400, code = 'ASSIGNMENT_ERROR', warnings = [] } = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.warnings = warnings;
  }
}

function audit({ shootId, operatorId, action, performedBy, previousState, newState }) {
  db.prepare(`
    INSERT INTO assignment_audit
      (id, shoot_id, operator_id, action, performed_by, previous_state, new_state, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    newId(),
    shootId,
    operatorId,
    action,
    performedBy,
    previousState ? JSON.stringify(previousState) : null,
    newState ? JSON.stringify(newState) : null,
    nowIso()
  );
}

function notify({ recipientUserId, type, title, message, relatedShootId }) {
  const leadHours = getSetting('notification_lead_hours', 48);
  const expires = new Date(Date.now() + leadHours * 3600 * 1000).toISOString();
  db.prepare(`
    INSERT INTO notifications
      (id, recipient_user_id, type, title, message, related_shoot_id, read, created_at, expires_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)
  `).run(newId(), recipientUserId, type, title, message, relatedShootId || null, nowIso(), expires);
}

export function getPreApproveLimit() {
  return Number(getSetting('pre_approved_limit', 6));
}

export function getAutoPairTeams() {
  return getSetting('auto_pair_teams', ['Reds', 'Red Sox', 'Rangers']);
}

export function getAutoPairWindowMinutes() {
  return Number(getSetting('auto_pair_window_minutes', 120));
}

export function getAutoPairEligibleIds() {
  return getSetting('auto_pair_eligible_operator_ids', null); // null = all operators
}

export function countPreApprovedFuture(operatorId, excludeShootId = null) {
  const today = todayStr();
  const rows = db.prepare(`
    SELECT a.shoot_id
    FROM assignments a
    JOIN shoots s ON s.id = a.shoot_id
    WHERE a.operator_id = ?
      AND a.status = 'assigned'
      AND a.is_pre_approved = 1
      AND s.date >= ?
      AND s.status NOT IN ('cancelled', 'completed')
      ${excludeShootId ? 'AND a.shoot_id != ?' : ''}
  `).all(...(excludeShootId ? [operatorId, today, excludeShootId] : [operatorId, today]));
  return rows.length;
}

function getShoot(id) {
  return db.prepare('SELECT * FROM shoots WHERE id = ?').get(id);
}

function getUser(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

function activeAssignmentsOnShoot(shootId) {
  return db.prepare(`
    SELECT * FROM assignments
    WHERE shoot_id = ? AND status IN ('assigned', 'pending')
  `).all(shootId);
}

function operatorAssignment(shootId, operatorId) {
  return db.prepare(`
    SELECT * FROM assignments WHERE shoot_id = ? AND operator_id = ?
  `).get(shootId, operatorId);
}

function isUnavailable(operatorId, date) {
  const row = db.prepare(`
    SELECT 1 FROM operator_availability
    WHERE operator_id = ? AND date = ? AND unavailable = 1
  `).get(operatorId, date);
  return !!row;
}

function hasConflict(operatorId, shoot, excludeShootId = null) {
  const windowMins = getAutoPairWindowMinutes();
  const shootMins = timeToMinutes(shoot.game_time);
  const others = db.prepare(`
    SELECT s.*
    FROM assignments a
    JOIN shoots s ON s.id = a.shoot_id
    WHERE a.operator_id = ?
      AND a.status IN ('assigned', 'pending')
      AND s.date = ?
      AND s.status NOT IN ('cancelled', 'completed')
      ${excludeShootId ? 'AND s.id != ?' : ''}
  `).all(...(excludeShootId ? [operatorId, shoot.date, excludeShootId] : [operatorId, shoot.date]));

  return others.filter((s) => {
    if (s.id === shoot.id) return false;
    return Math.abs(timeToMinutes(s.game_time) - shootMins) < windowMins;
  });
}

function isPriorityTeam(shoot, teams = getAutoPairTeams()) {
  const name = `${shoot.team_name || ''} ${shoot.title || ''}`.toLowerCase();
  return teams.some((t) => name.includes(String(t).toLowerCase()));
}

function shootAvailableForPair(shootId) {
  return activeAssignmentsOnShoot(shootId).length === 0;
}

/**
 * Find partner shoot for auto-pair.
 * Priority: two priority teams pair first; non-priority only if exactly one priority nearby.
 */
export function findPairPartner(shoot) {
  const teams = getAutoPairTeams();
  const windowMinutes = getAutoPairWindowMinutes();
  if (!teams?.length) return null;

  const all = db.prepare(`
    SELECT * FROM shoots
    WHERE date = ? AND id != ? AND status NOT IN ('cancelled', 'completed')
  `).all(shoot.date, shoot.id);

  const shootMins = timeToMinutes(shoot.game_time);
  const nearby = all.filter(
    (s) =>
      shootAvailableForPair(s.id) &&
      Math.abs(timeToMinutes(s.game_time) - shootMins) <= windowMinutes
  );

  const priorityNearby = nearby
    .filter((s) => isPriorityTeam(s, teams))
    .sort(
      (a, b) =>
        Math.abs(timeToMinutes(a.game_time) - shootMins) -
        Math.abs(timeToMinutes(b.game_time) - shootMins)
    );

  const clickedPriority = isPriorityTeam(shoot, teams);

  if (clickedPriority) {
    if (priorityNearby.length > 0) return priorityNearby[0];
    // No other priority — may pair with closest non-priority available
    const nonPri = nearby
      .filter((s) => !isPriorityTeam(s, teams))
      .sort(
        (a, b) =>
          Math.abs(timeToMinutes(a.game_time) - shootMins) -
          Math.abs(timeToMinutes(b.game_time) - shootMins)
      );
    return nonPri[0] || null;
  }

  // Clicked non-priority: only pair if exactly one priority nearby
  if (priorityNearby.length === 1) return priorityNearby[0];
  return null;
}

function insertAssignment({
  shootId,
  operatorId,
  status,
  source,
  assignmentGroupId = null,
  isPreApproved = false,
  isAdditional = false,
  assignedBy = null,
  approvedBy = null,
}) {
  const id = newId();
  const ts = nowIso();
  db.prepare(`
    INSERT INTO assignments (
      id, shoot_id, operator_id, status, source, assignment_group_id,
      is_pre_approved, is_additional, assigned_by, approved_by, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(shoot_id, operator_id) DO UPDATE SET
      status = excluded.status,
      source = excluded.source,
      assignment_group_id = excluded.assignment_group_id,
      is_pre_approved = excluded.is_pre_approved,
      is_additional = excluded.is_additional,
      assigned_by = COALESCE(excluded.assigned_by, assignments.assigned_by),
      approved_by = COALESCE(excluded.approved_by, assignments.approved_by),
      updated_at = excluded.updated_at
  `).run(
    id,
    shootId,
    operatorId,
    status,
    source,
    assignmentGroupId,
    isPreApproved ? 1 : 0,
    isAdditional ? 1 : 0,
    assignedBy,
    approvedBy,
    ts,
    ts
  );
  return id;
}

function operatorEligibleForAutoPair(operatorId) {
  const eligible = getAutoPairEligibleIds();
  if (eligible == null) return true;
  if (!Array.isArray(eligible)) return true;
  return eligible.includes(operatorId);
}

/**
 * Operator self-assignment (with optional auto-pair).
 */
export function selfAssign({ operatorId, shootId, actorId }) {
  return withTransaction(() => {
    const operator = getUser(operatorId);
    if (!operator || !operator.active || normalizeRole(operator.role) !== ROLES.OPERATOR) {
      throw new AssignmentError('Only active operators can self-assign', { status: 403 });
    }
    const shoot = getShoot(shootId);
    if (!shoot) throw new AssignmentError('Shoot not found', { status: 404 });
    if (shoot.status === 'cancelled' || shoot.status === 'completed') {
      throw new AssignmentError('Shoot is not available');
    }

    const existing = operatorAssignment(shootId, operatorId);
    if (existing && (existing.status === 'assigned' || existing.status === 'pending')) {
      throw new AssignmentError('Already requested or assigned on this shoot', {
        status: 409,
        code: 'DUPLICATE',
      });
    }

    if (isUnavailable(operatorId, shoot.date)) {
      throw new AssignmentError('You are marked unavailable on this date', {
        code: 'UNAVAILABLE',
      });
    }

    const conflicts = hasConflict(operatorId, shoot, shootId);
    // Overlaps with non-pairable shoots block; pair partner is handled separately
    const hardConflicts = conflicts.filter((c) => {
      // allow conflict if it would be the auto-pair partner
      return true;
    });
    // For self-assign we block on any overlapping assigned/pending unless it's empty partner slot
    if (hardConflicts.length) {
      // Soft: still allow if only potential pair? Spec says check unacceptable overlapping.
      throw new AssignmentError('Overlapping shoot conflict', {
        code: 'CONFLICT',
        warnings: hardConflicts.map((c) => ({ shootId: c.id, title: c.title })),
      });
    }

    const othersOnShoot = activeAssignmentsOnShoot(shootId).filter(
      (a) => a.operator_id !== operatorId
    );
    // Single-operator shoots (v1 default): block if someone else assigned/pending
    if (othersOnShoot.some((a) => a.status === 'assigned')) {
      throw new AssignmentError('Shoot already assigned to another operator');
    }
    if (othersOnShoot.some((a) => a.status === 'pending')) {
      throw new AssignmentError('Shoot already has a pending request');
    }

    const preCount = countPreApprovedFuture(operatorId, shootId);
    const limit = getPreApproveLimit();
    const withinCap = preCount < limit;

    let partner = null;
    if (operatorEligibleForAutoPair(operatorId)) {
      partner = findPairPartner(shoot);
      // If partner unavailable for conflicting reasons, assign selected only
      if (partner && !shootAvailableForPair(partner.id)) {
        partner = null;
      }
      // Partner may become conflict for operator — if they already have that shoot, skip pair
      if (partner) {
        const onPartner = operatorAssignment(partner.id, operatorId);
        if (onPartner && (onPartner.status === 'assigned' || onPartner.status === 'pending')) {
          partner = null;
        }
        // Cap: pairing creates an additional assignment — count it for cap only as assigned+preapproved on primary
        // Spec: count paired shoots consistently. Both get is_pre_approved when within cap; paired is also is_additional.
        if (withinCap && partner) {
          // secondary doesn't count toward the 6 pre-approved limit in old logic if auto; but pre_approved was on both or primary only?
          // Keep: primary is pre-approved; pair is assigned with is_additional + is_pre_approved=0 OR also pre-approved?
          // Old code: only primary got pre_approved; pair was auto_assigned. Cap counts pre_approved only.
        }
      }
    }

    const groupId = partner ? newId() : null;
    const prev = existing || null;

    if (withinCap) {
      insertAssignment({
        shootId,
        operatorId,
        status: 'assigned',
        source: partner ? 'auto_pair' : 'self',
        assignmentGroupId: groupId,
        isPreApproved: true,
        isAdditional: false,
        assignedBy: actorId || operatorId,
      });
      if (partner) {
        insertAssignment({
          shootId: partner.id,
          operatorId,
          status: 'assigned',
          source: 'auto_pair',
          assignmentGroupId: groupId,
          isPreApproved: false,
          isAdditional: true,
          assignedBy: actorId || operatorId,
        });
      }
      audit({
        shootId,
        operatorId,
        action: partner ? 'self_assign_paired' : 'self_assign',
        performedBy: actorId || operatorId,
        previousState: prev,
        newState: { status: 'assigned', groupId, partnerId: partner?.id },
      });
      notify({
        recipientUserId: operatorId,
        type: 'assignment_approved',
        title: 'Assignment confirmed',
        message: partner
          ? `Assigned to ${shoot.title} and paired ${partner.title}`
          : `Assigned to ${shoot.title}`,
        relatedShootId: shootId,
      });
      return {
        status: 'assigned',
        paired: partner ? { id: partner.id, title: partner.title, teamName: partner.team_name } : null,
        assignmentGroupId: groupId,
        preApprovedCount: preCount + 1,
        limit,
      };
    }

    // Over cap → pending (and pending pair if available)
    insertAssignment({
      shootId,
      operatorId,
      status: 'pending',
      source: partner ? 'auto_pair' : 'self',
      assignmentGroupId: groupId,
      isPreApproved: false,
      assignedBy: actorId || operatorId,
    });
    if (partner) {
      insertAssignment({
        shootId: partner.id,
        operatorId,
        status: 'pending',
        source: 'auto_pair',
        assignmentGroupId: groupId,
        isPreApproved: false,
        isAdditional: true,
        assignedBy: actorId || operatorId,
      });
    }
    audit({
      shootId,
      operatorId,
      action: 'self_assign_pending',
      performedBy: actorId || operatorId,
      previousState: prev,
      newState: { status: 'pending', groupId, partnerId: partner?.id },
    });
    return {
      status: 'pending',
      reason: 'Pre-approved assignment limit reached',
      paired: partner ? { id: partner.id, title: partner.title, teamName: partner.team_name } : null,
      assignmentGroupId: groupId,
      preApprovedCount: preCount,
      limit,
    };
  });
}

/**
 * Admin manual assignment — never triggers auto-pair.
 */
export function adminAssign({
  shootId,
  operatorId,
  adminId,
  override = false,
}) {
  return withTransaction(() => {
    const admin = getUser(adminId);
    if (!admin || normalizeRole(admin.role) !== ROLES.ADMIN) {
      throw new AssignmentError('Admin only', { status: 403 });
    }
    const operator = getUser(operatorId);
    if (!operator || !operator.active) {
      throw new AssignmentError('Operator is inactive or missing');
    }
    if (normalizeRole(operator.role) !== ROLES.OPERATOR) {
      throw new AssignmentError('Target must be an operator');
    }
    const shoot = getShoot(shootId);
    if (!shoot) throw new AssignmentError('Shoot not found', { status: 404 });
    if (shoot.status === 'cancelled' || shoot.status === 'completed') {
      throw new AssignmentError('Shoot is not assignable');
    }

    const existingOthers = activeAssignmentsOnShoot(shootId).filter(
      (a) => a.operator_id !== operatorId && a.status === 'assigned'
    );
    if (existingOthers.length && !override) {
      throw new AssignmentError('Shoot already has an assigned operator', {
        code: 'OCCUPIED',
        warnings: existingOthers.map((a) => ({ operatorId: a.operator_id })),
      });
    }
    if (existingOthers.length && override) {
      // Do not silently overwrite — require explicit replace path
      throw new AssignmentError(
        'Remove the current operator before assigning another (no silent overwrite)',
        { code: 'NO_SILENT_OVERWRITE' }
      );
    }

    const warnings = [];
    if (isUnavailable(operatorId, shoot.date)) {
      warnings.push({ code: 'UNAVAILABLE', message: 'Operator marked unavailable' });
    }
    const conflicts = hasConflict(operatorId, shoot, shootId);
    if (conflicts.length) {
      warnings.push({
        code: 'CONFLICT',
        message: 'Operator has overlapping shoots',
        shoots: conflicts.map((c) => c.id),
      });
    }
    if (warnings.length && !override) {
      throw new AssignmentError('Assignment has warnings', {
        code: 'WARNINGS',
        warnings,
      });
    }

    const prev = operatorAssignment(shootId, operatorId);
    const withinCap = countPreApprovedFuture(operatorId, shootId) < getPreApproveLimit();

    insertAssignment({
      shootId,
      operatorId,
      status: 'assigned',
      source: 'admin',
      assignmentGroupId: null,
      isPreApproved: withinCap,
      isAdditional: false,
      assignedBy: adminId,
      approvedBy: adminId,
    });

    audit({
      shootId,
      operatorId,
      action: 'admin_assign',
      performedBy: adminId,
      previousState: prev,
      newState: { status: 'assigned', source: 'admin', override },
    });
    notify({
      recipientUserId: operatorId,
      type: 'assigned_by_admin',
      title: 'Assigned to shoot',
      message: `You were assigned to ${shoot.title}`,
      relatedShootId: shootId,
    });

    return { ok: true, warnings: override ? warnings : [] };
  });
}

export function withdraw({ shootId, operatorId, actorId }) {
  return withTransaction(() => {
    const asg = operatorAssignment(shootId, operatorId);
    if (!asg || !['assigned', 'pending'].includes(asg.status)) {
      throw new AssignmentError('No active assignment to withdraw', { status: 404 });
    }

    const groupId = asg.assignment_group_id;
    const twinIds = groupId
      ? db.prepare(`
          SELECT shoot_id FROM assignments
          WHERE assignment_group_id = ? AND operator_id = ? AND status IN ('assigned','pending')
        `).all(groupId, operatorId).map((r) => r.shoot_id)
      : [shootId];

    for (const sid of twinIds) {
      const prev = operatorAssignment(sid, operatorId);
      db.prepare(`
        UPDATE assignments
        SET status = 'withdrawn', assignment_group_id = NULL,
            is_pre_approved = 0, is_additional = 0, updated_at = ?
        WHERE shoot_id = ? AND operator_id = ?
      `).run(nowIso(), sid, operatorId);
      audit({
        shootId: sid,
        operatorId,
        action: 'withdraw',
        performedBy: actorId || operatorId,
        previousState: prev,
        newState: { status: 'withdrawn' },
      });
    }

    notify({
      recipientUserId: operatorId,
      type: 'operator_removed',
      title: 'Assignment withdrawn',
      message: 'Your assignment was withdrawn',
      relatedShootId: shootId,
    });

    return { ok: true, shootIds: twinIds };
  });
}

export function adminRemove({ shootId, operatorId, adminId }) {
  return withTransaction(() => {
    const prev = operatorAssignment(shootId, operatorId);
    if (!prev || !['assigned', 'pending'].includes(prev.status)) {
      throw new AssignmentError('No active assignment', { status: 404 });
    }
    const groupId = prev.assignment_group_id;
    const twinIds = groupId
      ? db.prepare(`
          SELECT shoot_id FROM assignments
          WHERE assignment_group_id = ? AND operator_id = ?
        `).all(groupId, operatorId).map((r) => r.shoot_id)
      : [shootId];

    for (const sid of twinIds) {
      const p = operatorAssignment(sid, operatorId);
      db.prepare(`
        UPDATE assignments SET status = 'withdrawn', updated_at = ?,
          assignment_group_id = NULL, is_pre_approved = 0, is_additional = 0
        WHERE shoot_id = ? AND operator_id = ?
      `).run(nowIso(), sid, operatorId);
      audit({
        shootId: sid,
        operatorId,
        action: 'admin_remove',
        performedBy: adminId,
        previousState: p,
        newState: { status: 'withdrawn' },
      });
    }
    notify({
      recipientUserId: operatorId,
      type: 'operator_removed',
      title: 'Removed from shoot',
      message: 'An admin removed you from a shoot',
      relatedShootId: shootId,
    });
    return { ok: true, shootIds: twinIds };
  });
}

export function approvePending({ shootId, operatorId, adminId }) {
  return withTransaction(() => {
    const pending = operatorAssignment(shootId, operatorId);
    if (!pending || pending.status !== 'pending') {
      throw new AssignmentError('No pending request', { status: 404 });
    }
    const groupId = pending.assignment_group_id;
    const rows = groupId
      ? db.prepare(`
          SELECT * FROM assignments
          WHERE assignment_group_id = ? AND operator_id = ? AND status = 'pending'
        `).all(groupId, operatorId)
      : [pending];

    for (const row of rows) {
      const isPrimary = row.shoot_id === shootId || !row.is_additional;
      db.prepare(`
        UPDATE assignments SET
          status = 'assigned',
          is_pre_approved = ?,
          approved_by = ?,
          updated_at = ?
        WHERE id = ?
      `).run(isPrimary ? 1 : 0, adminId, nowIso(), row.id);
      audit({
        shootId: row.shoot_id,
        operatorId,
        action: 'approve',
        performedBy: adminId,
        previousState: row,
        newState: { status: 'assigned' },
      });
    }

    notify({
      recipientUserId: operatorId,
      type: 'assignment_approved',
      title: 'Assignment approved',
      message: 'Your pending assignment was approved',
      relatedShootId: shootId,
    });
    return { ok: true, count: rows.length };
  });
}

export function rejectPending({ shootId, operatorId, adminId }) {
  return withTransaction(() => {
    const pending = operatorAssignment(shootId, operatorId);
    if (!pending || pending.status !== 'pending') {
      throw new AssignmentError('No pending request', { status: 404 });
    }
    const groupId = pending.assignment_group_id;
    const rows = groupId
      ? db.prepare(`
          SELECT * FROM assignments
          WHERE assignment_group_id = ? AND operator_id = ? AND status = 'pending'
        `).all(groupId, operatorId)
      : [pending];

    for (const row of rows) {
      db.prepare(`
        UPDATE assignments SET
          status = 'rejected',
          assignment_group_id = NULL,
          is_pre_approved = 0,
          is_additional = 0,
          updated_at = ?
        WHERE id = ?
      `).run(nowIso(), row.id);
      audit({
        shootId: row.shoot_id,
        operatorId,
        action: 'reject',
        performedBy: adminId,
        previousState: row,
        newState: { status: 'rejected' },
      });
    }

    notify({
      recipientUserId: operatorId,
      type: 'assignment_rejected',
      title: 'Assignment rejected',
      message: 'Your pending assignment was rejected',
      relatedShootId: shootId,
    });
    return { ok: true, count: rows.length };
  });
}

export function serializeShoot(shoot, { forUserId = null } = {}) {
  const asgs = db.prepare(`
    SELECT a.*, u.full_name, u.email, u.active
    FROM assignments a
    JOIN users u ON u.id = a.operator_id
    WHERE a.shoot_id = ? AND a.status IN ('assigned','pending')
  `).all(shoot.id);

  const rig = shoot.rig_id
    ? db.prepare('SELECT * FROM rigs WHERE id = ?').get(shoot.rig_id)
    : null;

  let myAssignment = null;
  if (forUserId) {
    myAssignment = asgs.find((a) => a.operator_id === forUserId) || null;
  }

  return {
    id: shoot.id,
    title: shoot.title,
    teamName: shoot.team_name,
    opponent: shoot.opponent,
    date: shoot.date,
    setupTime: shoot.setup_time,
    gameTime: shoot.game_time,
    expectedEndTime: shoot.expected_end_time,
    venue: shoot.venue,
    shootType: shoot.shoot_type,
    notes: shoot.notes || null,
    description: shoot.description || null,
    calendarSource: shoot.calendar_source || null,
    rigId: shoot.rig_id,
    rig: rig
      ? {
          id: rig.id,
          name: rig.name,
          teamName: rig.team_name,
          venueType: rig.venue_type,
          shootType: rig.shoot_type,
          recipe: safeJson(rig.recipe_json),
        }
      : null,
    status: shoot.status,
    isTaken: asgs.some((a) => a.status === 'assigned'),
    canSelfAssign:
      !asgs.some((a) => a.status === 'assigned') &&
      !asgs.some((a) => a.status === 'pending' && a.operator_id !== forUserId),
    assignedOperators: asgs
      .filter((a) => a.status === 'assigned')
      .map((a) => ({
        id: a.operator_id,
        fullName: a.full_name,
        email: a.email,
        isPreApproved: !!a.is_pre_approved,
        isAdditional: !!a.is_additional,
        assignmentGroupId: a.assignment_group_id,
        source: a.source,
      })),
    pendingOperators: asgs
      .filter((a) => a.status === 'pending')
      .map((a) => ({
        id: a.operator_id,
        fullName: a.full_name,
        email: a.email,
        assignmentGroupId: a.assignment_group_id,
        source: a.source,
      })),
    myAssignment: myAssignment
      ? {
          status: myAssignment.status,
          isPreApproved: !!myAssignment.is_pre_approved,
          isAdditional: !!myAssignment.is_additional,
          assignmentGroupId: myAssignment.assignment_group_id,
          source: myAssignment.source,
        }
      : null,
    createdAt: shoot.created_at,
    updatedAt: shoot.updated_at,
  };
}

function safeJson(s) {
  try {
    return s ? JSON.parse(s) : null;
  } catch {
    return null;
  }
}

export const STATUS_ORDER = [
  'scheduled',
  'setup_started',
  'setup_complete',
  'game_started',
  'completed',
];

export function advanceShootStatus({ shootId, status, actorId, confirmComplete = false }) {
  return withTransaction(() => {
    const shoot = getShoot(shootId);
    if (!shoot) throw new AssignmentError('Shoot not found', { status: 404 });
    if (shoot.status === 'cancelled') throw new AssignmentError('Shoot is cancelled');
    if (shoot.status === 'completed') throw new AssignmentError('Shoot already completed');

    if (!STATUS_ORDER.includes(status) && status !== 'cancelled') {
      throw new AssignmentError('Invalid status');
    }
    if (status === 'completed' && !confirmComplete) {
      throw new AssignmentError('Completion requires confirmation', {
        code: 'CONFIRM_REQUIRED',
      });
    }

    const currentIdx = STATUS_ORDER.indexOf(shoot.status);
    const nextIdx = STATUS_ORDER.indexOf(status);
    if (nextIdx >= 0 && currentIdx >= 0 && nextIdx !== currentIdx + 1 && status !== shoot.status) {
      // Allow admin to jump? Spec sequential for operators — enforce order
      if (nextIdx > currentIdx + 1) {
        throw new AssignmentError(`Complete prior phases before ${status}`);
      }
    }

    db.prepare(`UPDATE shoots SET status = ?, updated_at = ? WHERE id = ?`).run(
      status,
      nowIso(),
      shootId
    );
    db.prepare(`
      INSERT INTO shoot_status_events (id, shoot_id, status, recorded_at, recorded_by)
      VALUES (?, ?, ?, ?, ?)
    `).run(newId(), shootId, status, nowIso(), actorId);

    return { ok: true, status };
  });
}
