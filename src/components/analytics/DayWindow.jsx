import React from 'react';
import { addDays, format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const DAYS_PER_PAGE = 4;

export function shiftDayWindow(start, direction) {
  return addDays(start, direction * DAYS_PER_PAGE);
}

export function formatWindowRange(start, days = DAYS_PER_PAGE) {
  const end = addDays(start, days - 1);
  return `${format(start, 'EEE d MMM')} – ${format(end, 'EEE d MMM')}`;
}

export default function DayWindow({
  startDate,
  onPrev,
  onNext,
  canPrev = true,
  canNext = true,
  days = DAYS_PER_PAGE,
  emptyLabel = 'Nothing on this day.',
  renderDay,
}) {
  const dayList = Array.from({ length: days }, (_, index) => addDays(startDate, index));

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-900 px-2 py-1.5 sm:px-3">
        <button
          type="button"
          onClick={onPrev}
          disabled={!canPrev}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 text-slate-300 hover:bg-slate-800 disabled:opacity-30"
          aria-label="Previous 4 days"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="min-w-0 text-center text-xs font-medium text-slate-300 sm:text-sm">
          {formatWindowRange(startDate, days)}
        </p>
        <button
          type="button"
          onClick={onNext}
          disabled={!canNext}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-blue-800/60 bg-blue-950/40 text-blue-300 hover:bg-blue-950/60 disabled:opacity-30"
          aria-label="Next 4 days"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1 [-ms-overflow-style:none] [scrollbar-width:thin] xl:grid xl:grid-cols-4 xl:overflow-visible xl:snap-none">
        {dayList.map((day) => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const content = renderDay(dateStr, day);
          return (
            <div
              key={dateStr}
              className="min-w-[78%] snap-start rounded-xl border border-slate-800 bg-slate-900 sm:min-w-[46%] xl:min-w-0"
            >
              <div className="border-b border-slate-800 px-3 py-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {format(day, 'EEE')}
                </p>
                <p className="text-sm font-semibold text-slate-100">{format(day, 'd MMM')}</p>
              </div>
              <div className="p-3">
                {content || (
                  <p className="py-6 text-center text-xs text-slate-500">{emptyLabel}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
