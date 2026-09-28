import React from 'react';
import { CheckSquare, ChevronDown, ChevronUp, StickyNote } from 'lucide-react';
import { format } from 'date-fns';
import { assignmentProgress, isRigCheckOverdue } from '@/utils/rigChecks';
import { shortenTitle } from '@/components/utils/scheduleUtils';

export default function RigCheckTile({
  row,
  assigneeName,
  todayStr,
  expanded,
  onToggleExpand,
  editable = false,
  saving = false,
  onToggleItem,
  onNotesBlur,
}) {
  const progress = assignmentProgress(row);
  const overdue = isRigCheckOverdue(row, todayStr);
  const checked = row.status === 'completed';

  return (
    <div className={`rounded-xl border bg-slate-900/80 ${
      overdue ? 'border-red-700/70' : checked ? 'border-emerald-800/60' : 'border-slate-800'
    }`}>
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full text-left p-4 flex items-start justify-between gap-3"
      >
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-100 truncate">{row.team || 'Rig check'}</p>
          <p className="text-xs text-slate-500 mt-0.5 truncate">
            {row.shoot_title ? shortenTitle(row.shoot_title) : 'Rig test'}
            {row.shoot_date ? ` · ${row.shoot_date}` : ''}
          </p>
          {assigneeName && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{assigneeName}</p>
          )}
          {(row.items || []).length > 0 && (
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">
              {(row.items || []).map((item) => item.label).filter(Boolean).slice(0, 4).join(' · ')}
              {(row.items || []).length > 4 ? '…' : ''}
            </p>
          )}
          {row.due_date && (
            <p className={`text-xs mt-1 ${overdue ? 'text-red-400' : 'text-orange-300'}`}>
              {overdue ? `Overdue · due ${row.due_date}` : `Due ${row.due_date}`}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`text-xs font-semibold ${
            checked ? 'text-emerald-400' : overdue ? 'text-red-400' : 'text-orange-300'
          }`}>
            {checked ? 'Checked' : overdue ? 'Overdue' : `${progress.done}/${progress.total || 0} open`}
          </span>
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-800 pt-3 space-y-3">
          <div className="space-y-1.5">
            {(row.items || []).map((item, index) => (
              <label key={`${row.id}-${index}`} className={`flex items-start gap-2 ${editable ? 'cursor-pointer' : ''}`}>
                {editable ? (
                  <input
                    type="checkbox"
                    checked={!!item.checked}
                    disabled={saving}
                    onChange={() => onToggleItem?.(row, index)}
                    className="mt-0.5 accent-orange-500"
                  />
                ) : (
                  <CheckSquare className={`h-4 w-4 mt-0.5 ${item.checked ? 'text-emerald-400' : 'text-slate-600'}`} />
                )}
                <span className={`text-sm ${item.checked ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                  {item.label}
                </span>
              </label>
            ))}
          </div>
          {editable ? (
            <div>
              <label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                <StickyNote className="h-3 w-3" /> Notes
              </label>
              <textarea
                defaultValue={row.notes || ''}
                rows={2}
                placeholder="Anything the next person should know…"
                onBlur={(e) => {
                  const notes = e.target.value;
                  if (notes !== (row.notes || '')) onNotesBlur?.(row, notes);
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-2.5 py-2 text-sm text-slate-100 placeholder:text-slate-600"
              />
            </div>
          ) : (
            <div>
              <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                <StickyNote className="h-3 w-3" /> Notes
              </p>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">
                {String(row.notes || '').trim() || 'No notes.'}
              </p>
              {row.completed_at && (
                <p className="text-xs text-slate-500 mt-2">
                  Done {format(new Date(row.completed_at), 'd MMM HH:mm')}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
