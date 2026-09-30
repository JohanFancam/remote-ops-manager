import {
  defaultCheckLabels,
  isEligibleRigCheckRole,
  matchRigSetting,
  validateRigCheckAssignment,
} from './rigCheckUtils.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const shoot = { client: 'Charlotte FC', title: 'Charlotte FC vs Pride' };
const rigs = [
  { id: '1', team: 'Charlotte FC', default_checks: ['Power', '  Focus  ', ''] },
  { id: '2', team: 'Current', default_checks: ['ISO'] },
];

assert(matchRigSetting(shoot, rigs)?.id === '1', 'matches charlotte rig');
assert(defaultCheckLabels(rigs[0]).join('|') === 'Power|Focus', 'trims default checks');
assert(matchRigSetting({ title: 'KC Current vs Gotham', client: '' }, rigs)?.id === '2', 'matches current via title');

const nhlRigs = [
  { id: 'bruins', team: 'Boston Bruins' },
  { id: 'rangers', team: 'New York Rangers' },
];
assert(matchRigSetting({ title: 'Bruins vs Rangers' }, nhlRigs)?.id === 'bruins', 'bruins vs rangers uses Bruins checklist');
assert(matchRigSetting({ title: 'Rangers vs Bruins' }, nhlRigs)?.id === 'rangers', 'rangers vs bruins uses Rangers checklist');

assert(isEligibleRigCheckRole('admin') === true, 'admin can test');
assert(isEligibleRigCheckRole('standby') === true, 'operator/standby can test');
assert(isEligibleRigCheckRole('user') === false, 'remote operators cannot be assigned');
assert(isEligibleRigCheckRole('analytics') === false, 'data users cannot be assigned');
assert(validateRigCheckAssignment({ shootId: '', assignee: { email: 'a@x.com', role: 'admin' } }) === 'Pick a shoot to assign rig testing', 'requires shoot');
assert(validateRigCheckAssignment({ shootId: 's1', assignee: { email: 'a@x.com', role: 'user' } }) === 'Rig tests can only be assigned to admins and operator/standby', 'rejects remotes');
assert(validateRigCheckAssignment({ shootId: 's1', assignee: { email: 'a@x.com', role: 'standby', inactive: 1 } }) === 'Assignee not found', 'rejects inactive');
assert(validateRigCheckAssignment({ shootId: 's1', assignee: { email: 'a@x.com', role: 'admin' } }) === null, 'accepts admin');

console.log('rigChecks tests passed');
