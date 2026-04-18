import React, { useEffect, useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, List } from 'lucide-react';
import CountdownCard from './CountdownCard';
import {
  getPrimaryDateTime,
  getCurrentOrNextShootIndex,
  isShootCancelled,
} from '../utils/scheduleUtils';

const ITEMS_PER_PAGE = 3;

export default function AdminDayShootView({
  shoots = [],
  isAdmin,
  rigSettings,
  onUpdate,
  userEmail,
  allUsers,
}) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [viewMode, setViewMode] = useState('day');
  const [monthDate, setMonthDate] = useState(new Date());
  const [monthSelectedDate, setMonthSelectedDate] = useState(null);
  const [startIndex, setStartIndex] = useState(0);

  const assignedShoots = useMemo(() => {
    return [...shoots]
      .filter((shoot) => !isShootCancelled(shoot))
      .sort((a, b) => getPrimaryDateTime(a) - getPrimaryDateTime(b));
  }, [shoots]);

  const dayViewAnchorIndex = useMemo(() => {
    if (assignedShoots.length === 0) return 0;
    return getCurrentOrNextShootIndex(assignedShoots, new Date());
  }, [assignedShoots]);

  useEffect(() => {
    if (viewMode !== 'day') return;
    setStartIndex(dayViewAnchorIndex);
  }, [viewMode, dayViewAnchorIndex, assignedShoots.length]);

  const maxStartIndex = Math.max(0, assignedShoots.length - ITEMS_PER_PAGE);
  const safeStartIndex = Math.min(startIndex, maxStartIndex);
  const visibleShoots = assignedShoots.slice(
    safeStartIndex,
    safeStartIndex + ITEMS_PER_PAGE
  );

  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart);

  const shootsByDate = assignedShoots.reduce((acc, shoot) => {
    acc[shoot.date] = acc[shoot.date] || [];
    acc[shoot.date].push(shoot);
    return acc;
  }, {});

  const monthDayShootsList = monthSelectedDate
    ? (shootsByDate[monthSelectedDate] || []).filter((shoot) => !isShootCancelled(shoot))
    : [];

  const monthVisibleShoots = monthDayShootsList.slice(0, ITEMS_PER_PAGE);
  const hasPreviousShoots = safeStartIndex > 0;
  const hasNextShoots = safeStartIndex + ITEMS_PER_PAGE < assignedShoots.length;

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <div className="flex rounded-lg bg-gray-800 p-0.5">
          <button
            onClick={() => setViewMode('day')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === 'day' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <List className="h-3.5 w-3.5" />
            Day
          </button>

          <button
            onClick={() => setViewMode('month')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              viewMode === 'month' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" />
            Month
          </button>
        </div>
      </div>

      {viewMode === 'month' && (
        <div>
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-gray-800/50 px-3 py-2">
            <button
              onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
              className="rounded p-1 hover:bg-gray-700 transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-gray-400" />
            </button>

            <div className="flex-1 text-center text-sm font-semibold text-white">
              {format(monthDate, 'MMMM yyyy')}
            </div>

            <button
              onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
              className="rounded p-1 hover:bg-gray-700 transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <div key={d} className="py-1 text-center text-xs font-medium text-gray-600">
                {d}
              </div>
            ))}
          </div>

          <div className="mb-4 grid grid-cols-7 gap-1">
            {Array.from({ length: startPadding }).map((_, i) => (
              <div key={`pad-${i}`} />
            ))}

            {monthDays.map((day) => {
              const ds = format(day, 'yyyy-MM-dd');
              const dayShoots = (shootsByDate[ds] || []).filter((shoot) => !isShootCancelled(shoot));
              const isToday = ds === todayStr;
              const isSelected = ds === monthSelectedDate;

              return (
                <button
                  key={ds}
                  onClick={() => setMonthSelectedDate(isSelected ? null : ds)}
                  className={`relative flex flex-col items-center rounded-lg py-1.5 transition-colors ${
                    isSelected
                      ? 'bg-blue-600'
                      : isToday
                        ? 'bg-gray-700'
                        : dayShoots.length > 0
                          ? 'bg-gray-800 hover:bg-gray-700'
                          : 'hover:bg-gray-800/50'
                  }`}
                >
                  <span
                    className={`text-xs font-medium ${
                      isSelected
                        ? 'text-white'
                        : isToday
                          ? 'text-blue-400'
                          : dayShoots.length > 0
                            ? 'text-white'
                            : 'text-gray-600'
                    }`}
                  >
                    {format(day, 'd')}
                  </span>

                  {dayShoots.length > 0 && (
                    <span className={`mt-0.5 text-xs font-bold ${isSelected ? 'text-blue-200' : 'text-blue-400'}`}>
                      {dayShoots.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {monthSelectedDate && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">
                {format(new Date(`${monthSelectedDate}T12:00:00`), 'EEEE, MMM d')} — {monthDayShootsList.length} shoot{monthDayShootsList.length !== 1 ? 's' : ''}
              </p>

              {monthDayShootsList.length === 0 ? (
                <div className="py-4 text-center text-sm italic text-gray-500">
                  No shoots on this day.
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    {monthVisibleShoots.map((shoot) => (
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

                  {monthDayShootsList.length > ITEMS_PER_PAGE && (
                    <div className="mt-2 text-center text-xs text-gray-500">
                      Showing first {ITEMS_PER_PAGE} shoots for this day
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {viewMode === 'day' && (
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
              <span className="text-sm font-semibold text-white">Assigned Shoots</span>
              <span className="ml-2 text-xs text-gray-500">({assignedShoots.length} total)</span>
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

          {assignedShoots.length === 0 ? (
            <div className="py-6 text-center text-sm italic text-gray-500">
              No assigned shoots.
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

              {assignedShoots.length > ITEMS_PER_PAGE && (
                <div className="mt-3 flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2">
                  <button
                    onClick={() => setStartIndex((idx) => Math.max(0, idx - ITEMS_PER_PAGE))}
                    disabled={!hasPreviousShoots}
                    className="text-xs text-gray-400 disabled:opacity-30"
                  >
                    Previous 3
                  </button>

                  <span className="text-[10px] font-bold text-gray-600">
                    SHOWING {safeStartIndex + 1}-{Math.min(safeStartIndex + ITEMS_PER_PAGE, assignedShoots.length)} OF {assignedShoots.length}
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
      )}
    </div>
  );
}
