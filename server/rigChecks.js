import { listEntities, createEntity, filterEntities, updateEntity } from './entities.js';
import { defaultCheckLabels, matchRigSetting } from './rigCheckUtils.js';

export { defaultCheckLabels, matchRigSetting };

function emails(list) {
  return [...new Set((list || []).map((e) => String(e || '').trim().toLowerCase()).filter(Boolean))];
}

export function syncRigChecksForShoot(previous, shoot, user = null) {
  if (!shoot?.id) return;
  const prevAssigned = emails(previous?.assigned_operators);
  const nextAssigned = emails(shoot.assigned_operators);
  const added = nextAssigned.filter((e) => !prevAssigned.includes(e));
  const removed = prevAssigned.filter((e) => !nextAssigned.includes(e));

  const existing = filterEntities('RigCheckAssignment').filter((row) => row.shoot_id === shoot.id);

  for (const rec of existing) {
    const email = String(rec.assignee_email || '').trim().toLowerCase();
    if (removed.includes(email) && rec.source === 'shoot' && rec.status !== 'completed') {
      updateEntity('RigCheckAssignment', rec.id, { status: 'cancelled' });
    }
  }

  if (!added.length) return;

  const rig = matchRigSetting(shoot, listEntities('RigSetting'));
  const checks = defaultCheckLabels(rig);
  if (!rig || !checks.length) return;

  for (const email of added) {
    const already = existing.find((row) => (
      String(row.assignee_email || '').trim().toLowerCase() === email
      && row.status !== 'cancelled'
    ));
    if (already) continue;
    createEntity('RigCheckAssignment', {
      rig_setting_id: rig.id,
      team: rig.team || '',
      shoot_id: shoot.id,
      shoot_title: shoot.title || shoot.client || rig.team || '',
      shoot_date: shoot.date || '',
      assignee_email: email,
      assigned_by: user?.email || '',
      source: 'shoot',
      items: checks.map((label) => ({ label, checked: false })),
      notes: '',
      status: 'pending',
    }, user);
  }
}
