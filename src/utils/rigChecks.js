import { matchRig } from '@/components/utils/rigUtils';
import { normalizeEmail } from '@/utils/assignmentApproval';

export const RIG_CHECK_ELIGIBLE_ROLES = ['admin', 'user', 'standby'];

export function normalizeDefaultChecks(rig) {
  const raw = rig?.default_checks;
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item || '').trim()).filter(Boolean);
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

export function eligibleRigCheckUsers(users = []) {
  return (users || []).filter((user) => {
    if (!user?.email || user.inactive) return false;
    return RIG_CHECK_ELIGIBLE_ROLES.includes(user.role);
  });
}

export function upcomingShootsForRig(shoots = [], rig, todayStr) {
  if (!rig) return [];
  return (shoots || [])
    .filter((shoot) => {
      if (!shoot?.date || shoot.date < todayStr) return false;
      const status = String(shoot.status || '').toLowerCase();
      if (status === 'cancelled' || status === 'completed') return false;
      return matchRig(shoot, [rig])?.id === rig.id;
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
  shoot = null,
}) {
  const items = itemsFromDefaultChecks(rig);
  return {
    rig_setting_id: rig?.id || '',
    team: rig?.team || '',
    shoot_id: shoot?.id || '',
    shoot_title: shoot?.title || shoot?.client || '',
    shoot_date: shoot?.date || '',
    assignee_email: String(assigneeEmail || '').trim().toLowerCase(),
    assigned_by: assignedBy || '',
    source: 'manual',
    items: items.length ? items : [{ label: 'Rig check complete', checked: false }],
    notes: '',
    status: 'pending',
  };
}
