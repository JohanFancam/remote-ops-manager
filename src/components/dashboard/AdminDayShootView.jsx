import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, List } from 'lucide-react';

/** * IMPORTANT: 
 * Since AdminDayShootView and CountdownCard are in the SAME folder (dashboard),
 * the import MUST be './CountdownCard'
 */
import CountdownCard from './CountdownCard'; 

export default function AdminDayShootView({ shoots = [], isAdmin, rigSettings, onUpdate, userEmail, allUsers }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState('day'); 
  const [monthDate, setMonthDate] = useState(new Date());
  
  // Pagination logic
  const [shootPage, setShootPage] = useState(0);
  const itemsPerPage = 4;

  useEffect(() => {
    setShootPage(0);
  }, [selectedDate]);

  // Midnight auto-refresh
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

  const safeShoots = Array.isArray(shoots) ? shoots : [];
  const allDates = [...new Set([...safeShoots.map(s => s.date), todayStr])].sort();
  const safeIndex = allDates.includes(selectedDate) ? allDates.indexOf(selectedDate) : allDates.indexOf(todayStr);
  const currentDate = allDates[safeIndex] || todayStr;

  const dayShootsList = safeShoots.filter(s => s.date === currentDate);
  const startIndex = shootPage * itemsPerPage;
  const visibleShoots = dayShootsList.slice(startIndex, startIndex + itemsPerPage);
  const totalShootPages = Math.ceil(dayShootsList.length / itemsPerPage);

  const goBackDay = () => { if (safeIndex > 0) setSelectedDate(allDates[safeIndex - 1]); };
  const goForwardDay = () => { if (safeIndex < allDates.length - 1) setSelectedDate(allDates[safeIndex + 1]); };

  return (
    <div className="w-full space-y-4">
      <div className="flex justify-end mb-2">
        <div className="flex bg-gray-900 rounded-lg p-1">
          <button onClick={() => setViewMode('day')} className={`px-3 py-1.5 rounded-md text-xs font-bold ${viewMode === 'day' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>
            <List className="inline h-3 w-3 mr-1"/> DAY
          </button>
          <button onClick={() => setViewMode('month')} className={`px-3 py-1.5 rounded-md text-xs font-bold ${viewMode === 'month' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>
            <CalendarDays className="inline h-3 w-3 mr-1"/> MONTH
          </button>
        </div>
      </div>

      {viewMode === 'day' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-gray-800/60 p-3 rounded-xl border border-gray-700">
            <button onClick={goBackDay} disabled={safeIndex === 0} className="p-1 disabled:opacity-20"><ChevronLeft/></button>
            <div className="text-center">
              <span className="block text-sm font-bold text-white uppercase">{format(new Date(currentDate + 'T12:00:00'), 'EEEE, MMM d')}</span>
              <span className="text-[10px] text-blue-400 font-bold tracking-tighter">CALENDAR NAVIGATOR</span>
            </div>
            <button onClick={goForwardDay} disabled={safeIndex === allDates.length - 1} className="p-1 disabled:opacity-20"><ChevronRight/></button>
          </div>

          <div className="space-y-3">
            {visibleShoots.map(shoot => (
              <CountdownCard key={shoot.id} shoot={shoot} isAdmin={isAdmin} rigSettings={rigSettings} onUpdate={onUpdate} userEmail={userEmail} allUsers={allUsers} />
            ))}
          </div>

          {dayShootsList.length > itemsPerPage && (
            <div className="flex items-center justify-between bg-gray-900/40 p-2 rounded-lg border border-gray-800">
              <button onClick={() => setShootPage(p => p - 1)} disabled={shootPage === 0} className="text-xs text-gray-500 disabled:opacity-0">PREVIOUS</button>
              <span className="text-[10px] text-gray-500 font-bold">PAGE {shootPage + 1} OF {totalShootPages}</span>
              <button onClick={() => setShootPage(p => p + 1)} disabled={shootPage >= totalShootPages - 1} className="text-xs text-blue-500 font-bold">NEXT 4 SHOOTS</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}