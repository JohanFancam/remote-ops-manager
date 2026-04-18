import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import CountdownCard from './CountdownCard';
import { getScheduleDateTimes } from '../utils/scheduleUtils';

const ITEMS_PER_PAGE = 3;

function getPrimaryDateTime(shoot) {
  const phaseDates = getScheduleDateTimes(shoot);
  return (
    phaseDates.setup ||
    phaseDates.pre_shoot ||
    phaseDates.game ||
    new Date(`${shoot.date}T${shoot.game_time || '23:59'}`)
  );
}

function isCompleted(shoot) {
  return !!shoot?.phase_status?.shoot_complete || shoot?.status === 'completed';
}

export default function AdminStandbyShootList({
  shoots = [],
  allUsers = [],
  userEmail,
  rigSettings = [],
  standbyDays = [],
  onUpdate,
  isAdmin = false
}) {
  const [page, setPage] = useState(0);

  const standbyDates = useMemo(() => {
    const allDates = new Set();

    standbyDays.forEach((sd) => {
      const start = sd.start_date || sd.date;
      const end = sd.end_date || start;

      if (!start || !end) return;

      let cursor = new Date(`${start}T12:00:00`);
      const endDate = new Date(`${end}T12:00:00`);

      while (cursor <= endDate) {
        allDates.add(format(cursor, 'yyyy-MM-dd'));
        cursor.setDate(cursor.getDate() + 1);
      }
    });

    return Array.from(allDates).sort();
  }, [standbyDays]);

  const getShootsForDate = (dateStr) => {
    return shoots.filter((shoot) => shoot.date === dateStr);
  };

  const allStandbyShoots = useMemo(() => {
    const seen = new Map();

    standbyDates.forEach((dateStr) => {
      getShootsForDate(dateStr).forEach((shoot) => {
        if (!seen.has(shoot.id)) {
          seen.set(shoot.id, shoot);
        }
      });
    });

    return Array.from(seen.values()).sort((a, b) => {
      const aComplete = isCompleted(a);
      const bComplete = isCompleted(b);

      if (aComplete !== bComplete) return aComplete ? 1 : -1;
      return getPrimaryDateTime(a) - getPrimaryDateTime(b);
    });
  }, [standbyDates, shoots]);

  useEffect(() => {
    setPage(0);
  }, [shoots, standbyDays]);

  const totalPages = Math.max(1, Math.ceil(allStandbyShoots.length / ITEMS_PER_PAGE));
  const visibleShoots = allStandbyShoots.slice(
    page * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE + ITEMS_PER_PAGE
  );

  return (
    <div>
      <div className="mb-3 flex items-center gap-2 rounded-xl bg-gray-800/50 px-3 py-2">
        <button
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0}
          className="rounded p-1 hover:bg-gray-700 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-gray-400" />
        </button>

        <div className="flex-1 text-center">
          <span className="text-sm font-semibold text-white">Standby Coverage Shoots</span>
          <span className="ml-2 text-xs text-gray-500">({allStandbyShoots.length} total)</span>
        </div>

        <button
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={page >= totalPages - 1}
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

          {allStandbyShoots.length > ITEMS_PER_PAGE && (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="text-xs text-gray-400 disabled:opacity-30"
              >
                Previous 3
              </button>

              <span className="text-[10px] font-bold text-gray-600">
                SHOWING {page * ITEMS_PER_PAGE + 1}-{Math.min((page + 1) * ITEMS_PER_PAGE, allStandbyShoots.length)} OF {allStandbyShoots.length}
              </span>

              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
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