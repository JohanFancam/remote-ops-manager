import { pickSetting, pickSettingValue } from './appSettings.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const rows = [
  { id: '1', key: 'app_logo_url', value: '' },
  { id: '2', key: 'app_logo_url', value: '/api/uploads/new.png' },
  { id: '3', key: 'other', value: 'x' },
];

assert(pickSetting(rows, 'app_logo_url')?.id === '2', 'prefers the filled logo row');
assert(pickSettingValue(rows, 'app_logo_url') === '/api/uploads/new.png', 'returns the filled value');
assert(pickSettingValue([], 'app_logo_url', '/rom-logo.png') === '/rom-logo.png', 'fallback when missing');

console.log('appSettings pick tests passed');
