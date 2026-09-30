import React from 'react';
import { format } from 'date-fns';
import { Plus, Minus, X, Check, Wrench } from 'lucide-react';
import { shootDotClass } from './ShootQuickView';
import { shortenTitle } from '@/components/utils/scheduleUtils';
import { getDisplayName } from '@/components/utils/nameUtils';
import { normalizeShootStatus, formatStatusLabel } from '@/utils/shootStatus';
import { isClaimedByOtherOperator } from '@/utils/assignmentApproval';
import { isAssignmentLocked } from '@/utils/assignmentLock';
import { standbyColorForEmail } from '@/components/utils/standbyColors';

/**
 * Google Calendar–style “N more” day list popup.
 */
export default function DayEventsPopup({
  open,
  day,
  shoots = [],
  user,
  isAdmin = false,
  isAnalytics = false,
  isViewer = false,
  allUsers = [],
  rigSettings = [],
  onClose,
  onToggleAssign,
  onSelectShoot,
  onApprovePending,
  onDeclinePending,
  onRigCheckToggle,
  canCheckShoot,
  getStandbyCoverageForShoot,
}) {
  if (!open || !day) return null;

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const dateStr = format(day, 'yyyy-MM-dd');

  return (
    <div
      className="fixed inset-0 z-[55] flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div className="absolute inset-0 bg-black/50" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={format(day, 'EEEE, MMMM d')}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 flex max-h-[min(80vh,560px)] w-full max-w-xs flex-col overflow-hidden rounded-2xl border border-slate-700/70 bg-[#252b3b] shadow-2xl shadow-black/40"
      >
        <div className="flex items-start justify-between px-4 pb-2 pt-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {format(day, 'EEE')}
            </p>
            <p className="text-3xl font-semibold tabular-nums text-slate-50 leading-none mt-1">
              {format(day, 'd')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-800 hover:text-slate-100"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {shoots.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-slate-500">Nothing scheduled.</p>
          ) : (
            <ul className="space-y-0.5">
              {shoots.map((shoot) => {
                const status = normalizeShootStatus(shoot.status);
                const isCancelled = status === 'cancelled';
                const isCompleted = status === 'completed';
                const isPostponed = status === 'postponed';
                const isAssigned = shoot.assigned_operators?.includes(user?.email);
                const isPending = shoot.pending_operators?.includes(user?.email);
                const isPast = (shoot.date || dateStr) < todayStr;
                const shouldGrey = isPast || isCompleted || isCancelled;
                const claimedByOther = !isAnalytics && !isViewer && !isAdmin && isClaimedByOtherOperator(shoot, user?.email);
                const showMinus = isAssigned || isPending;
                const assignmentLocked = isAssignmentLocked(shoot);
                const canToggle = !assignmentLocked && !isAnalytics && !isViewer && !isPast && !isCancelled && !isCompleted && !!user?.email
                  && (showMinus || isAdmin || !claimedByOther);
                const dot = shootDotClass(shoot, rigSettings, { past: isPast });
                const assignedNames = (shoot.assigned_operators || [])
                  .map((email) => getDisplayName(allUsers.find((u) => u.email === email), email))
                  .filter(Boolean);
                const operatorLabel = assignedNames.length
                  ? assignedNames.join(', ')
                  : (shoot.pending_operators || []).length
                    ? 'Pending approval'
                    : claimedByOther
                      ? 'Taken'
                      : '';
                const standbyCoverage = getStandbyCoverageForShoot?.(shoot);
                const standbyColor = standbyCoverage
                  ? standbyColorForEmail(standbyCoverage.admin_email)
                  : null;

                return (
                  <li key={shoot.id}>
                    <div
                      className={`group flex items-center gap-1 rounded-lg px-1.5 py-1.5 transition-colors hover:bg-slate-800/80 ${
                        isAssigned ? 'bg-slate-800/40' : ''
                      } ${shouldGrey ? 'opacity-55' : ''} ${
                        isCancelled ? 'ring-1 ring-inset ring-red-600/40 bg-red-950/20' : ''
                      } ${!isAnalytics && claimedByOther && !shouldGrey ? 'opacity-70' : ''} ${
                        standbyColor ? `border-l-2 ${standbyColor.accent}` : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => onSelectShoot?.(shoot)}
                        className="flex min-w-0 flex-1 items-start gap-2 text-left"
                      >
                        <span className={`mt-1.5 h-4 w-0.5 shrink-0 rounded-full ${dot}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] text-slate-100">
                            {shoot.game_time ? (
                              <span className="mr-1.5 tabular-nums text-slate-400">{shoot.game_time}</span>
                            ) : null}
                            <span
                              className={standbyColor ? `${standbyColor.highlight} rounded-sm px-1` : undefined}
                              title={standbyCoverage ? `Standby: ${standbyCoverage.admin_name || standbyCoverage.admin_email}` : undefined}
                            >
                              {shortenTitle(shoot.title) || 'Untitled'}
                            </span>
                            {(isCancelled || isPostponed || isCompleted) && (
                              <span className={`ml-1.5 text-[11px] font-medium ${
                                isCancelled ? 'text-red-400' :
                                isPostponed ? 'text-amber-300' : 'text-slate-400'
                              }`}>
                                · {formatStatusLabel(status)}
                              </span>
                            )}
                          </span>
                          {operatorLabel ? (
                            <span className="mt-0.5 block truncate text-[11px] text-slate-400">{operatorLabel}</span>
                          ) : null}
                        </span>
                      </button>
                      {canCheckShoot?.(shoot) && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRigCheckToggle?.(shoot);
                          }}
                          className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ${
                            shoot.rig_check_completed ? 'text-emerald-300' : 'text-amber-300 hover:bg-amber-950/40'
                          }`}
                          title={shoot.rig_check_completed ? 'Rig checked' : 'Quick rig check'}
                          aria-label={shoot.rig_check_completed ? 'Rig checked' : 'Quick rig check'}
                        >
                          <Wrench className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {isAdmin && (shoot.pending_operators || []).length > 0 && !assignmentLocked && (
                        <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onApprovePending?.(shoot, shoot.pending_operators[0]);
                          }}
                          className="inline-flex h-6 items-center rounded-md border border-emerald-700/50 bg-emerald-950/40 px-1.5 text-[10px] font-medium text-emerald-300 hover:bg-emerald-900/50"
                          title="Approve pending operator"
                        >
                          <Check className="h-3 w-3 mr-0.5" />
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeclinePending?.(shoot, shoot.pending_operators[0]);
                          }}
                          className="inline-flex h-6 items-center rounded-md border border-red-700/40 bg-red-950/30 px-1.5 text-[10px] font-medium text-red-300 hover:bg-red-950/50"
                          title="Decline pending operator"
                        >
                          Decline
                        </button>
                        </>
                      )}
                      {!isAnalytics && !isViewer && !assignmentLocked && (
                      <button
                        type="button"
                        disabled={!canToggle}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleAssign?.(shoot);
                        }}
                        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md opacity-80 transition-colors disabled:opacity-30 ${
                          showMinus
                            ? 'text-red-300 hover:bg-red-950/50'
                            : claimedByOther
                              ? 'text-slate-500'
                              : 'text-emerald-300 hover:bg-emerald-950/40'
                        }`}
                        title={
                          showMinus
                            ? (isPending ? 'Cancel pending' : 'Unassign yourself')
                            : claimedByOther
                              ? ((shoot.pending_operators || []).length > 0
                                ? 'Pending approval — unavailable'
                                : 'Taken by another operator')
                              : 'Assign yourself'
                        }
                        aria-label={showMinus ? 'Unassign yourself' : claimedByOther ? 'Unavailable' : 'Assign yourself'}
                      >
                        {showMinus ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                      </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
