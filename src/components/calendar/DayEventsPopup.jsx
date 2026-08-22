import React from 'react';
import { format } from 'date-fns';
import { Plus, Minus, Settings2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { getDisplayName } from '@/components/utils/nameUtils';

export default function DayEventsPopup({
  open,
  day,
  shoots = [],
  user,
  allUsers = [],
  onClose,
  onToggleAssign,
  onOpenSettings,
}) {
  if (!day) return null;

  const dateLabel = format(day, 'EEEE, MMMM d');
  const todayStr = new Date().toISOString().slice(0, 10);
  const dateStr = format(day, 'yyyy-MM-dd');

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose?.(); }}>
      <DialogContent className="max-w-md border-slate-800 bg-slate-950 p-0 text-slate-100 gap-0 overflow-hidden sm:rounded-xl">
        <DialogHeader className="border-b border-slate-800 px-4 py-3 pr-12 text-left space-y-1">
          <DialogTitle className="text-base font-semibold text-slate-100">
            {dateLabel}
          </DialogTitle>
          <DialogDescription className="text-xs text-slate-500">
            {shoots.length} game{shoots.length === 1 ? '' : 's'} · use + / − to assign yourself, or open settings
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[min(70vh,520px)] overflow-y-auto p-2 space-y-1.5">
          {shoots.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-slate-500">Nothing scheduled.</p>
          ) : (
            shoots.map((shoot) => {
              const isAssigned = shoot.assigned_operators?.includes(user?.email);
              const isPending = shoot.pending_operators?.includes(user?.email);
              const isPast = (shoot.date || dateStr) < todayStr;
              const assignedNames = (shoot.assigned_operators || [])
                .map((email) => {
                  const u = allUsers.find((x) => x.email === email);
                  return getDisplayName(u, email);
                })
                .join(', ');
              const canToggle = !isPast && !!user?.email;
              const showMinus = isAssigned || isPending;

              return (
                <div
                  key={shoot.id}
                  className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 ${
                    isAssigned
                      ? 'border-purple-500/50 bg-purple-950/30'
                      : isPending
                        ? 'border-yellow-500/40 bg-amber-950/20'
                        : 'border-slate-800 bg-slate-900/80'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-100 leading-snug break-words">
                      {shoot.game_time ? (
                        <span className="mr-1.5 font-mono text-xs font-medium tabular-nums text-slate-400">
                          {shoot.game_time}
                        </span>
                      ) : null}
                      {shoot.title || 'Untitled shoot'}
                    </p>
                    {(shoot.client || shoot.location) && (
                      <p className="mt-0.5 text-xs text-slate-500 break-words">
                        {shoot.client || shoot.location}
                      </p>
                    )}
                    <p className={`mt-0.5 text-xs ${isPending && !assignedNames ? 'text-amber-400' : 'text-slate-400'}`}>
                      {assignedNames || (isPending ? 'Pending Approval' : 'Unassigned')}
                      {isPending && assignedNames ? ` · Pending (${shoot.pending_operators.length})` : ''}
                    </p>
                  </div>

                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={!canToggle}
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleAssign?.(shoot);
                      }}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                        showMinus
                          ? 'border-red-500/40 bg-red-950/40 text-red-300 hover:bg-red-950/70'
                          : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-950/50'
                      }`}
                      title={
                        isPast
                          ? 'Past shoot'
                          : showMinus
                            ? isPending
                              ? 'Cancel pending'
                              : 'Unassign yourself'
                            : 'Assign yourself'
                      }
                      aria-label={showMinus ? 'Unassign yourself' : 'Assign yourself'}
                    >
                      {showMinus ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenSettings?.(shoot);
                      }}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-slate-100 transition-colors"
                      title="Open shoot settings"
                      aria-label="Open shoot settings"
                    >
                      <Settings2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
