import { isSchedulePhaseEnabled, schedulePhaseFlags } from './schedulePhases.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

assert(isSchedulePhaseEnabled(null, 'setup') === true, 'setup on when no rig');
assert(isSchedulePhaseEnabled(null, 'pre_shoot') === true, 'pre-shoot on when no rig');
assert(isSchedulePhaseEnabled(null, 'attention') === false, 'attention off when no rig');
assert(isSchedulePhaseEnabled(null, 'sound') === false, 'sound off when no rig');
assert(isSchedulePhaseEnabled(null, 'game') === true, 'game always on');

const attentionOnly = {
  setup_enabled: true,
  pre_shoot_enabled: false,
  attention_enabled: true,
  sound_enabled: false,
};
const flags = schedulePhaseFlags(attentionOnly);
assert(flags.setup === true, 'attention-only keeps setup');
assert(flags.pre_shoot === false, 'attention-only hides pre-shoot');
assert(flags.attention === true, 'attention-only keeps attention');
assert(flags.sound === false, 'attention-only hides sound');
assert(flags.game === true, 'attention-only keeps game');

const legacySound = { sound: true };
assert(isSchedulePhaseEnabled(legacySound, 'sound') === true, 'legacy sound flag still enables sound');

console.log('schedulePhases tests passed');
