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

  // Ensure shoots is always an array
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

  // Calculate all dates for navigation - added safe check for s.date
  const allDates = [...new Set([...safeShoots.filter(s => s && s.date).map(s => s.date), todayStr])].sort();

  const safeIndex = allDates.includes(selectedDate) ? allDates.indexOf(selectedDate) : allDates.indexOf(todayStr);
  const currentDate = allDates[safeIndex] || todayStr;

  // Filter and Slice shoots for the current view - added strict truthy check
  const dayShootsList = safeShoots.filter(s => s && s.date === currentDate);
  const totalShootPages = Math.ceil(dayShootsList.length / itemsPerPage);
  const visibleShoots = dayShootsList.slice(shootPage * itemsPerPage, (shootPage + 1) * itemsPerPage);

  const goBack = () => { if (safeIndex > 0) setSelectedDate(allDates[safeIndex - 1]); };
  const goForward = () => { if (safeIndex < allDates.length - 1) setSelectedDate(allDates[safeIndex + 1]); };

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* View Toggle */}
      <div className="flex justify-end mb-4">
        <div className="flex bg-gray-800 rounded-lg p-0.5 border border-gray-700">
          <button onClick={() => setViewMode('day')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'day' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}>
            <List className="h-3.5 w-3.5" /> Day
          </button>
          <button onClick={() => setViewMode('month')} className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'month' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-400 hover:text-white'}`}>
            <CalendarDays className="h-3.5 w-3.5" /> Month
          </button>
        </div>
      </div>

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
              {/* THE CRITICAL FIX: (shoot && shoot.id) ensures CountdownCard never gets a null shoot */}
              {visibleShoots.map(shoot => (shoot && shoot.id) ? (
                <CountdownCard 
                  key={shoot.id} 
                  shoot={shoot} 
                  isAdmin={isAdmin} 
                  rigSettings={rigSettings} 
                  onUpdate={onUpdate} 
                  userEmail={userEmail} 
                  allUsers={allUsers} 
                />
              ) : null)}

              {/* Pagination Controls */}
              {dayShootsList.length > itemsPerPage && (
                <div className="flex items-center justify-between bg-gray-900/60 p-3 rounded-xl border border-gray-800 mt-4">
                  <button onClick={() => setShootPage(p => Math.max(0, p - 1))} disabled={shootPage === 0} className="px-4 py-2 text-xs font-bold text-gray-400 hover:text-white disabled:opacity-0 transition-all">
                    <ChevronLeft className="inline h-4 w-4 mr-1"/> PREVIOUS
                  </button>
                  <div className="text-center">
                    <p className="text-[11px] text-blue-500 font-black uppercase tracking-widest">PAGE {shootPage + 1} OF {totalShootPages}</p>
                  </div>
                  <button onClick={() => setShootPage(p => Math.min(totalShootPages - 1, p + 1))} disabled={shootPage >= totalShootPages - 1} className="px-4 py-2 text-xs font-bold text-blue-500 hover:bg-gray-800 rounded-lg disabled:opacity-0 transition-all">
                    NEXT 4 <ChevronRight className="inline h-4 w-4 ml-1"/>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      
      {/* Month View logic omitted for brevity but should be kept from original */}
    </div>
  );
}