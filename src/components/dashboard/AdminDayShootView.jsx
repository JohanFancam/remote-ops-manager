import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, List } from 'lucide-react';
import CountdownCard from './CountdownCard';

export default function AdminDayShootView({ shoots = [], isAdmin, rigSettings, onUpdate, userEmail, allUsers }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState('day'); 
  const [monthDate, setMonthDate] = useState(new Date());

  // Pagination for shoots (4 at a time)
  const [shootPage, setShootPage] = useState(0);
  const itemsPerPage = 4;

  // Reset page when date changes
  useEffect(() => {
    setShootPage(0);
  }, [selectedDate]);

  // Ensure shoots is always an array to prevent "undefined" crashes
  const safeShoots = Array.isArray(shoots) ? shoots : [];

  // Midnight auto-refresh logic
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

  // Calculate all dates for navigation
  const allDates = [...new Set([...safeShoots.map(s => s.date), todayStr])].sort();

  // Auto-advance logic
  useEffect(() => {
    const idx = allDates.includes(selectedDate) ? allDates.indexOf(selectedDate) : allDates.indexOf(todayStr);
    const currentShots = safeShoots.filter(s => s.date === (allDates[idx] || todayStr));
    const allComplete = currentShots.length > 0 && currentShots.every(s => s.phase_status?.shoot_complete || s.status === 'completed');
    if (allComplete) {
      for (let i = idx + 1; i < allDates.length; i++) {
        const nextShots = safeShoots.filter(s => s.date === allDates[i]);
        if (nextShots.some(s => !s.phase_status?.shoot_complete && s.status !== 'completed')) {
          setSelectedDate(allDates[i]);
          break;
        }
      }
    }
  }, [safeShoots, selectedDate]);

  const safeIndex = allDates.includes(selectedDate) ? allDates.indexOf(selectedDate) : allDates.indexOf(todayStr);
  const currentDate = allDates[safeIndex] || todayStr;

  // Filter and Slice shoots for the current view
  const dayShootsList = safeShoots.filter(s => s && s.date === currentDate);
  const totalShootPages = Math.ceil(dayShootsList.length / itemsPerPage);
  const visibleShoots = dayShootsList.slice(shootPage * itemsPerPage, (shootPage + 1) * itemsPerPage);

  const goBack = () => { if (safeIndex > 0) setSelectedDate(allDates[safeIndex - 1]); };
  const goForward = () => { if (safeIndex < allDates.length - 1) setSelectedDate(allDates[safeIndex + 1]); };

  // Month View Helpers
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart);
  const shootsByDate = safeShoots.reduce((acc, s) => {
    if (s && s.date) {
      acc[s.date] = acc[s.date] || [];
      acc[s.date].push(s);
    }
    return acc;
  }, {});

  const [monthSelectedDate, setMonthSelectedDate] = useState(null);
  const monthDayShootsList = monthSelectedDate ? (shootsByDate[monthSelectedDate] || []) : [];

  return (
    <div className="max-w-5xl mx-auto p-4">
      {/* View Toggle */}
      <div className="flex justify-end mb-4">
        <div className="flex bg-gray-800 rounded-lg p-0.5 border border-gray-700">
          <button onClick={() => setViewMode('day')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'day' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>
            <List className="h-3.5 w-3.5" /> Day
          </button>
          <button onClick={() => setViewMode('month')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'month' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>
            <CalendarDays className="h-3.5 w-3.5" /> Month
          </button>
        </div>
      </div>

      {viewMode === 'month' && (
        <div className="bg-gray-900/40 p-4 rounded-2xl border border-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => setMonthDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400"><ChevronLeft/></button>
            <div className="flex-1 text-center font-bold text-white uppercase tracking-widest">{format(monthDate, 'MMMM yyyy')}</div>
            <button onClick={() => setMonthDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="p-2 hover:bg-gray-800 rounded-lg text-gray-400"><ChevronRight/></button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} className="text-center text-[10px] text-gray-500 font-bold">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startPadding }).map((_, i) => <div key={i} />)}
            {monthDays.map(day => {
              const ds = format(day, 'yyyy-MM-dd');
              const dShots = shootsByDate[ds] || [];
              const isToday = ds === todayStr;
              const isSelected = ds === monthSelectedDate;
              return (
                <button key={ds} onClick={() => setMonthSelectedDate(isSelected ? null : ds)} className={`py-3 rounded-lg flex flex-col items-center transition-all ${isSelected ? 'bg-blue-600 shadow-lg scale-105' : isToday ? 'bg-gray-700 border border-blue-500/30' : dShots.length > 0 ? 'bg-gray-800 hover:bg-gray-700' : 'hover:bg-gray-800/30'}`}>
                  <span className={`text-xs font-bold ${isSelected ? 'text-white' : isToday ? 'text-blue-400' : 'text-gray-300'}`}>{format(day, 'd')}</span>
                  {dShots.length > 0 && <span className="text-[10px] text-blue-400 font-black">{dShots.length}</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {viewMode === 'day' && (
        <div className="space-y-6">
          {/* Day Navigator */}
          <div className="flex items-center justify-between bg-gray-800/80 p-4 rounded-2xl border border-gray-700 shadow-xl">
            <button onClick={goBack} disabled={safeIndex === 0} className="p-2 hover:bg-gray-700 rounded-xl disabled:opacity-10 transition-colors">
              <ChevronLeft className="text-white h-6 w-6"/>
            </button>
            <div className="text-center">
              <h2 className="text-lg font-black text-white uppercase tracking-tight">
                {currentDate === todayStr ? "Today — " : ""}{format(new Date(currentDate + 'T12:00:00'), 'EEEE, MMM d')}
              </h2>
              <span className="text-[10px] text-blue-500 font-black tracking-[0.3em] uppercase">Calendar Navigator</span>
            </div>
            <button onClick={goForward} disabled={safeIndex === allDates.length - 1} className="p-2 hover:bg-gray-700 rounded-xl disabled:opacity-10 transition-colors">
              <ChevronRight className="text-white h-6 w-6"/>
            </button>
          </div>

          {/* Shoots Display */}
          {dayShootsList.length === 0 ? (
            <div className="text-center py-20 bg-gray-900/20 rounded-3xl border border-dashed border-gray-800 text-gray-500 italic">
              No assigned shoots on this day.
            </div>
          ) : (
            <div className="grid gap-4">
              {visibleShoots.map(shoot => shoot && (
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

              {/* Pagination Controls */}
              {dayShootsList.length > itemsPerPage && (
                <div className="flex items-center justify-between bg-gray-900/60 p-3 rounded-xl border border-gray-800 mt-4">
                  <button onClick={() => setShootPage(p => p - 1)} disabled={shootPage === 0} className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white disabled:opacity-0 transition-all">
                    <ChevronLeft className="inline h-4 w-4 mr-1"/> PREVIOUS
                  </button>
                  <div className="text-center">
                    <p className="text-[10px] text-gray-600 font-black">NEXT SHOOTS</p>
                    <p className="text-[11px] text-blue-500 font-black uppercase">PAGE {shootPage + 1} OF {totalShootPages}</p>
                  </div>
                  <button onClick={() => setShootPage(p => p + 1)} disabled={shootPage >= totalShootPages - 1} className="px-4 py-2 text-xs font-bold text-blue-500 hover:bg-gray-800 rounded-lg disabled:opacity-0 transition-all">
                    NEXT 4 <ChevronRight className="inline h-4 w-4 ml-1"/>
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