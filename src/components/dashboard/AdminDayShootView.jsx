import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, List } from 'lucide-react';
// Corrected import: they are in the same 'dashboard' folder
import CountdownCard from './CountdownCard';

export default function AdminDayShootView({ shoots = [], isAdmin, rigSettings, onUpdate, userEmail, allUsers }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState('day'); 
  const [monthDate, setMonthDate] = useState(new Date());

  // --- NEW: Pagination State for Shoots ---
  const [shootPage, setShootPage] = useState(0);
  const itemsPerPage = 4;

  // Reset pagination when date changes
  useEffect(() => {
    setShootPage(0);
  }, [selectedDate]);

  // --- ORIGINAL LOGIC: Midnight Auto-Refresh ---
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

  // --- ORIGINAL LOGIC: Date Calculations ---
  const allDates = [...new Set([...shoots.map(s => s.date), todayStr])].sort();

  // --- ORIGINAL LOGIC: Auto-advance to next date if all complete ---
  useEffect(() => {
    const idx = allDates.includes(selectedDate) ? allDates.indexOf(selectedDate) : allDates.indexOf(todayStr);
    const currentShots = shoots.filter(s => s.date === (allDates[idx] || todayStr));
    const allComplete = currentShots.length > 0 && currentShots.every(s => s.phase_status?.shoot_complete || s.status === 'completed');
    if (allComplete) {
      for (let i = idx + 1; i < allDates.length; i++) {
        const nextShots = shoots.filter(s => s.date === allDates[i]);
        if (nextShots.some(s => !s.phase_status?.shoot_complete && s.status !== 'completed')) {
          setSelectedDate(allDates[i]);
          break;
        }
      }
    }
  }, [shoots]);

  const safeIndex = allDates.includes(selectedDate) ? allDates.indexOf(selectedDate) : allDates.indexOf(todayStr);
  const currentDate = allDates[safeIndex] || todayStr;
  const dayShootsList = shoots.filter(s => s.date === currentDate);

  // --- NEW LOGIC: Calculate Paginated Shoots (Max 4) ---
  const startIndex = shootPage * itemsPerPage;
  const visibleShoots = dayShootsList.slice(startIndex, startIndex + itemsPerPage);
  const totalShootPages = Math.ceil(dayShootsList.length / itemsPerPage);

  const goBackDay = () => { if (safeIndex > 0) setSelectedDate(allDates[safeIndex - 1]); };
  const goForwardDay = () => { if (safeIndex < allDates.length - 1) setSelectedDate(allDates[safeIndex + 1]); };

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
    <div className="w-full">
      {/* View Toggle */}
      <div className="flex justify-end mb-3">
        <div className="flex bg-gray-800 rounded-lg p-0.5">
          <button onClick={() => setViewMode('day')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'day' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}><List className="h-3.5 w-3.5" /> Day</button>
          <button onClick={() => setViewMode('month')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'month' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}><CalendarDays className="h-3.5 w-3.5" /> Month</button>
        </div>
      </div>

      {/* MONTH VIEW */}
      {viewMode === 'month' && (
        <div>
          <div className="flex items-center gap-2 bg-gray-800/50 rounded-xl px-3 py-2 mb-3">
            <button onClick={() => setMonthDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="p-1 rounded hover:bg-gray-700 transition-colors"><ChevronLeft className="h-4 w-4 text-gray-400" /></button>
            <div className="flex-1 text-center text-sm font-semibold text-white">{format(monthDate, 'MMMM yyyy')}</div>
            <button onClick={() => setMonthDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="p-1 rounded hover:bg-gray-700 transition-colors"><ChevronRight className="h-4 w-4 text-gray-400" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (<div key={d} className="text-center text-xs text-gray-600 font-medium py-1">{d}</div>))}
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
                  className={`relative flex flex-col items-center py-1.5 rounded-lg transition-colors ${isSelected ? 'bg-blue-600' : isToday ? 'bg-gray-700' : dayShots.length > 0 ? 'bg-gray-800 hover:bg-gray-700' : 'hover:bg-gray-800/50'}`}
                >
                  <span className={`text-xs font-medium ${isSelected ? 'text-white' : isToday ? 'text-blue-400' : dayShots.length > 0 ? 'text-white' : 'text-gray-600'}`}>{format(day, 'd')}</span>
                  {dayShots.length > 0 && (<span className={`text-xs mt-0.5 font-bold ${isSelected ? 'text-blue-200' : 'text-blue-400'}`}>{dayShots.length}</span>)}
                </button>
              );
            })}
          </div>
          {monthSelectedDate && (
            <div className="space-y-2">
              {monthDayShootsList.map(shoot => (
                <CountdownCard key={shoot.id} shoot={shoot} isAdmin={isAdmin} rigSettings={rigSettings} onUpdate={onUpdate} userEmail={userEmail} allUsers={allUsers} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* DAY VIEW */}
      {viewMode === 'day' && (
        <div className="space-y-4">
          {/* Day navigator (Calendar) */}
          <div className="flex items-center gap-2 bg-gray-800/50 rounded-xl px-3 py-2">
            <button onClick={goBackDay} disabled={safeIndex === 0} className="p-1 rounded hover:bg-gray-700 disabled:opacity-30 transition-colors"><ChevronLeft className="h-4 w-4 text-gray-400" /></button>
            <div className="flex-1 text-center">
              <span className="text-sm font-semibold text-white">{currentDate === todayStr ? 'Today — ' : ''}{format(new Date(currentDate + 'T12:00:00'), 'EEEE, MMM d')}</span>
              <span className="text-xs text-gray-500 ml-2">({dayShootsList.length} total)</span>
            </div>
            <button onClick={goForwardDay} disabled={safeIndex === allDates.length - 1} className="p-1 rounded hover:bg-gray-700 disabled:opacity-30 transition-colors"><ChevronRight className="h-4 w-4 text-gray-400" /></button>
          </div>

          {/* Paginated Shoots (Max 4) */}
          {dayShootsList.length === 0 ? (
            <div className="text-center py-6 text-gray-500 text-sm italic">No assigned shoots on this day.</div>
          ) : (
            <div className="space-y-3">
              {visibleShoots.map(shoot => (
                <CountdownCard key={shoot.id} shoot={shoot} isAdmin={isAdmin} rigSettings={rigSettings} onUpdate={onUpdate} userEmail={userEmail} allUsers={allUsers} />
              ))}

              {/* Pagination Controls for Shoots */}
              {dayShootsList.length > itemsPerPage && (
                <div className="flex items-center justify-between pt-2 border-t border-gray-800">
                  <button onClick={() => setShootPage(p => Math.max(0, p - 1))} disabled={shootPage === 0} className="text-xs font-bold text-gray-500 disabled:opacity-0 flex items-center gap-1">
                    <ChevronLeft className="h-3 w-3"/> Previous
                  </button>
                  <span className="text-[10px] text-blue-500 font-bold uppercase">Page {shootPage + 1} of {totalShootPages}</span>
                  <button onClick={() => setShootPage(p => Math.min(totalShootPages - 1, p + 1))} disabled={shootPage >= totalShootPages - 1} className="text-xs font-bold text-blue-500 disabled:opacity-0 flex items-center gap-1">
                    Next 4 <ChevronRight className="h-3 w-3"/>
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