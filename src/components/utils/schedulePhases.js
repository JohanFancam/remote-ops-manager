/** Per-rig schedule times. Game is always shown; the rest can be switched off. */
export const SCHEDULE_PHASES = [
  { key: 'setup', label: 'Setup', enabledKey: 'setup_enabled', defaultEnabled: true, doneKey: 'setup_complete' },
  { key: 'pre_shoot', label: 'Pre-Shoot', enabledKey: 'pre_shoot_enabled', defaultEnabled: true, doneKey: 'pre_shoot_started' },
  { key: 'attention', label: 'Attention', enabledKey: 'attention_enabled', defaultEnabled: false, doneKey: 'attention_started' },
  { key: 'sound', label: 'Sound Recording', enabledKey: 'sound_enabled', defaultEnabled: false, doneKey: 'sound_started' },
  { key: 'sound_trigger', label: 'Sound Trigger', enabledKey: 'sound_trigger_enabled', defaultEnabled: false, doneKey: 'sound_trigger_started' },
  { key: 'game', label: 'Game Time', enabledKey: null, defaultEnabled: true, doneKey: 'game_started' },
];

export function isSchedulePhaseEnabled(rig, phaseKey) {
  if (phaseKey === 'game') return true;
  if (phaseKey === 'sound' && (rig?.sound === true)) return true;
  const meta = SCHEDULE_PHASES.find((p) => p.key === phaseKey);
  if (!meta) return true;
  if (!meta.enabledKey) return meta.defaultEnabled;
  if (!rig || rig[meta.enabledKey] === undefined || rig[meta.enabledKey] === null) {
    return meta.defaultEnabled;
  }
  return rig[meta.enabledKey] === true;
}

export function schedulePhaseFlags(rig) {
  return {
    setup: isSchedulePhaseEnabled(rig, 'setup'),
    pre_shoot: isSchedulePhaseEnabled(rig, 'pre_shoot'),
    attention: isSchedulePhaseEnabled(rig, 'attention'),
    sound: isSchedulePhaseEnabled(rig, 'sound'),
    sound_trigger: isSchedulePhaseEnabled(rig, 'sound_trigger'),
    game: true,
  };
}

export function enabledSchedulePhases(rig) {
  return SCHEDULE_PHASES.filter((p) => isSchedulePhaseEnabled(rig, p.key));
}
