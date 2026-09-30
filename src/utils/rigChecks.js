import { normalizeEmail } from './assignmentApproval.js';

export const RIG_CHECK_ELIGIBLE_ROLES = ['admin', 'standby'];

export function normalizeDefaultChecks(rig) {
  const raw = rig?.default_checks;
  let list = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      list = JSON.parse(trimmed);
    } catch {
      list = trimmed.split(/\n|,/).map((item) => item.trim());
    }
  }
  if (!Array.isArray(list)) return [];
  return list.map((item) => String(item || '').trim()).filter(Boolean);
}

export function isPlaceholderChecklist(items) {
  if (!Array.isArray(items) || items.length === 0) return true;
  if (items.length === 1 && String(items[0]?.label || '').trim().toLowerCase() === 'rig check complete') {
    return true;
  }
  return false;
}

export function mergeChecklistFromRig(assignment, rig) {
  const defaults = itemsFromDefaultChecks(rig);
  if (!defaults.length) return assignment;
  const existing = Array.isArray(assignment?.items) ? assignment.items : [];
  if (isPlaceholderChecklist(existing)) {
    return {
      ...assignment,
      items: defaults,
      team: assignment?.team || rig?.team || '',
      rig_setting_id: assignment?.rig_setting_id || rig?.id || '',
    };
  }
  const have = new Set(existing.map((item) => String(item?.label || '').trim().toLowerCase()).filter(Boolean));
  const extras = defaults.filter((item) => !have.has(item.label.toLowerCase()));
  if (!extras.length) return assignment;
  return { ...assignment, items: [...existing, ...extras] };
}

export function itemsFromDefaultChecks(rig) {
  return normalizeDefaultChecks(rig).map((label) => ({ label, checked: false }));
}

export function assignmentProgress(assignment) {
  const items = Array.isArray(assignment?.items) ? assignment.items : [];
  const total = items.length;
  const done = items.filter((item) => item?.checked).length;
  return { done, total, complete: total > 0 && done === total };
}

export function isRigCheckAssignee(assignment, email) {
  return normalizeEmail(assignment?.assignee_email) === normalizeEmail(email);
}

export function isRigCheckOverdue(assignment, todayStr) {
  if (!assignment?.due_date) return false;
  const status = String(assignment.status || '');
  if (status === 'completed' || status === 'cancelled') return false;
  return assignment.due_date < todayStr;
}

export function canAssignRigTests(user) {
  return RIG_CHECK_ELIGIBLE_ROLES.includes(user?.role);
}

export function eligibleRigCheckUsers(users = []) {
  return (users || []).filter((user) => {
    if (!user?.email || user.inactive) return false;
    return RIG_CHECK_ELIGIBLE_ROLES.includes(user.role);
  });
}

export function openAssignmentsForShoot(assignments = [], shootId) {
  if (!shootId) return [];
  return (assignments || []).filter((row) => (
    row.shoot_id === shootId && row.status !== 'completed' && row.status !== 'cancelled'
  ));
}

export function upcomingShootsForTesting(shoots = [], todayStr) {
  return (shoots || [])
    .filter((shoot) => {
      if (!shoot?.date || shoot.date < todayStr) return false;
      const status = String(shoot.status || '').toLowerCase();
      return status !== 'cancelled' && status !== 'completed';
    })
    .sort((a, b) => {
      const date = String(a.date).localeCompare(String(b.date));
      if (date !== 0) return date;
      return String(a.game_time || '').localeCompare(String(b.game_time || ''));
    });
}

export function buildManualRigCheck({
  rig,
  assigneeEmail,
  assignedBy,
  shoot,
  dueDate,
}) {
  const items = itemsFromDefaultChecks(rig);
  return {
    rig_setting_id: rig?.id || '',
    team: rig?.team || shoot?.client || '',
    shoot_id: shoot?.id || '',
    shoot_title: shoot?.title || shoot?.client || '',
    shoot_date: shoot?.date || '',
    due_date: dueDate || shoot?.date || '',
    assignee_email: String(assigneeEmail || '').trim().toLowerCase(),
    assigned_by: assignedBy || '',
    source: 'manual',
    items: items.length ? items : [{ label: 'Rig check complete', checked: false }],
    notes: '',
    status: 'pending',
  };
}
