import React from 'react';
import { Switch } from '@/components/ui/switch';
import { matchRig } from '@/components/utils/rigUtils';

function flagOn(value) {
  return value === true || value === 1 || String(value).toLowerCase() === 'true';
}

export function isLiveData(shoot, rigOrSettings) {
  if (flagOn(shoot?.live_data)) return true;
  const rig = Array.isArray(rigOrSettings)
    ? matchRig(shoot, rigOrSettings)
    : (rigOrSettings || null);
  return flagOn(rig?.live_data);
}

export function compareLiveDataFirst(a, b, fallback = () => 0, rigSettings = []) {
  const da = isLiveData(a, rigSettings) ? 0 : 1;
  const db = isLiveData(b, rigSettings) ? 0 : 1;
  if (da !== db) return da - db;
  return fallback();
}

export function LiveDataBadge({ className = '' }) {
  return (
    <span className={`inline-flex items-center rounded-full border border-sky-500/40 bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300 ${className}`}>
      Live Data
    </span>
  );
}

export function LiveDataToggle({ checked, onChange, disabled = false, compact = false }) {
  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 ${
      checked ? 'border-sky-500/40 bg-sky-500/10' : 'border-slate-800 bg-slate-800/40'
    }`}>
      <div>
        <p className="text-sm text-slate-100">Live Data</p>
        {!compact && (
          <p className="text-[11px] text-slate-500">This team’s times get first priority when issues need repair.</p>
        )}
      </div>
      <Switch
        checked={!!checked}
        disabled={disabled}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-sky-500 data-[state=unchecked]:bg-slate-700"
      />
    </div>
  );
}
