import React, { useState, useEffect, useMemo, useRef } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, List } from 'lucide-react';
import CountdownCard from './CountdownCard';

export default function AdminStandbyShootList({ shoots = [], allUsers = [], userEmail, standbyDays = [], rigSettings = [], onUpdate, isAdmin = true }) {
  const [now, setNow] = useState(new Date());
  const [viewMode, setViewMode] = useState('day');
  const [monthDate, setMonthDate] = useState(new Date());
  const [monthSelectedDate, setMonthSelectedDate] = useState(null);

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(iv);
  }, []);

  const todayStr = format(now, 'yyyy-MM-dd');

  // All dates covered by the admin's standby entries (past + future)
  const standbyDates = useMemo(() => {
    if (!standbyDays.length) return [];
    const dates = new Set();
    standbyDays.forEach(sd => {
      const start = sd.start_date || sd.date;
      const end = sd.end_date || start;
      if (!start) return;
      const cur = new Date(start + 'T12:00:00');
      const last = new Date(end + 'T12:00:00');
      while (cur <= last) {
        dates.add(format(cur, 'yyyy-MM-dd'));
        cur.setDate(cur.getDate() + 1);
      }
    });
    return Array.from(dates).sort();
  }, [standbyDays]);

  // Day view: selected date index — find today or nearest future standby date
  const getDefaultIdx = (dates) => {
    if (!dates.length) return 0;
    const todayIdx = dates.indexOf(todayStr);
    if (todayIdx >= 0) return todayIdx;
    // Find first future date
    const futureIdx = dates.findIndex(d => d > todayStr);
    if (futureIdx >= 0) return futureIdx;
    // All past — go to last
    return dates.length - 1;
  };
  const [selectedDateIdx, setSelectedDateIdx] = useState(() => getDefaultIdx(standbyDates));

  // Re-sync when standbyDates loads async
  const prevStandbyLenRef = React.useRef(0);
  useEffect(() => {
    if (standbyDates.length !== prevStandbyLenRef.current) {
      prevStandbyLenRef.current = standbyDates.length;
      setSelectedDateIdx(getDefaultIdx(standbyDates));
    }
  }, [standbyDates]);

  // Get shoots for a given date, respecting standby time windows
  const getShootsForDate = (dateStr) => {
    const dayShots = shoots.filter(s => s.date === dateStr);
    return dayShots.filter(shoot => {
      const shootTime = shoot.game_time || '12:00';
      const shootDt = new Date(`${shoot.date}T${shootTime}`);
      return standbyDays.some(sd => {
        const start = sd.start_date || sd.date;
        const end = sd.end_date || start;
        if (dateStr < start || dateStr > end) return false;
        if (dateStr === start && sd.start_time) {
          if (shootDt < new Date(`${start}T${sd.start_time}`)) return false;
        }
        if (dateStr === end && sd.end_time) {
          if (shootDt >= new Date(`${end}T${sd.end_time}`)) return false;
        }
        return true;
      });
    });
  };

  const selectedDate = standbyDates[selectedDateIdx];
  const dayShootsList = selectedDate ? getShootsForDate(selectedDate) : [];
  const isPastDay = selectedDate && selectedDate < todayStr;

  // Month view
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart);
  const monthDayShootsList = monthSelectedDate ? getShootsForDate(monthSelectedDate) : [];

  const isCompleted = (shoot) => !!shoot.phase_status?.shoot_complete || shoot.status === 'completed';

  if (standbyDates.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm italic">
        No standby coverage assigned.
      </div>
    );
  }

  return (
    <div>
      {/* View toggle */}
      <div className="flex justify-end mb-3">
        <div className="flex bg-gray-800 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('day')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'day' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <List className="h-3.5 w-3.5" /> Day
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
              viewMode === 'month' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" /> Month
          </button>
        </div>
      </div>

      {/* MONTH VIEW */}
      {viewMode === 'month' && (
        <div>
          <div className="flex items-center gap-2 bg-gray-800/50 rounded-xl px-3 py-2 mb-3">
            <button onClick={() => setMonthDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="p-1 rounded hover:bg-gray-700 transition-colors">
              <ChevronLeft className="h-4 w-4 text-gray-400" />
            </button>
            <div className="flex-1 text-center text-sm font-semibold text-white">
              {format(monthDate, 'MMMM yyyy')}
            </div>
            <button onClick={() => setMonthDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="p-1 rounded hover:bg-gray-700 transition-colors">
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
              <div key={d} className="text-center text-xs text-gray-600 font-medium py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 mb-4">
            {Array.from({ length: startPadding }).map((_, i) => <div key={`pad-${i}`} />)}
            {monthDays.map(day => {
              const ds = format(day, 'yyyy-MM-dd');
              const isStandby = standbyDates.includes(ds);
              const dayShots = isStandby ? getShootsForDate(ds) : [];
              const isToday = ds === todayStr;
              const isSelected = ds === monthSelectedDate;
              const isPast = ds < todayStr;
              return (
                <button
                  key={ds}
                  onClick={() => isStandby ? setMonthSelectedDate(isSelected ? null : ds) : null}
                  className={`relative flex flex-col items-center py-1.5 rounded-lg transition-colors ${
                    isSelected ? 'bg-blue-600' :
                    isToday && isStandby ? 'bg-gray-700' :
                    isStandby && dayShots.length > 0 ? 'bg-gray-800 hover:bg-gray-700' :
                    isStandby ? 'bg-gray-800/40 hover:bg-gray-700/40' :
                    'opacity-30'
                  } ${!isStandby ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <span className={`text-xs font-medium ${
                    isSelected ? 'text-white' :
                    isToday ? 'text-blue-400' :
                    isStandby && !isPast ? 'text-white' :
                    isStandby ? 'text-gray-500' : 'text-gray-700'
                  }`}>{format(day, 'd')}</span>
                  {dayShots.length > 0 && (
                    <span className={`text-xs mt-0.5 font-bold ${isSelected ? 'text-blue-200' : isPast ? 'text-gray-500' : 'text-blue-400'}`}>
                      {dayShots.length}
                    </span>
                  )}
                  {isStandby && dayShots.length === 0 && (
                    <span className="text-xs mt-0.5 text-gray-700">•</span>
                  )}
                </button>
              );
            })}
          </div>

          {monthSelectedDate && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">
                {format(new Date(monthSelectedDate + 'T12:00:00'), 'EEEE, MMM d')} — {monthDayShootsList.length} shoot{monthDayShootsList.length !== 1 ? 's' : ''}
              </p>
              {monthDayShootsList.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm italic">No shoots during your standby window.</div>
              ) : (
                <div className="space-y-2">
                  {monthDayShootsList.map(shoot => (
                    <div key={shoot.id} className={isCompleted(shoot) ? 'opacity-50' : ''}>
                      <CountdownCard
                        shoot={shoot}
                        isAdmin={isAdmin}
                        rigSettings={rigSettings}
                        onUpdate={onUpdate}
                        userEmail={userEmail}
                        allUsers={allUsers}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* DAY VIEW */}
      {viewMode === 'day' && (
        <div>
          {/* Day navigator */}
          <div className="flex items-center gap-2 bg-gray-800/50 rounded-xl px-3 py-2 mb-3">
            <button
              onClick={() => setSelectedDateIdx(i => Math.max(0, i - 1))}
              disabled={selectedDateIdx === 0}
              className="p-1 rounded hover:bg-gray-700 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-gray-400" />
            </button>
            <div className="flex-1 text-center">
              <span className="text-sm font-semibold text-white">
                {selectedDate === todayStr ? 'Today — ' : ''}
                {selectedDate ? format(new Date(selectedDate + 'T12:00:00'), 'EEEE, MMM d') : '—'}
              </span>
              <span className="text-xs text-gray-500 ml-2">
                ({dayShootsList.length} shoot{dayShootsList.length !== 1 ? 's' : ''})
              </span>
              {isPastDay && <span className="ml-2 text-xs text-gray-600 italic">past</span>}
            </div>
            <button
              onClick={() => setSelectedDateIdx(i => Math.min(standbyDates.length - 1, i + 1))}
              disabled={selectedDateIdx === standbyDates.length - 1}
              className="p-1 rounded hover:bg-gray-700 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </button>
          </div>

          {dayShootsList.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-sm italic">
              No shoots during your standby window on this day.
            </div>
          ) : (
            <div className="space-y-2">
              {dayShootsList.map(shoot => (
                <div key={shoot.id} className={isCompleted(shoot) ? 'opacity-50' : ''}>
                  <CountdownCard
                    shoot={shoot}
                    isAdmin={isAdmin}
                    rigSettings={rigSettings}
                    onUpdate={onUpdate}
                    userEmail={userEmail}
                    allUsers={allUsers}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}