import React from 'react';
import { format } from 'date-fns';
import { X, CheckCircle2, Circle } from 'lucide-react';
import RigCheckTile from '@/components/rigs/RigCheckTile';
import { getDisplayName } from '@/components/utils/nameUtils';

export function formatRigCheckDay(dayStr) {
  if (!dayStr) return 'No date';
  const parsed = new Date(`${dayStr}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dayStr;
  return format(parsed, 'EEEE, d MMMM yyyy');
}

export default function RigCheckDayPanel({
  day,
  rows = [],
  users = [],
  todayStr,
  onClose,
  expandedId,
  onToggleExpand,
  tileProps,
}) {
  if (!day) return null;
  const openCount = rows.filter((row) => row.status !== 'completed').length;
  const doneCount = rows.filter((row) => row.status === 'completed').length;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose} role="presentation">
      <div className="absolute inset-0 bg-black/50" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={formatRigCheckDay(day)}
        className="relative z-10 w-full max-w-lg max-h-[min(85vh,640px)] bg-[#292a2a] border border-slate-700/70 rounded-t-2xl sm:rounded-2xl shadow-2xl shadow-black/40 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 sticky top-0 bg-[#292a2a] z-10">
          <div>
            <p className="text-slate-100 font-bold text-base">{formatRigCheckDay(day)}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {rows.length} check{rows.length !== 1 ? 's' : ''}
              {openCount > 0 && <span className="text-orange-300 ml-2">· {openCount} open</span>}
              {doneCount > 0 && <span className="text-emerald-400 ml-2">· {doneCount} done</span>}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-100" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {rows.map((row) => (
            <RigCheckTile
              key={row.id}
              row={row}
              assigneeName={getDisplayName(users.find((u) => u.email === row.assignee_email), row.assignee_email)}
              todayStr={todayStr}
              expanded={expandedId === row.id}
              onToggleExpand={() => onToggleExpand?.(row.id)}
              {...(tileProps?.(row) || {})}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function RigCheckDayListItem({ row, onClick, assigneeName }) {
  const done = row.status === 'completed';
  const subtitle = [row.shoot_title || 'Rig test', assigneeName].filter(Boolean).join(' · ');
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-lg p-3 border flex items-start justify-between gap-3 hover:border-slate-600
        ${done ? 'border-emerald-900/40 bg-slate-900' : 'border-slate-800 bg-slate-900'}`}
    >
      <div className="flex items-start gap-2 flex-1 min-w-0">
        {done
          ? <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
          : <Circle className="h-4 w-4 text-orange-400 flex-shrink-0 mt-0.5" />}
        <div className="min-w-0">
          <p className="text-sm font-medium text-slate-100 truncate">{row.team || 'Rig check'}</p>
          <p className="text-xs text-slate-500 truncate">{subtitle}</p>
        </div>
      </div>
      <span className={`text-xs flex-shrink-0 ${done ? 'text-emerald-400' : 'text-orange-300'}`}>
        {done ? 'Done' : 'Open'}
      </span>
    </button>
  );
}
