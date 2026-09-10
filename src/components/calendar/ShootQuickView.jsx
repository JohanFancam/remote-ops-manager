import React from 'react';
import { format } from 'date-fns';
import { X, Plus, Minus, Settings2, MapPin, Users, Clock } from 'lucide-react';
import { getDisplayName } from '@/components/utils/nameUtils';
import { shortenTitle } from '@/components/utils/scheduleUtils';
import { normalizeShootStatus, formatStatusLabel, formatDateZA, formatTimeZA } from '@/utils/shootStatus';

function findMatchingRig(shoot, rigSettings = []) {
  if (!shoot) return null;
  const client = (shoot.client || '').toLowerCase().trim();
  const title = (shoot.title || '').toLowerCase().trim();
  return (
    rigSettings.find((r) => {
      const team = (r.team || '').toLowerCase().trim();
      if (!team) return false;
      return (
        team === client ||
        team === title ||
        client.includes(team) ||
        title.includes(team) ||
        team.includes(client) ||
        team.includes(title)
      );
    }) || null
  );
}

export function getShootRigLabel(shoot, rigSettings = []) {
  if (shoot?.rig_type_override) {
    const parts = [shoot.rig_type_override];
    const rig = findMatchingRig(shoot, rigSettings);
    if (rig?.sound || rig?.sound_enabled) parts.push('Sound');
    return parts.join(' / ');
  }
  const rig = findMatchingRig(shoot, rigSettings);
  if (!rig) return shoot?.rig_type || 'Data';
  const parts = [];
  if (rig.rig_type) parts.push(rig.rig_type);
  if (rig.sound || rig.sound_enabled) parts.push('Sound');
  return parts.length ? parts.join(' / ') : 'Data';
}

export function shootDotClass(shoot, rigSettings = [], { past = false } = {}) {
  const status = normalizeShootStatus(shoot?.status);
  if (status === 'cancelled') return 'bg-red-600';
  if (past || status === 'completed') return 'bg-slate-500';
  if (status === 'postponed') return 'bg-amber-500';
  const label = getShootRigLabel(shoot, rigSettings).toLowerCase();
  if (label.includes('fancam')) return 'bg-orange-500';
  return 'bg-blue-500';
}

/**
 * Google Calendar–style event quick view: time, Fancam/Data, assign +/−, admin settings.
 */
export default function ShootQuickView({
  shoot,
  user,
  isAdmin = false,
  allUsers = [],
  rigSettings = [],
  onClose,
  onToggleAssign,
  onOpenSettings,
}) {
  if (!shoot) return null;

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isPast = (shoot.date || '') < todayStr;
  const status = normalizeShootStatus(shoot.status);
  const isCancelled = status === 'cancelled';
  const isCompleted = status === 'completed';
  const shouldGrey = isPast || isCompleted || isCancelled;
  const isAssigned = shoot.assigned_operators?.includes(user?.email);
  const isPending = shoot.pending_operators?.includes(user?.email);
  const showMinus = isAssigned || isPending;
  const canToggle = !isPast && !isCancelled && !isCompleted && !!user?.email;
  const rigLabel = getShootRigLabel(shoot, rigSettings);
  const isFancam = /fancam/i.test(rigLabel);
  const dateLabel = shoot.date
    ? formatDateZA(shoot.date, { weekday: 'long', month: 'long', day: 'numeric' })
    : '';
  const assignedNames = (shoot.assigned_operators || [])
    .map((email) => getDisplayName(allUsers.find((u) => u.email === email), email))
    .filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div className="absolute inset-0 bg-black/55" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={shoot.title || 'Shoot details'}
        onClick={(e) => e.stopPropagation()}
        className={`relative z-10 w-full max-w-md overflow-hidden rounded-2xl border shadow-2xl shadow-black/50 ${
          isCancelled
            ? 'border-red-600/50 bg-[#1e2433] opacity-90'
            : shouldGrey
              ? 'border-slate-700/80 bg-[#1e2433] opacity-80'
              : 'border-slate-700/80 bg-[#1e2433]'
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-800 px-4 py-3">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={`mt-1.5 h-3.5 w-3.5 shrink-0 rounded-sm ${shootDotClass(shoot, rigSettings, { past: isPast })}`}
            />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-snug text-slate-50 break-words">
                {shortenTitle(shoot.title) || 'Untitled shoot'}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {dateLabel}
                {shoot.game_time ? ` · ${formatTimeZA(shoot.game_time)}` : ''}
              </p>
              <p className={`mt-1 text-xs font-medium capitalize ${
                isCancelled ? 'text-red-400' :
                status === 'postponed' ? 'text-amber-300' :
                isCompleted ? 'text-slate-400' : 'text-blue-400'
              }`}>
                {formatStatusLabel(status)}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-4 py-4 text-sm">
          <div className="flex items-center gap-3 text-slate-300">
            <Clock className="h-4 w-4 shrink-0 text-slate-500" />
            <span>
              Game time <span className="font-mono text-slate-100">{shoot.game_time || 'TBA'}</span>
            </span>
          </div>

          <div className="flex items-center gap-3 text-slate-300">
            <span
              className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-sm text-[9px] font-bold text-slate-950 ${
                isFancam ? 'bg-orange-500' : 'bg-slate-400'
              }`}
            >
              {isFancam ? 'F' : 'D'}
            </span>
            <span>
              Rig type{' '}
              <span className={`font-medium ${isFancam ? 'text-orange-300' : 'text-slate-100'}`}>
                {rigLabel}
              </span>
            </span>
          </div>

          {(shoot.location || shoot.client) && (
            <div className="flex items-start gap-3 text-slate-300">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <span className="break-words">
                {[shoot.client, shoot.location].filter(Boolean).join(' · ')}
              </span>
            </div>
          )}

          <div className="flex items-start gap-3 text-slate-300">
            <Users className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
            <span className="break-words">
              {assignedNames.length
                ? assignedNames.join(', ')
                : isPending
                  ? 'Pending approval'
                  : 'Unassigned'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-slate-800 px-4 py-3">
          <button
            type="button"
            disabled={!canToggle}
            onClick={() => onToggleAssign?.(shoot)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
              showMinus
                ? 'border-red-500/40 bg-red-950/35 text-red-300 hover:bg-red-950/55'
                : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-950/50'
            }`}
          >
            {showMinus ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            {showMinus ? (isPending ? 'Cancel pending' : 'Unassign me') : 'Assign me'}
          </button>

          {isAdmin && (
            <button
              type="button"
              onClick={() => onOpenSettings?.(shoot)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800/80 px-3 text-sm font-medium text-slate-200 hover:bg-slate-700"
            >
              <Settings2 className="h-4 w-4" />
              Open settings
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
