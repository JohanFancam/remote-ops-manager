import React, { useState } from 'react';
import { X, Copy, Trash2, Users, Pencil, Wrench, Plus, Minus } from 'lucide-react';
import { getDisplayName } from '@/components/utils/nameUtils';
import { getSchedule } from '@/components/utils/scheduleUtils';
import { schedulePhaseFlags } from '@/components/utils/schedulePhases';
import { matchRig, resolveShootLocation } from '@/components/utils/rigUtils';
import { normalizeShootStatus, formatStatusLabel, formatDateZA, formatTimeZA } from '@/utils/shootStatus';
import { useTimezone } from '@/components/TimezoneContext';
import { isClaimedByOtherOperator } from '@/utils/assignmentApproval';
import { isAssignmentLocked } from '@/utils/assignmentLock';
import { isLiveData, LiveDataBadge } from '@/components/shoots/LiveDataControls';
import CalendarRigTestActions from '@/components/calendar/CalendarRigTestActions';

function findMatchingRig(shoot, rigSettings = []) {
  return matchRig(shoot, rigSettings);
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


function PillButton({ active, children, onClick, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? 'border-orange-400/70 bg-orange-500 text-slate-950'
          : 'border-slate-600 bg-slate-800/80 text-slate-200 hover:bg-slate-700'
      }`}
    >
      {children}
    </button>
  );
}

/**
 * Base44-style calendar entry popup: title, schedule, Data/Fancam, operators, actions.
 */
export default function ShootQuickView({
  shoot,
  user,
  isAdmin = false,
  isStandby = false,
  isOperator = false,
  isAnalytics = false,
  isViewer = false,
  allUsers = [],
  rigSettings = [],
  standbyCoverage = null,
  onClose,
  onUpdate,
  onApprovePending,
  onDeclinePending,
  onEdit,
  onDuplicate,
  onDelete,
  onAssignOperators,
  onAssignSelf,
  onRigCheckToggle,
  canCheckRig = false,
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busyRig, setBusyRig] = useState(false);
  const [busyAssign, setBusyAssign] = useState(false);
  const { timeZone, abbr } = useTimezone();

  if (!shoot) return null;

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const isPast = (shoot.date || '') < todayStr;
  const status = normalizeShootStatus(shoot.status);
  const isCancelled = status === 'cancelled';
  const isCompleted = status === 'completed';
  const shouldGrey = isPast || isCompleted || isCancelled;
  const selfEmail = String(user?.email || '').toLowerCase();
  const isAssigned = !!(selfEmail && (shoot.assigned_operators || []).some((e) => String(e).toLowerCase() === selfEmail));
  const isPending = !!(selfEmail && (shoot.pending_operators || []).some((e) => String(e).toLowerCase() === selfEmail));
  const pendingEmails = shoot.pending_operators || [];
  const matchedRig = findMatchingRig(shoot, rigSettings);
  const venue = resolveShootLocation(shoot, matchedRig);
  const schedule = getSchedule(shoot, matchedRig);
  const effectiveRig = shoot.rig_type_override || matchedRig?.rig_type || 'Data';
  const isFancam = /fancam/i.test(effectiveRig);
  const dateLabel = shoot.date
    ? formatDateZA(shoot.date, { weekday: 'long', month: 'long', day: 'numeric', time: shoot.game_time })
    : '';
  const assignedNames = (shoot.assigned_operators || [])
    .map((email) => getDisplayName(allUsers.find((u) => u.email === email), email))
    .filter(Boolean);
  const claimedByOther = !isAdmin && isClaimedByOtherOperator(shoot, user?.email);
  const assignmentLocked = isAssignmentLocked(shoot);
  const canToggleRig = (isAdmin || isStandby) && !!onUpdate && !isCancelled;
  const phaseFlags = schedulePhaseFlags(matchedRig);

  const scheduleRows = schedule ? [
    phaseFlags.setup ? { label: 'Setup', time: schedule.setup } : null,
    phaseFlags.pre_shoot ? { label: 'Pre-Shoot', time: schedule.pre_shoot } : null,
    phaseFlags.attention ? { label: 'Attention', time: schedule.attention } : null,
    phaseFlags.sound ? { label: 'Sound Recording', time: schedule.sound } : null,
    phaseFlags.sound_trigger ? { label: 'Sound Trigger', time: schedule.sound_trigger } : null,
    { label: 'Game', time: schedule.game },
  ].filter(Boolean) : [];

  const canSelfAssign = isOperator && !isAnalytics && !isViewer && !assignmentLocked && !isPast
    && !isCancelled && !isCompleted && !!user?.email && !!onAssignSelf
    && (isAssigned || isPending || isAdmin || !claimedByOther);

  const handleSelfAssign = async () => {
    if (!canSelfAssign || busyAssign) return;
    setBusyAssign(true);
    try {
      await onAssignSelf(shoot);
    } finally {
      setBusyAssign(false);
    }
  };

  const setRigType = async (type) => {
    if (!canToggleRig || shoot.rig_type_override === type) return;
    setBusyRig(true);
    try {
      await onUpdate(shoot.id, { rig_type_override: type });
    } finally {
      setBusyRig(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div className="absolute inset-0 bg-black/55" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={shoot.title || 'Shoot details'}
        onClick={(e) => e.stopPropagation()}
        className={`relative z-10 w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border shadow-2xl shadow-black/50 ${
          isCancelled
            ? 'border-red-600/50 bg-[#1e2433] opacity-90'
            : shouldGrey
              ? 'border-slate-700/80 bg-[#1e2433] opacity-90'
              : 'border-slate-700/80 bg-[#1e2433]'
        }`}
      >
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={`mt-1.5 h-3.5 w-3.5 shrink-0 rounded-full ${shootDotClass(shoot, rigSettings, { past: isPast })}`}
            />
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-snug text-slate-50 break-words">
                {shoot.title || 'Untitled shoot'}
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                {dateLabel}
                {shoot.game_time ? ` · ${formatTimeZA(shoot.game_time, shoot.date)}` : ''}
                {` (${abbr})`}
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

        <div className="space-y-4 px-4 pb-4 pt-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={`inline-flex rounded-full border px-2.5 py-0.5 font-semibold ${
              isFancam
                ? 'border-orange-500/40 bg-orange-500/15 text-orange-300'
                : 'border-slate-600 bg-slate-800 text-slate-200'
            }`}>
              {isFancam ? 'Fancam' : 'Data'}
            </span>
            {venue && <span className="text-slate-300">{venue}</span>}
            {isLiveData(shoot, rigSettings) ? <LiveDataBadge /> : null}
            <span className={`ml-auto capitalize ${
              isCancelled ? 'text-red-400' :
              status === 'postponed' ? 'text-amber-300' :
              isCompleted ? 'text-slate-400' : 'text-slate-400'
            }`}>
              {formatStatusLabel(status)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Rig:</span>
            {['Data', 'Fancam'].map((type) => (
              <PillButton
                key={type}
                active={shoot.rig_type_override === type || (!shoot.rig_type_override && effectiveRig === type)}
                disabled={!canToggleRig || busyRig}
                onClick={() => setRigType(type)}
              >
                {type}
              </PillButton>
            ))}
          </div>

          {scheduleRows.length > 0 && (
            <div>
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">Schedule</p>
              <div className="space-y-1">
                {scheduleRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between rounded-lg bg-slate-800/50 px-2.5 py-1.5">
                    <span className="text-xs text-slate-400">{row.label}</span>
                    <span className="font-mono text-xs text-slate-100">{row.time || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">Capturing</p>
            <p className="text-sm text-slate-200">
              {assignmentLocked
                ? 'Manual — not assignable'
                : assignedNames.length
                ? assignedNames.join(', ')
                : pendingEmails.length
                  ? 'Pending approval'
                  : claimedByOther
                    ? 'Taken'
                    : 'Unassigned'}
            </p>
            {isOperator && !assignmentLocked && !isPast && !isCancelled && !isCompleted && onAssignSelf && (
              <button
                type="button"
                disabled={!canSelfAssign || busyAssign || (claimedByOther && !isAssigned && !isPending)}
                onClick={handleSelfAssign}
                className={`mt-2 inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40 ${
                  isAssigned || isPending
                    ? 'border-red-500/40 bg-red-950/40 text-red-200 hover:bg-red-950/70'
                    : claimedByOther
                      ? 'border-slate-700 bg-slate-800/60 text-slate-500'
                      : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-200 hover:bg-emerald-950/50'
                }`}
              >
                {isAssigned || isPending
                  ? <Minus className="h-3.5 w-3.5" />
                  : <Plus className="h-3.5 w-3.5" />}
                {busyAssign
                  ? (isAssigned || isPending ? 'Updating…' : 'Assigning…')
                  : isAssigned
                    ? 'Unassign myself'
                    : isPending
                      ? 'Cancel pending'
                      : claimedByOther
                        ? 'Taken — unavailable'
                        : 'Assign myself'}
              </button>
            )}
          </div>

          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-500">Standby</p>
            <p className="text-sm text-slate-200">
              {standbyCoverage
                ? (standbyCoverage.admin_name || standbyCoverage.admin_email)
                : 'No standby'}
            </p>
          </div>

          {!isViewer && (
            <CalendarRigTestActions
              shoot={shoot}
              user={user}
              isAdmin={isAdmin}
              allUsers={allUsers}
              rigSettings={rigSettings}
            />
          )}

          {isAdmin && !assignmentLocked && pendingEmails.length > 0 && (
            <div className="rounded-lg border border-amber-800/40 bg-amber-950/25 px-3 py-2 space-y-2">
              <p className="text-[11px] font-medium uppercase tracking-wide text-amber-400">Pending approval</p>
              {pendingEmails.map((email) => {
                const name = getDisplayName(allUsers.find((u) => u.email === email), email);
                return (
                  <div key={email} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-sm text-amber-100">{name}</span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onApprovePending?.(shoot, email)}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-emerald-700/50 bg-emerald-950/40 px-2 text-xs font-medium text-emerald-300 hover:bg-emerald-900/50"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeclinePending?.(shoot, email)}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-red-700/40 bg-red-950/30 px-2 text-xs font-medium text-red-300 hover:bg-red-950/50"
                      >
                        Decline
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!isViewer && (isAdmin || isStandby || isAnalytics) && (
            <div className="flex flex-wrap gap-2">
              {canCheckRig && (
                <button
                  type="button"
                  onClick={() => onRigCheckToggle?.(shoot)}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium ${
                    shoot.rig_check_completed
                      ? 'border-emerald-600/50 bg-emerald-950/40 text-emerald-300'
                      : 'border-amber-500/40 bg-amber-500 text-slate-950'
                  }`}
                >
                  <Wrench className="h-3.5 w-3.5" />
                  {shoot.rig_check_completed ? 'Open message' : 'Quick rig check'}
                </button>
              )}
              {(isAdmin || isAnalytics) && (
                <button
                  type="button"
                  onClick={() => onEdit?.(shoot)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-600 bg-slate-800/80 px-3 text-sm font-medium text-slate-100 hover:bg-slate-700"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  {isAnalytics ? 'Request edit' : 'Edit Settings'}
                </button>
              )}
              {isAdmin && !assignmentLocked && (
                <button
                  type="button"
                  onClick={() => onAssignOperators?.(shoot)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-600 bg-slate-800/80 px-3 text-sm font-medium text-slate-100 hover:bg-slate-700"
                >
                  <Users className="h-3.5 w-3.5" />
                  Operator
                  {pendingEmails.length > 0 ? ` (${pendingEmails.length})` : ''}
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => onDuplicate?.(shoot)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-600 bg-slate-800/80 px-3 text-sm font-medium text-slate-100 hover:bg-slate-700"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Duplicate
                </button>
              )}
              {(isAdmin || isAnalytics) && (
                confirmDelete ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onDelete?.(shoot.id)}
                      className="inline-flex h-9 items-center rounded-full bg-red-700 px-3 text-sm font-medium text-white hover:bg-red-600"
                    >
                      Confirm delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="inline-flex h-9 items-center rounded-full border border-slate-600 px-3 text-sm text-slate-300 hover:bg-slate-800"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-red-700/50 bg-red-950/30 px-3 text-sm font-medium text-red-300 hover:bg-red-950/50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
