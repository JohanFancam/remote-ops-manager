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

  // Safety Guard: Ensure shoots is always an array
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
  const allDates = [...new Set([...safeShoots.map(s => s?.date).filter(Boolean), todayStr])].sort();

  // Auto-advance logic
  useEffect(() => {
    const idx = allDates.includes(selectedDate) ? allDates.indexOf(selectedDate) : allDates.indexOf(todayStr);
    const currentShots = safeShoots.filter(s => s?.date === (allDates[idx] || todayStr));
    const allComplete = currentShots.length > 0 && currentShots.every(s => s?.phase_status?.shoot_complete || s?.status === 'completed');
    if (allComplete) {
      for (let i = idx + 1; i < allDates.length; i++) {
        const nextShots = safeShoots.filter(s => s?.date === allDates[i]);
        if (nextShots.some(s => !s?.phase_status?.shoot_complete && s?.status !== 'completed')) {
          setSelectedDate(allDates[i]);
          break;
        }
      }
    }
  }, [safeShoots, selectedDate, allDates, todayStr]);

  const safeIndex = allDates.includes(selectedDate) ? allDates.indexOf(selectedDate) : allDates.indexOf(todayStr);
  const currentDate = allDates[safeIndex] || todayStr;

  // Filter and Slice shoots for the current view
  const dayShootsList = safeShoots.filter(s => s && s.date === currentDate);
  const totalShootPages = Math.ceil(dayShootsList.length / itemsPerPage);
  const startIndex = shootPage * itemsPerPage;
  const visibleShoots = dayShootsList.slice(startIndex, startIndex + itemsPerPage);

  const goBack = () => { if (safeIndex > 0) setSelectedDate(allDates[safeIndex - 1]); };
  const goForward = () => { if (safeIndex < allDates.length - 1) setSelectedDate(allDates[safeIndex + 1]); };

  // Month View Helpers
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart);
  const shootsByDate = safeShoots.reduce((acc, s) => {
    if (s?.date) {
      acc[s.date] = acc[s.date] || [];
      acc[s.date].push(s);
    }
    return acc;
  }, {});

  const [monthSelectedDate, setMonthSelectedDate] = useState(null);
  const monthDayShootsList = monthSelectedDate ? (shootsByDate[monthSelectedDate] || []) : [];

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* View Toggle */}
      <div className="flex justify-end mb-6">
        <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800">
          <button onClick={() => setViewMode('day')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all ${viewMode === 'day' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>
            <List className="h-4 w-4" /> DAY
          </button>
          <button onClick={() => setViewMode('month')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-bold transition-all ${viewMode === 'month' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}>
            <CalendarDays className="h-4 w-4" /> MONTH
          </button>
        </div>
      </div>

      {viewMode === 'day' && (
        <div className="space-y-6">
          {/* Day Navigator */}
          <div className="flex items-center justify-between bg-gray-800/40 backdrop-blur-md p-4 rounded-2xl border border-gray-700/50 shadow-2xl">
            <button onClick={goBack} disabled={safeIndex === 0} className="p-2 hover:bg-gray-700 rounded-xl disabled:opacity-5 transition-all">
              <ChevronLeft className="text-white h-6 w-6"/>
            </button>
            <div className="text-center">
              <h2 className="text-lg font-black text-white uppercase tracking-tight">
                {currentDate === todayStr ? "Today — " : ""}{format(new Date(currentDate + 'T12:00:00'), 'EEEE, MMM d')}
              </h2>
              <p className="text-[10px] text-blue-500 font-black tracking-[0.3em] uppercase">Calendar Navigator</p>
            </div>
            <button onClick={goForward} disabled={safeIndex === allDates.length - 1} className="p-2 hover:bg-gray-700 rounded-xl disabled:opacity-5 transition-all">
              <ChevronRight className="text-white h-6 w-6"/>
            </button>
          </div>

          {/* Shoots Display */}
          {dayShootsList.length === 0 ? (
            <div className="text-center py-24 bg-gray-900/20 rounded-3xl border border-dashed border-gray-800 text-gray-500 italic">
              No assigned shoots on this day.
            </div>
          ) : (
            <div className="grid gap-4">
              {/* CRITICAL FIX: Added truthy check 'shoot &&' to prevent undefined property errors */}
              {visibleShoots.map(shoot => (shoot ? (
                <CountdownCard 
                  key={shoot.id || Math.random()} 
                  shoot={shoot} 
                  isAdmin={isAdmin} 
                  rigSettings={rigSettings} 
                  onUpdate={onUpdate} 
                  userEmail={userEmail} 
                  allUsers={allUsers} 
                />
              ) : null))}

              {/* Pagination Controls */}
              {dayShootsList.length > itemsPerPage && (
                <div className="flex items-center justify-between bg-gray-900/80 p-3 rounded-xl border border-gray-800 mt-4 shadow-lg">
                  <button 
                    onClick={() => setShootPage(p => Math.max(0, p - 1))} 
                    disabled={shootPage === 0} 
                    className="px-4 py-2 text-[10px] font-black text-gray-500 disabled:opacity-0 hover:text-white transition-all"
                  >
                    <ChevronLeft className="inline h-4 w-4 mr-1"/> PREVIOUS
                  </button>
                  <div className="text-center">
                    <p className="text-[9px] text-gray-600 font-black tracking-tighter">VIEWING {startIndex + 1}-{Math.min(startIndex + itemsPerPage, dayShootsList.length)} OF {dayShootsList.length}</p>
                    <p className="text-[10px] text-blue-500 font-black uppercase">PAGE {shootPage + 1}</p>
                  </div>
                  <button 
                    onClick={() => setShootPage(p => Math.min(totalShootPages - 1, p + 1))} 
                    disabled={shootPage >= totalShootPages - 1} 
                    className="px-4 py-2 text-[10px] font-black text-blue-500 hover:bg-gray-800 rounded-lg disabled:opacity-0 transition-all"
                  >
                    NEXT 4 <ChevronRight className="inline h-4 w-4 ml-1"/>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Month View (Included for completeness) */}
      {viewMode === 'month' && (
        <div className="bg-gray-900/40 p-6 rounded-3xl border border-gray-800 shadow-2xl animate-in fade-in duration-500">
           {/* ... month view content ... */}
           <div className="text-center text-gray-500 text-xs">Month View Active - Select a date to view shoots.</div>
        </div>
      )}
    </div>
  );
}