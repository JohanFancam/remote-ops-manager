import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import CountdownCard from './CountdownCard';
import {
  getPrimaryDateTime,
  getCurrentOrNextShootIndex,
  isShootCancelled,
  isShootWithinStandbyWindow,
} from '../utils/scheduleUtils';

const ITEMS_PER_PAGE = 3;

export default function AdminStandbyShootList({
  shoots = [],
  allUsers = [],
  userEmail,
  rigSettings = [],
  standbyDays = [],
  onUpdate,
  isAdmin = false,
}) {
  const [startIndex, setStartIndex] = useState(0);

  const allStandbyShoots = useMemo(() => {
    const seen = new Map();

    shoots
      .filter((shoot) => !isShootCancelled(shoot))
      .forEach((shoot) => {
        const inAnyStandbyWindow = standbyDays.some((standbyDay) =>
          isShootWithinStandbyWindow(shoot, standbyDay)
        );

        if (inAnyStandbyWindow && !seen.has(shoot.id)) {
          seen.set(shoot.id, shoot);
        }
      });

    return Array.from(seen.values()).sort((a, b) => getPrimaryDateTime(a) - getPrimaryDateTime(b));
  }, [shoots, standbyDays]);

  const anchorIndex = useMemo(() => {
    if (allStandbyShoots.length === 0) return 0;
    return getCurrentOrNextShootIndex(allStandbyShoots, new Date());
  }, [allStandbyShoots]);

  useEffect(() => {
    setStartIndex(anchorIndex);
  }, [anchorIndex, shoots, standbyDays]);

  const maxStartIndex = Math.max(0, allStandbyShoots.length - ITEMS_PER_PAGE);
  const safeStartIndex = Math.min(startIndex, maxStartIndex);
  const visibleShoots = allStandbyShoots.slice(
    safeStartIndex,
    safeStartIndex + ITEMS_PER_PAGE
  );
  const hasPreviousShoots = safeStartIndex > 0;
  const hasNextShoots = safeStartIndex + ITEMS_PER_PAGE < allStandbyShoots.length;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 rounded-xl bg-gray-800/50 px-3 py-2">
        <button
          onClick={() => setStartIndex((idx) => Math.max(0, idx - ITEMS_PER_PAGE))}
          disabled={!hasPreviousShoots}
          className="rounded p-1 hover:bg-gray-700 disabled:opacity-30 transition-colors"
          title="Previous shoots"
        >
          <ChevronLeft className="h-4 w-4 text-gray-400" />
        </button>

        <div className="flex-1 text-center">
          <span className="text-sm font-semibold text-white">Standby Coverage Shoots</span>
          <span className="ml-2 text-xs text-gray-500">({allStandbyShoots.length} total)</span>
        </div>

        <button
          onClick={() => setStartIndex((idx) => Math.min(maxStartIndex, idx + ITEMS_PER_PAGE))}
          disabled={!hasNextShoots}
          className="rounded p-1 hover:bg-gray-700 disabled:opacity-30 transition-colors"
          title="Next shoots"
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

          {allStandbyShoots.length > ITEMS_PER_PAGE && (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2">
              <button
                onClick={() => setStartIndex((idx) => Math.max(0, idx - ITEMS_PER_PAGE))}
                disabled={!hasPreviousShoots}
                className="text-xs text-gray-400 disabled:opacity-30"
              >
                Previous 3
              </button>

              <span className="text-[10px] font-bold text-gray-600">
                SHOWING {safeStartIndex + 1}-{Math.min(safeStartIndex + ITEMS_PER_PAGE, allStandbyShoots.length)} OF {allStandbyShoots.length}
              </span>

              <button
                onClick={() => setStartIndex((idx) => Math.min(maxStartIndex, idx + ITEMS_PER_PAGE))}
                disabled={!hasNextShoots}
                className="text-xs font-semibold text-blue-500 disabled:opacity-30"
              >
                Next 3
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
