import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, List } from 'lucide-react';
import CountdownCard from './CountdownCard'; 

export default function AdminDayShootView({ shoots = [], isAdmin, rigSettings, onUpdate, userEmail, allUsers }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState('day'); 
  
  // Pagination State (Max 4 shoots per view)
  const [shootPage, setShootPage] = useState(0);
  const itemsPerPage = 4;

  // Reset page when day changes
  useEffect(() => {
    setShootPage(0);
  }, [selectedDate]);

  const safeShoots = Array.isArray(shoots) ? shoots : [];
  const allDates = [...new Set([...safeShoots.map(s => s.date), todayStr])].sort();
  const safeIndex = allDates.indexOf(selectedDate) === -1 ? allDates.indexOf(todayStr) : allDates.indexOf(selectedDate);
  const currentDate = allDates[safeIndex] || todayStr;

  const dayShootsList = safeShoots.filter(s => s.date === currentDate);
  const totalShootPages = Math.ceil(dayShootsList.length / itemsPerPage);
  const visibleShoots = dayShootsList.slice(shootPage * itemsPerPage, (shootPage + 1) * itemsPerPage);

  const goBackDay = () => { if (safeIndex > 0) setSelectedDate(allDates[safeIndex - 1]); };
  const goForwardDay = () => { if (safeIndex < allDates.length - 1) setSelectedDate(allDates[safeIndex + 1]); };

  return (
    <div className="w-full space-y-4">
      {/* View Toggle */}
      <div className="flex justify-end mb-2">
        <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800">
          <button onClick={() => setViewMode('day')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition-all ${viewMode === 'day' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>DAY VIEW</button>
          <button onClick={() => setViewMode('month')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold transition-all ${viewMode === 'month' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>MONTH</button>
        </div>
      </div>

      {viewMode === 'day' && (
        <div className="space-y-4">
          {/* Day Navigation (Calendar Nav) */}
          <div className="flex items-center justify-between bg-gray-800/60 p-3 rounded-xl border border-gray-700">
            <button onClick={goBackDay} disabled={safeIndex === 0} className="p-1 disabled:opacity-10"><ChevronLeft className="text-white"/></button>
            <div className="text-center">
              <span className="block text-sm font-bold text-white uppercase tracking-tight">
                {currentDate === todayStr ? "Today — " : ""}{format(new Date(currentDate + 'T12:00:00'), 'EEEE, MMM d')}
              </span>
              <span className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">Calendar Navigator</span>
            </div>
            <button onClick={goForwardDay} disabled={safeIndex === allDates.length - 1} className="p-1 disabled:opacity-10"><ChevronRight className="text-white"/></button>
          </div>

          {/* Shoot List (Shows max 4) */}
          <div className="space-y-3">
            {visibleShoots.length > 0 ? (
              visibleShoots.map(shoot => (
                <CountdownCard 
                  key={shoot.id} 
                  shoot={shoot} 
                  isAdmin={isAdmin} 
                  rigSettings={rigSettings} 
                  onUpdate={onUpdate} 
                  userEmail={userEmail} 
                  allUsers={allUsers} 
                />
              ))
            ) : (
              <div className="text-center py-10 text-gray-500 italic">No shoots assigned for this date.</div>
            )}
          </div>

          {/* Shoot Pagination Controls (Bottom) */}
          {dayShootsList.length > itemsPerPage && (
            <div className="flex items-center justify-between bg-gray-900/40 p-2 rounded-lg border border-gray-800">
              <button 
                onClick={() => setShootPage(p => p - 1)} 
                disabled={shootPage === 0} 
                className="text-xs font-bold text-gray-500 disabled:opacity-0 flex items-center gap-1"
              >
                <ChevronLeft className="h-3 w-3"/> Previous
              </button>
              
              <div className="text-center">
                <span className="text-[10px] text-blue-500 font-bold">PAGE {shootPage + 1} OF {totalShootPages}</span>
              </div>
              
              <button 
                onClick={() => setShootPage(p => p + 1)} 
                disabled={shootPage >= totalShootPages - 1} 
                className="text-xs font-bold text-blue-500 flex items-center gap-1"
              >
                Next 4 <ChevronRight className="h-3 w-3"/>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}