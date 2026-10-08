export function pickSetting(appSettings = [], key) {
  const matches = (appSettings || []).filter((row) => row?.key === key);
  return [...matches].reverse().find((row) => String(row?.value || '').trim()) || matches[0] || null;
}

export function pickSettingValue(appSettings = [], key, fallback = '') {
  const value = String(pickSetting(appSettings, key)?.value || '').trim();
  return value || fallback;
}
