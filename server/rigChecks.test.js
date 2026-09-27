import { defaultCheckLabels, matchRigSetting } from './rigCheckUtils.js';

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

console.log('rigChecks tests passed');
