import React, { useEffect, useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, List } from 'lucide-react';
import CountdownCard from './CountdownCard';
import { getScheduleDateTimes } from '../utils/scheduleUtils';

const ITEMS_PER_PAGE = 4;

export default function AdminStandbyShootList({ shoots = [], allUsers = [], userEmail, standbyDays = [], rigSettings = [], onUpdate, isAdmin = true }) {
  const [now, setNow] = useState(new Date());
  const [viewMode, setViewMode] = useState('day');
  const [monthDate, setMonthDate] = useState(new Date());
  const [monthSelectedDate, setMonthSelectedDate] = useState(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(iv);
  }, []);

  const todayStr = format(now, 'yyyy-MM-dd');

  const standbyDates = useMemo(() => {
    const dates = new Set();
    standbyDays.forEach((sd) => {
      const start = sd.start_date || sd.date;
      const end = sd.end_date || start;
      if (!start) return;
      const cur = new Date(`${start}T12:00:00`);
      const last = new Date(`${end}T12:00:00`);
      while (cur <= last) {
        dates.add(format(cur, 'yyyy-MM-dd'));
        cur.setDate(cur.getDate() + 1);
      }
    });
    return Array.from(dates).sort();
  }, [standbyDays]);

  const getDefaultIdx = (dates) => {
    if (!dates.length) return 0;
    const todayIdx = dates.indexOf(todayStr);
    if (todayIdx >= 0) return todayIdx;
    const futureIdx = dates.findIndex((d) => d > todayStr);
    if (futureIdx >= 0) return futureIdx;
    return dates.length - 1;
  };

  const [selectedDateIdx, setSelectedDateIdx] = useState(() => getDefaultIdx(standbyDates));

  useEffect(() => {
    setSelectedDateIdx(getDefaultIdx(standbyDates));
  }, [standbyDates, todayStr]);

  useEffect(() => {
    setPage(0);
  }, [selectedDateIdx, monthSelectedDate, viewMode]);

  const getShootsForDate = (dateStr) => {
    return shoots
      .filter((s) => s.date === dateStr)
      .filter((shoot) => {
        const shootDt = getScheduleDateTimes(shoot).game || new Date(`${shoot.date}T${shoot.game_time || '12:00'}`);
        return standbyDays.some((sd) => {
          const start = sd.start_date || sd.date;
          const end = sd.end_date || start;
          if (dateStr < start || dateStr > end) return false;
          if (dateStr === start && sd.start_time && shootDt < new Date(`${start}T${sd.start_time}`)) return false;
          if (dateStr === end && sd.end_time && shootDt >= new Date(`${end}T${sd.end_time}`)) return false;
          return true;
        });
      })
      .sort((a, b) => {
        const aDate = getScheduleDateTimes(a).setup || getScheduleDateTimes(a).game;
        const bDate = getScheduleDateTimes(b).setup || getScheduleDateTimes(b).game;
        return aDate - bDate;
      });
  };

  const selectedDate = standbyDates[selectedDateIdx];
  const dayShootsList = selectedDate ? getShootsForDate(selectedDate) : [];
  const visibleShoots = dayShootsList.slice(page * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE + ITEMS_PER_PAGE);
  const totalPages = Math.max(1, Math.ceil(dayShootsList.length / ITEMS_PER_PAGE));

  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart);
  const monthDayShootsList = monthSelectedDate ? getShootsForDate(monthSelectedDate) : [];
  const monthVisibleShoots = monthDayShootsList.slice(0, ITEMS_PER_PAGE);

  const isCompleted = (shoot) => !!shoot.phase_status?.shoot_complete || shoot.status === 'completed';

  if (standbyDates.length === 0) {
    return <div className="py-8 text-center text-sm italic text-gray-500">No standby coverage assigned.</div>;
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <div className="flex rounded-lg bg-gray-800 p-0.5">
          <button onClick={() => setViewMode('day')} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'day' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}><List className="h-3.5 w-3.5" /> Day</button>
          <button onClick={() => setViewMode('month')} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'month' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}><CalendarDays className="h-3.5 w-3.5" /> Month</button>
        </div>
      </div>

      {viewMode === 'month' && (
        <div>
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-gray-800/50 px-3 py-2">
            <button onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="rounded p-1 hover:bg-gray-700 transition-colors"><ChevronLeft className="h-4 w-4 text-gray-400" /></button>
            <div className="flex-1 text-center text-sm font-semibold text-white">{format(monthDate, 'MMMM yyyy')}</div>
            <button onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="rounded p-1 hover:bg-gray-700 transition-colors"><ChevronRight className="h-4 w-4 text-gray-400" /></button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => <div key={d} className="py-1 text-center text-xs font-medium text-gray-600">{d}</div>)}
          </div>
          <div className="mb-4 grid grid-cols-7 gap-1">
            {Array.from({ length: startPadding }).map((_, i) => <div key={`pad-${i}`} />)}
            {monthDays.map((day) => {
              const ds = format(day, 'yyyy-MM-dd');
              const isStandby = standbyDates.includes(ds);
              const dayShots = isStandby ? getShootsForDate(ds) : [];
              const isToday = ds === todayStr;
              const isSelected = ds === monthSelectedDate;
              const isPast = ds < todayStr;
              return (
                <button
                  key={ds}
                  onClick={() => isStandby && setMonthSelectedDate(isSelected ? null : ds)}
                  className={`relative flex flex-col items-center rounded-lg py-1.5 transition-colors ${
                    isSelected ? 'bg-blue-600' :
                    isToday && isStandby ? 'bg-gray-700' :
                    isStandby && dayShots.length > 0 ? 'bg-gray-800 hover:bg-gray-700' :
                    isStandby ? 'bg-gray-800/40 hover:bg-gray-700/40' : 'opacity-30'
                  } ${!isStandby ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <span className={`text-xs font-medium ${isSelected ? 'text-white' : isToday ? 'text-blue-400' : isStandby && !isPast ? 'text-white' : isStandby ? 'text-gray-500' : 'text-gray-700'}`}>{format(day, 'd')}</span>
                  {dayShots.length > 0 ? <span className={`mt-0.5 text-xs font-bold ${isSelected ? 'text-blue-200' : isPast ? 'text-gray-500' : 'text-blue-400'}`}>{dayShots.length}</span> : isStandby ? <span className="mt-0.5 text-xs text-gray-700">•</span> : null}
                </button>
              );
            })}
          </div>

          {monthSelectedDate && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">{format(new Date(`${monthSelectedDate}T12:00:00`), 'EEEE, MMM d')} — {monthDayShootsList.length} shoot{monthDayShootsList.length !== 1 ? 's' : ''}</p>
              {monthDayShootsList.length === 0 ? (
                <div className="py-4 text-center text-sm italic text-gray-500">No shoots during your standby window.</div>
              ) : (
                <>
                  <div className="space-y-2">
                    {monthVisibleShoots.map((shoot) => (
                      <div key={shoot.id} className={isCompleted(shoot) ? 'opacity-50' : ''}>
                        <CountdownCard shoot={shoot} isAdmin={isAdmin} rigSettings={rigSettings} onUpdate={onUpdate} userEmail={userEmail} allUsers={allUsers} />
                      </div>
                    ))}
                  </div>
                  {monthDayShootsList.length > ITEMS_PER_PAGE && <div className="mt-2 text-center text-xs text-gray-500">Showing first {ITEMS_PER_PAGE} shoots for this day</div>}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {viewMode === 'day' && (
        <div>
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-gray-800/50 px-3 py-2">
            <button onClick={() => setSelectedDateIdx((i) => Math.max(0, i - 1))} disabled={selectedDateIdx === 0} className="rounded p-1 hover:bg-gray-700 disabled:opacity-30 transition-colors"><ChevronLeft className="h-4 w-4 text-gray-400" /></button>
            <div className="flex-1 text-center">
              <span className="text-sm font-semibold text-white">{selectedDate === todayStr ? 'Today — ' : ''}{selectedDate ? format(new Date(`${selectedDate}T12:00:00`), 'EEEE, MMM d') : '—'}</span>
              <span className="ml-2 text-xs text-gray-500">({dayShootsList.length} shoot{dayShootsList.length !== 1 ? 's' : ''})</span>
            </div>
            <button onClick={() => setSelectedDateIdx((i) => Math.min(standbyDates.length - 1, i + 1))} disabled={selectedDateIdx === standbyDates.length - 1} className="rounded p-1 hover:bg-gray-700 disabled:opacity-30 transition-colors"><ChevronRight className="h-4 w-4 text-gray-400" /></button>
          </div>

          {dayShootsList.length === 0 ? (
            <div className="py-6 text-center text-sm italic text-gray-500">No shoots during your standby window on this day.</div>
          ) : (
            <>
              <div className="space-y-2">
                {visibleShoots.map((shoot) => (
                  <div key={shoot.id} className={isCompleted(shoot) ? 'opacity-50' : ''}>
                    <CountdownCard shoot={shoot} isAdmin={isAdmin} rigSettings={rigSettings} onUpdate={onUpdate} userEmail={userEmail} allUsers={allUsers} />
                  </div>
                ))}
              </div>
              {dayShootsList.length > ITEMS_PER_PAGE && (
                <div className="mt-3 flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2">
                  <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="text-xs text-gray-400 disabled:opacity-30">Previous 4</button>
                  <span className="text-[10px] font-bold text-gray-600">SHOWING {page * ITEMS_PER_PAGE + 1}-{Math.min((page + 1) * ITEMS_PER_PAGE, dayShootsList.length)} OF {dayShootsList.length}</span>
                  <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="text-xs font-semibold text-blue-500 disabled:opacity-30">Next 4</button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
