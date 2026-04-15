import React, { useEffect, useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, List } from 'lucide-react';
import CountdownCard from './CountdownCard';
import { getScheduleDateTimes } from '../utils/scheduleUtils';

const ITEMS_PER_PAGE = 4;

export default function AdminDayShootView({ shoots = [], isAdmin, rigSettings, onUpdate, userEmail, allUsers }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState('day');
  const [monthDate, setMonthDate] = useState(new Date());
  const [monthSelectedDate, setMonthSelectedDate] = useState(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    let lastDate = format(new Date(), 'yyyy-MM-dd');
    const iv = setInterval(() => {
      const nowDate = format(new Date(), 'yyyy-MM-dd');
      if (nowDate !== lastDate) {
        lastDate = nowDate;
        setSelectedDate(nowDate);
      }
    }, 10000);
    return () => clearInterval(iv);
  }, []);

  const sortedShoots = useMemo(() => {
    return [...shoots].sort((a, b) => {
      const aDate = getScheduleDateTimes(a).setup || getScheduleDateTimes(a).game || new Date(`${a.date}T${a.game_time || '23:59'}`);
      const bDate = getScheduleDateTimes(b).setup || getScheduleDateTimes(b).game || new Date(`${b.date}T${b.game_time || '23:59'}`);
      return aDate - bDate;
    });
  }, [shoots]);

  const allDates = [...new Set([...sortedShoots.map((s) => s.date), todayStr])].sort();

  useEffect(() => {
    const idx = allDates.includes(selectedDate) ? allDates.indexOf(selectedDate) : allDates.indexOf(todayStr);
    const currentShots = sortedShoots.filter((s) => s.date === (allDates[idx] || todayStr));
    const allComplete = currentShots.length > 0 && currentShots.every((s) => s.phase_status?.shoot_complete || s.status === 'completed');
    if (allComplete) {
      for (let i = idx + 1; i < allDates.length; i++) {
        const nextShots = sortedShoots.filter((s) => s.date === allDates[i]);
        if (nextShots.some((s) => !s.phase_status?.shoot_complete && s.status !== 'completed')) {
          setSelectedDate(allDates[i]);
          break;
        }
      }
    }
  }, [sortedShoots, selectedDate, allDates, todayStr]);

  useEffect(() => {
    setPage(0);
  }, [selectedDate, monthSelectedDate, viewMode]);

  const safeIndex = allDates.includes(selectedDate) ? allDates.indexOf(selectedDate) : allDates.indexOf(todayStr);
  const currentDate = allDates[safeIndex] || todayStr;
  const dayShootsList = sortedShoots.filter((s) => s.date === currentDate);
  const totalPages = Math.max(1, Math.ceil(dayShootsList.length / ITEMS_PER_PAGE));
  const visibleShoots = dayShootsList.slice(page * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE + ITEMS_PER_PAGE);

  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart);
  const shootsByDate = sortedShoots.reduce((acc, s) => {
    acc[s.date] = acc[s.date] || [];
    acc[s.date].push(s);
    return acc;
  }, {});
  const monthDayShootsList = monthSelectedDate ? (shootsByDate[monthSelectedDate] || []) : [];
  const monthVisibleShoots = monthDayShootsList.slice(0, ITEMS_PER_PAGE);

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <div className="flex rounded-lg bg-gray-800 p-0.5">
          <button
            onClick={() => setViewMode('day')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'day' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <List className="h-3.5 w-3.5" /> Day
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'month' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <CalendarDays className="h-3.5 w-3.5" /> Month
          </button>
        </div>
      </div>

      {viewMode === 'month' && (
        <div>
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-gray-800/50 px-3 py-2">
            <button onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="rounded p-1 hover:bg-gray-700 transition-colors">
              <ChevronLeft className="h-4 w-4 text-gray-400" />
            </button>
            <div className="flex-1 text-center text-sm font-semibold text-white">{format(monthDate, 'MMMM yyyy')}</div>
            <button onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="rounded p-1 hover:bg-gray-700 transition-colors">
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7 gap-1">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
              <div key={d} className="py-1 text-center text-xs font-medium text-gray-600">{d}</div>
            ))}
          </div>
          <div className="mb-4 grid grid-cols-7 gap-1">
            {Array.from({ length: startPadding }).map((_, i) => <div key={`pad-${i}`} />)}
            {monthDays.map((day) => {
              const ds = format(day, 'yyyy-MM-dd');
              const dayShots = shootsByDate[ds] || [];
              const isToday = ds === todayStr;
              const isSelected = ds === monthSelectedDate;
              return (
                <button
                  key={ds}
                  onClick={() => setMonthSelectedDate(isSelected ? null : ds)}
                  className={`relative flex flex-col items-center rounded-lg py-1.5 transition-colors ${
                    isSelected ? 'bg-blue-600' :
                    isToday ? 'bg-gray-700' :
                    dayShots.length > 0 ? 'bg-gray-800 hover:bg-gray-700' : 'hover:bg-gray-800/50'
                  }`}
                >
                  <span className={`text-xs font-medium ${isSelected ? 'text-white' : isToday ? 'text-blue-400' : dayShots.length > 0 ? 'text-white' : 'text-gray-600'}`}>{format(day, 'd')}</span>
                  {dayShots.length > 0 && <span className={`mt-0.5 text-xs font-bold ${isSelected ? 'text-blue-200' : 'text-blue-400'}`}>{dayShots.length}</span>}
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
                <div className="py-4 text-center text-sm italic text-gray-500">No shoots on this day.</div>
              ) : (
                <>
                  <div className="space-y-2">
                    {monthVisibleShoots.map((shoot) => (
                      <CountdownCard key={shoot.id} shoot={shoot} isAdmin={isAdmin} rigSettings={rigSettings} onUpdate={onUpdate} userEmail={userEmail} allUsers={allUsers} />
                    ))}
                  </div>
                  {monthDayShootsList.length > ITEMS_PER_PAGE && (
                    <div className="mt-2 text-center text-xs text-gray-500">Showing first {ITEMS_PER_PAGE} shoots for this day</div>
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
            <button onClick={() => safeIndex > 0 && setSelectedDate(allDates[safeIndex - 1])} disabled={safeIndex === 0} className="rounded p-1 hover:bg-gray-700 disabled:opacity-30 transition-colors">
              <ChevronLeft className="h-4 w-4 text-gray-400" />
            </button>
            <div className="flex-1 text-center">
              <span className="text-sm font-semibold text-white">{currentDate === todayStr ? 'Today — ' : ''}{format(new Date(`${currentDate}T12:00:00`), 'EEEE, MMM d')}</span>
              <span className="ml-2 text-xs text-gray-500">({dayShootsList.length} shoot{dayShootsList.length !== 1 ? 's' : ''})</span>
            </div>
            <button onClick={() => safeIndex < allDates.length - 1 && setSelectedDate(allDates[safeIndex + 1])} disabled={safeIndex === allDates.length - 1} className="rounded p-1 hover:bg-gray-700 disabled:opacity-30 transition-colors">
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </button>
          </div>

          {dayShootsList.length === 0 ? (
            <div className="py-6 text-center text-sm italic text-gray-500">No assigned shoots on this day.</div>
          ) : (
            <>
              <div className="space-y-2">
                {visibleShoots.map((shoot) => (
                  <CountdownCard key={shoot.id} shoot={shoot} isAdmin={isAdmin} rigSettings={rigSettings} onUpdate={onUpdate} userEmail={userEmail} allUsers={allUsers} />
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
