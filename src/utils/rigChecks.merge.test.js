import { mergeChecklistFromRig, isPlaceholderChecklist } from './rigChecks.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const rig = { id: 'bruins', team: 'Boston Bruins', default_checks: ['Power on', 'PTZ home', 'Focus'] };

assert(isPlaceholderChecklist([]) === true, 'empty is placeholder');
assert(isPlaceholderChecklist([{ label: 'Rig check complete', checked: false }]) === true, 'fallback is placeholder');

const filled = mergeChecklistFromRig({ items: [], team: '' }, rig);
assert(filled.items.map((i) => i.label).join('|') === 'Power on|PTZ home|Focus', 'replaces empty with Bruins list');
assert(filled.team === 'Boston Bruins', 'copies team');

const kept = mergeChecklistFromRig({
  items: [{ label: 'Power on', checked: true }, { label: 'Old extra', checked: false }],
}, rig);
assert(kept.items[0].checked === true, 'keeps ticked items');
assert(kept.items.some((i) => i.label === 'PTZ home'), 'adds new default items');
assert(kept.items.some((i) => i.label === 'Old extra'), 'keeps extra notes items');

console.log('rigChecks.merge tests passed');
