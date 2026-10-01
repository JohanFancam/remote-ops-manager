import React from 'react';
import { format } from 'date-fns';
import { UserX, X } from 'lucide-react';
import { getDisplayName } from '@/components/utils/nameUtils';

function personName(item, allUsers = []) {
  const user = allUsers.find((u) => String(u.email || '').toLowerCase() === String(item.operator_email || '').toLowerCase());
  return getDisplayName(user, item.operator_email, item.operator_name);
}

function rangeLabel(item) {
  if (!item?.start_date || !item?.end_date || item.start_date === item.end_date) return null;
  return `${format(new Date(`${item.start_date}T12:00:00`), 'd MMM')} – ${format(new Date(`${item.end_date}T12:00:00`), 'd MMM')}`;
}

/**
 * Quick view of every remote marked unavailable on a calendar day.
 */
export default function UnavailableOperatorsPopup({
  open,
  day,
  people = [],
  allUsers = [],
  onClose,
}) {
  if (!open || !day) return null;

  const names = [...people].sort((a, b) => personName(a, allUsers).localeCompare(personName(b, allUsers)));

  return (
    <div
      className="fixed inset-0 z-[58] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div className="absolute inset-0 bg-black/55" />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Unavailable ${format(day, 'EEEE, d MMMM')}`}
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-sm max-h-[min(80vh,520px)] overflow-hidden rounded-t-2xl sm:rounded-2xl border border-red-800/50 bg-[#1e2433] shadow-2xl shadow-black/50"
      >
        <div className="flex items-start justify-between gap-3 px-4 pt-4 pb-3 border-b border-slate-800">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-wide text-red-300/80">Unavailable</p>
            <h2 className="text-lg font-semibold text-slate-50 leading-snug mt-0.5">
              {format(day, 'EEEE, d MMMM')}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {names.length} remote{names.length === 1 ? '' : 's'} off
            </p>
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

        <ul className="overflow-y-auto px-3 py-3 space-y-1.5">
          {names.length === 0 ? (
            <li className="px-2 py-6 text-center text-sm text-slate-500">Nobody is marked off.</li>
          ) : (
            names.map((item) => {
              const name = personName(item, allUsers);
              const range = rangeLabel(item);
              return (
                <li
                  key={item.id || item.operator_email}
                  className="flex items-start gap-2.5 rounded-xl border border-red-800/40 bg-red-950/25 px-3 py-2.5"
                >
                  <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-950/70 text-red-300">
                    <UserX className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-100 truncate">{name}</span>
                    {item.operator_email && item.operator_email !== name && (
                      <span className="block text-[11px] text-slate-500 truncate">{item.operator_email}</span>
                    )}
                    {range && (
                      <span className="block text-[11px] text-red-300/80 mt-0.5">Range {range}</span>
                    )}
                  </span>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}
