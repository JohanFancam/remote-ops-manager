import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, List } from 'lucide-react';

// Verification: In your screenshot, this file is in the same 'dashboard' folder.
import CountdownCard from './CountdownCard'; 

export default function AdminDayShootView({ shoots = [], isAdmin, rigSettings, onUpdate, userEmail, allUsers }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState('day'); 
  
  // Pagination State for showing 4 shoots at a time
  const [shootPage, setShootPage] = useState(0);
  const itemsPerPage = 4;

  // Reset the shoot list page when you change the day
  useEffect(() => {
    setShootPage(0);
  }, [selectedDate]);

  // Ensure shoots is an array
  const safeShoots = Array.isArray(shoots) ? shoots : [];
  
  // Get all unique dates from the shoots list
  const allDates = [...new Set([...safeShoots.map(s => s.date), todayStr])].sort();
  const safeIndex = allDates.includes(selectedDate) ? allDates.indexOf(selectedDate) : allDates.indexOf(todayStr);
  const currentDate = allDates[safeIndex] || todayStr;

  // Filter for current day and Slice for pagination
  const dayShootsList = safeShoots.filter(s => s.date === currentDate);
  const totalShootPages = Math.ceil(dayShootsList.length / itemsPerPage);
  const visibleShoots = dayShootsList.slice(shootPage * itemsPerPage, (shootPage + 1) * itemsPerPage);

  const goBackDay = () => { if (safeIndex > 0) setSelectedDate(allDates[safeIndex - 1]); };
  const goForwardDay = () => { if (safeIndex < allDates.length - 1) setSelectedDate(allDates[safeIndex + 1]); };

  return (
    <div className="w-full space-y-4">
      {/* Day / Month Toggle */}
      <div className="flex justify-end">
        <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-800">
          <button onClick={() => setViewMode('day')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'day' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>DAY VIEW</button>
          <button onClick={() => setViewMode('month')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'month' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>MONTH</button>
        </div>
      </div>

      {viewMode === 'day' && (
        <div className="space-y-4">
          {/* Day Navigator (The Calendar part) */}
          <div className="flex items-center justify-between bg-gray-800/80 p-3 rounded-xl border border-gray-700">
            <button onClick={goBackDay} disabled={safeIndex === 0} className="p-1.5 hover:bg-gray-700 rounded-lg disabled:opacity-10 transition-colors">
              <ChevronLeft className="text-white h-5 w-5"/>
            </button>
            <div className="text-center">
              <span className="block text-sm font-black text-white uppercase tracking-tight">
                {currentDate === todayStr ? "Today — " : ""}{format(new Date(currentDate + 'T12:00:00'), 'EEEE, MMM d')}
              </span>
              <span className="text-[10px] text-blue-500 font-bold tracking-widest uppercase">Calendar Navigator</span>
            </div>
            <button onClick={goForwardDay} disabled={safeIndex === allDates.length - 1} className="p-1.5 hover:bg-gray-700 rounded-lg disabled:opacity-10 transition-colors">
              <ChevronRight className="text-white h-5 w-5"/>
            </button>
          </div>

          {/* List of 4 Shoots */}
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
              <div className="text-center py-12 bg-gray-900/20 rounded-2xl border border-dashed border-gray-800 text-gray-500 italic text-sm">
                No shoots found for this date.
              </div>
            )}
          </div>

          {/* Shoot Pagination (Show only if > 4) */}
          {dayShootsList.length > itemsPerPage && (
            <div className="flex items-center justify-between bg-gray-900/60 p-2.5 rounded-xl border border-gray-800 mt-6">
              <button 
                onClick={() => setShootPage(p => p - 1)} 
                disabled={shootPage === 0} 
                className="text-[11px] font-black text-gray-500 disabled:opacity-0 flex items-center gap-1 hover:text-white transition-colors"
              >
                <ChevronLeft className="h-4 w-4"/> PREVIOUS
              </button>
              
              <div className="text-center">
                <span className="block text-[9px] text-gray-600 font-black uppercase tracking-tighter">Viewing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, dayShootsList.length)} of {dayShootsList.length}</span>
                <span className="text-[10px] text-blue-500 font-black uppercase">PAGE {shootPage + 1}</span>
              </div>
              
              <button 
                onClick={() => setShootPage(p => p + 1)} 
                disabled={shootPage >= totalShootPages - 1} 
                className="text-[11px] font-black text-blue-500 flex items-center gap-1 hover:text-blue-400 transition-colors"
              >
                NEXT 4 <ChevronRight className="h-4 w-4"/>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}