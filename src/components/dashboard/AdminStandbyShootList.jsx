import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import CountdownCard from './CountdownCard';
import {
  buildRelativeShootPager,
  getPrimaryShootDateTime,
  isShootCancelled,
} from '../utils/scheduleUtils';

const ITEMS_PER_PAGE = 3;

export default function AdminStandbyShootList({
  shoots = [],
  allUsers = [],
  userEmail,
  rigSettings = [],
  standbyDays = [],
  onUpdate,
  isAdmin = false
}) {
  const [offset, setOffset] = useState(0);

  const standbyWindows = useMemo(() => {
    return standbyDays
      .map((sd) => {
        const startDate = sd.start_date || sd.date;
        const endDate = sd.end_date || startDate;

        if (!startDate || !endDate) return null;

        return {
          ...sd,
          startDt: new Date(`${startDate}T${sd.start_time || '00:00'}`),
          endDt: new Date(`${endDate}T${sd.end_time || '23:59:59'}`),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.startDt - b.startDt);
  }, [standbyDays]);

  const allStandbyShoots = useMemo(() => {
    const seen = new Map();

    shoots
      .filter((shoot) => !isShootCancelled(shoot))
      .forEach((shoot) => {
        const primaryDateTime = getPrimaryShootDateTime(shoot);
        if (!primaryDateTime) return;

        const isCovered = standbyWindows.some((windowObj) => {
          return primaryDateTime >= windowObj.startDt && primaryDateTime <= windowObj.endDt;
        });

        if (isCovered && !seen.has(shoot.id)) {
          seen.set(shoot.id, shoot);
        }
      });

    return Array.from(seen.values());
  }, [shoots, standbyWindows]);

  useEffect(() => {
    setOffset(0);
  }, [shoots, standbyDays]);

  const pager = useMemo(() => buildRelativeShootPager(allStandbyShoots, ITEMS_PER_PAGE, new Date()), [allStandbyShoots]);
  const visibleShoots = useMemo(() => pager.getVisibleShoots(offset), [pager, offset]);
  const canGoPrevious = offset > pager.minOffset;
  const canGoNext = offset < pager.maxOffset;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 rounded-xl bg-gray-800/50 px-3 py-2">
        <button
          onClick={() => setOffset((p) => Math.max(pager.minOffset, p - 1))}
          disabled={!canGoPrevious}
          className="rounded p-1 hover:bg-gray-700 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-gray-400" />
        </button>

        <div className="flex-1 text-center">
          <span className="text-sm font-semibold text-white">Standby Coverage Shoots</span>
          <span className="ml-2 text-xs text-gray-500">({allStandbyShoots.length} total)</span>
        </div>

        <button
          onClick={() => setOffset((p) => Math.min(pager.maxOffset, p + 1))}
          disabled={!canGoNext}
          className="rounded p-1 hover:bg-gray-700 disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </button>
      </div>

      {allStandbyShoots.length === 0 ? (
        <div className="py-6 text-center text-sm italic text-gray-500">
          No shoots during standby coverage.
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {visibleShoots.map((shoot) => (
              <CountdownCard
                key={shoot.id}
                shoot={shoot}
                isAdmin={isAdmin}
                rigSettings={rigSettings}
                onUpdate={onUpdate}
                userEmail={userEmail}
                allUsers={allUsers}
              />
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2">
            <button
              onClick={() => setOffset((p) => Math.max(pager.minOffset, p - 1))}
              disabled={!canGoPrevious}
              className="text-xs text-gray-400 disabled:opacity-30"
            >
              Previous Shoots
            </button>

            <span className="text-[10px] font-bold text-gray-600">
              {offset < 0 ? 'OLDER SHOOTS' : offset === 0 ? 'CURRENT / NEXT' : 'UPCOMING SHOOTS'}
            </span>

            <button
              onClick={() => setOffset((p) => Math.min(pager.maxOffset, p + 1))}
              disabled={!canGoNext}
              className="text-xs font-semibold text-blue-500 disabled:opacity-30"
            >
              Next Shoots
            </button>
          </div>
        </>
      )}
    </div>
  );
}
