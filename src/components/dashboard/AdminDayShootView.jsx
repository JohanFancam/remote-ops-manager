import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, List } from 'lucide-react';
import CountdownCard from './CountdownCard';

export default function AdminDayShootView({ shoots = [], isAdmin, rigSettings, onUpdate, userEmail, allUsers }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState('day'); // 'day' | 'month'
  const [monthDate, setMonthDate] = useState(new Date());

  // Auto-advance selectedDate at midnight
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

  // Shoots from previous days that are still in progress (not marked complete)
  const inProgressPast = shoots.filter(s =>
    s.date < todayStr &&
    !s.phase_status?.shoot_complete
  );

  // Unique dates from upcoming shoots + always include today
  const allDates = [...new Set([...shoots.map(s => s.date), todayStr])].sort();

  const safeIndex = allDates.includes(selectedDate) ? allDates.indexOf(selectedDate) : allDates.indexOf(todayStr);
  const currentDate = allDates[safeIndex] || todayStr;

  const dayShootsList = shoots.filter(s => s.date === currentDate);

  const goBack = () => {
    if (safeIndex > 0) setSelectedDate(allDates[safeIndex - 1]);
  };
  const goForward = () => {
    if (safeIndex < allDates.length - 1) setSelectedDate(allDates[safeIndex + 1]);
  };

  // Month view helpers
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart); // 0=Sun
  const shootsByDate = shoots.reduce((acc, s) => {
    acc[s.date] = acc[s.date] || [];
    acc[s.date].push(s);
    return acc;
  }, {});

  const [monthSelectedDate, setMonthSelectedDate] = useState(null);
  const monthDayShootsList = monthSelectedDate ? (shootsByDate[monthSelectedDate] || []) : [];

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
          {/* Month navigator */}
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

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
              <div key={d} className="text-center text-xs text-gray-600 font-medium py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 mb-4">
            {Array.from({ length: startPadding }).map((_, i) => <div key={`pad-${i}`} />)}
            {monthDays.map(day => {
              const ds = format(day, 'yyyy-MM-dd');
              const dayShots = shootsByDate[ds] || [];
              const isToday = ds === todayStr;
              const isSelected = ds === monthSelectedDate;
              return (
                <button
                  key={ds}
                  onClick={() => setMonthSelectedDate(isSelected ? null : ds)}
                  className={`relative flex flex-col items-center py-1.5 rounded-lg transition-colors ${
                    isSelected ? 'bg-blue-600' :
                    isToday ? 'bg-gray-700' :
                    dayShots.length > 0 ? 'bg-gray-800 hover:bg-gray-700' : 'hover:bg-gray-800/50'
                  }`}
                >
                  <span className={`text-xs font-medium ${
                    isSelected ? 'text-white' : isToday ? 'text-blue-400' : dayShots.length > 0 ? 'text-white' : 'text-gray-600'
                  }`}>{format(day, 'd')}</span>
                  {dayShots.length > 0 && (
                    <span className={`text-xs mt-0.5 font-bold ${
                      isSelected ? 'text-blue-200' : 'text-blue-400'
                    }`}>{dayShots.length}</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected day shoots */}
          {monthSelectedDate && (
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 font-medium">
                {format(new Date(monthSelectedDate + 'T12:00:00'), 'EEEE, MMM d')} — {monthDayShootsList.length} shoot{monthDayShootsList.length !== 1 ? 's' : ''}
              </p>
              {monthDayShootsList.length === 0 ? (
                <div className="text-center py-4 text-gray-500 text-sm italic">No shoots on this day.</div>
              ) : (
                <div className="space-y-2">
                  {monthDayShootsList.map(shoot => (
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
              )}
            </div>
          )}
        </div>
      )}

      {/* DAY VIEW */}
      {viewMode === 'day' && (
        <div>
          {/* In-progress shoots from previous days */}
          {inProgressPast.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-yellow-400 font-semibold uppercase tracking-wider mb-2">⚡ Still In Progress (from previous day)</p>
              <div className="space-y-2">
                {inProgressPast.map(shoot => (
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
            </div>
          )}

          {/* Day navigator */}
          <div className="flex items-center gap-2 bg-gray-800/50 rounded-xl px-3 py-2 mb-3">
            <button
              onClick={goBack}
              disabled={safeIndex === 0}
              className="p-1 rounded hover:bg-gray-700 disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="h-4 w-4 text-gray-400" />
            </button>
            <div className="flex-1 text-center">
              <span className="text-sm font-semibold text-white">
                {currentDate === todayStr ? 'Today — ' : ''}{format(new Date(currentDate + 'T12:00:00'), 'EEEE, MMM d')}
              </span>
              <span className="text-xs text-gray-500 ml-2">
                ({dayShootsList.length} shoot{dayShootsList.length !== 1 ? 's' : ''})
              </span>
            </div>
            <button
              onClick={goForward}
              disabled={safeIndex === allDates.length - 1}
              className="p-1 rounded hover:bg-gray-700 disabled:opacity-30 transition-colors"
            >
              <ChevronRight className="h-4 w-4 text-gray-400" />
            </button>
          </div>

          {/* Shoots for selected day */}
          {dayShootsList.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-sm italic">No assigned shoots on this day.</div>
          ) : (
            <div className="space-y-2">
              {dayShootsList.map(shoot => (
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
          )}
        </div>
      )}
    </div>
  );
}