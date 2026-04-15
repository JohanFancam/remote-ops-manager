import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, List } from 'lucide-react';
// Corrected import: assumes CountdownCard is in a components folder
import CountdownCard from '../components/CountdownCard'; 

export default function AdminDayShootView({ shoots = [], isAdmin, rigSettings, onUpdate, userEmail, allUsers }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState('day'); // 'day' | 'month'
  const [monthDate, setMonthDate] = useState(new Date());

  // --- NEW: Shoot Pagination State ---
  const [shootPage, setShootPage] = useState(0);
  const itemsPerPage = 4;

  // Reset the shoot list to page 1 whenever the user changes the calendar date
  useEffect(() => {
    setShootPage(0);
  }, [selectedDate]);

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

  // Calendar Date Logic
  const allDates = [...new Set([...shoots.map(s => s.date), todayStr])].sort();
  const safeIndex = allDates.includes(selectedDate) ? allDates.indexOf(selectedDate) : allDates.indexOf(todayStr);
  const currentDate = allDates[safeIndex] || todayStr;

  // Filter shoots for the specific day selected
  const dayShootsList = shoots.filter(s => s.date === currentDate);

  // --- NEW: Calculation for "Max 4 at a time" ---
  const startIndex = shootPage * itemsPerPage;
  const visibleShoots = dayShootsList.slice(startIndex, startIndex + itemsPerPage);
  const totalShootPages = Math.ceil(dayShootsList.length / itemsPerPage);

  const goBackDay = () => {
    if (safeIndex > 0) setSelectedDate(allDates[safeIndex - 1]);
  };
  const goForwardDay = () => {
    if (safeIndex < allDates.length - 1) setSelectedDate(allDates[safeIndex + 1]);
  };

  // Month view helpers
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart);
  const shootsByDate = shoots.reduce((acc, s) => {
    acc[s.date] = acc[s.date] || [];
    acc[s.date].push(s);
    return acc;
  }, {});

  const [monthSelectedDate, setMonthSelectedDate] = useState(null);
  const monthDayShootsList = monthSelectedDate ? (shootsByDate[monthSelectedDate] || []) : [];

  return (
    <div className="w-full max-w-4xl mx-auto">
      {/* View toggle */}
      <div className="flex justify-end mb-4">
        <div className="flex bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode('day')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
              viewMode === 'day' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            <List className="h-3.5 w-3.5" /> DAY VIEW
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
              viewMode === 'month' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
            }`}
          >
            <CalendarDays className="h-3.5 w-3.5" /> MONTH
          </button>
        </div>
      </div>

      {/* MONTH VIEW */}
      {viewMode === 'month' && (
        <div className="animate-in fade-in duration-300">
          <div className="flex items-center gap-2 bg-gray-800/50 rounded-xl px-4 py-3 mb-4 border border-gray-700">
            <button onClick={() => setMonthDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="p-1 rounded hover:bg-gray-700 transition-colors">
              <ChevronLeft className="h-5 w-5 text-gray-400" />
            </button>
            <div className="flex-1 text-center text-sm font-bold text-white uppercase tracking-widest">
              {format(monthDate, 'MMMM yyyy')}
            </div>
            <button onClick={() => setMonthDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="p-1 rounded hover:bg-gray-700 transition-colors">
              <ChevronRight className="h-5 w-5 text-gray-400" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
              <div key={d} className="text-center text-[10px] text-gray-500 font-bold py-1 uppercase">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 mb-6">
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
                  className={`relative flex flex-col items-center py-2 rounded-lg transition-all ${
                    isSelected ? 'bg-blue-600 scale-105 z-10' :
                    isToday ? 'bg-gray-700 border border-blue-500/50' :
                    dayShots.length > 0 ? 'bg-gray-800 hover:bg-gray-700' : 'hover:bg-gray-800/30'
                  }`}
                >
                  <span className={`text-xs font-bold ${
                    isSelected ? 'text-white' : isToday ? 'text-blue-400' : dayShots.length > 0 ? 'text-white' : 'text-gray-600'
                  }`}>{format(day, 'd')}</span>
                  {dayShots.length > 0 && (
                    <span className={`text-[10px] mt-0.5 font-black ${isSelected ? 'text-blue-100' : 'text-blue-400'}`}>
                      {dayShots.length}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {monthSelectedDate && (
            <div className="space-y-3 pt-4 border-t border-gray-800">
              <p className="text-[10px] text-gray-500 uppercase tracking-[0.2em] font-black mb-2">
                {format(new Date(monthSelectedDate + 'T12:00:00'), 'EEEE, MMM d')}
              </p>
              {monthDayShootsList.map(shoot => (
                <CountdownCard key={shoot.id} shoot={shoot} isAdmin={isAdmin} rigSettings={rigSettings} onUpdate={onUpdate} userEmail={userEmail} allUsers={allUsers} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* DAY VIEW */}
      {viewMode === 'day' && (
        <div className="animate-in fade-in duration-300 space-y-4">
          {/* Day navigator (Quick Calendar Nav) */}
          <div className="flex items-center justify-between bg-gray-800/80 p-3 rounded-xl border border-gray-700">
            <button
              onClick={goBackDay}
              disabled={safeIndex === 0}
              className="p-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-20 transition-colors"
            >
              <ChevronLeft className="h-5 w-5 text-white" />
            </button>
            <div className="text-center">
              <span className="block text-sm font-black text-white uppercase tracking-tight">
                {currentDate === todayStr ? 'TODAY — ' : ''}{format(new Date(currentDate + 'T12:00:00'), 'EEEE, MMM d')}
              </span>
              <span className="text-[10px] text-blue-400 font-bold uppercase tracking-[0.2em]">Calendar Navigator</span>
            </div>
            <button
              onClick={goForwardDay}
              disabled={safeIndex === allDates.length - 1}
              className="p-1.5 rounded-lg hover:bg-gray-700 disabled:opacity-20 transition-colors"
            >
              <ChevronRight className="h-5 w-5 text-white" />
            </button>
          </div>

          {/* Shoots for selected day (MAX 4) */}
          {dayShootsList.length === 0 ? (
            <div className="text-center py-12 bg-gray-800/20 rounded-2xl border border-dashed border-gray-700 text-gray-500 text-sm italic">
              No assigned shoots on this day.
            </div>
          ) : (
            <div className="space-y-3">
              {visibleShoots.map(shoot => (
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

              {/* SHOOT PAGINATION CONTROLS */}
              {dayShootsList.length > itemsPerPage && (
                <div className="flex items-center justify-between mt-6 bg-gray-900/50 p-2 rounded-xl border border-gray-800">
                  <button
                    onClick={() => setShootPage(p => Math.max(0, p - 1))}
                    disabled={shootPage === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg text-xs font-bold text-gray-400 hover:text-white disabled:opacity-0 transition-all"
                  >
                    <ChevronLeft className="h-4 w-4" /> PREV
                  </button>

                  <div className="text-center">
                    <p className="text-[10px] text-gray-600 font-black uppercase">Next Shoots</p>
                    <p className="text-[10px] text-blue-500 font-bold">PAGE {shootPage + 1} OF {totalShootPages}</p>
                  </div>

                  <button
                    onClick={() => setShootPage(p => Math.min(totalShootPages - 1, p + 1))}
                    disabled={shootPage >= totalShootPages - 1}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 rounded-lg text-xs font-bold text-blue-500 hover:bg-gray-700 disabled:opacity-0 transition-all"
                  >
                    NEXT <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}