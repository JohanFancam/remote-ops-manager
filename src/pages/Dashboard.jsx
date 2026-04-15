import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, List } from 'lucide-react';
import CountdownCard from '../components/dashboard/CountdownCard';

export default function AdminDayShootView({ shoots = [], isAdmin, rigSettings, onUpdate, userEmail, allUsers }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState('day'); 
  const [monthDate, setMonthDate] = useState(new Date());
  
  // --- PAGINATION STATE ---
  const [shootPage, setShootPage] = useState(0);
  const itemsPerPage = 4;

  // Reset shoot page to 0 whenever the date changes
  useEffect(() => {
    setShootPage(0);
  }, [selectedDate]);

  // Date Logic
  const allDates = [...new Set([...shoots.map(s => s.date), todayStr])].sort();
  const safeIndex = allDates.includes(selectedDate) ? allDates.indexOf(selectedDate) : allDates.indexOf(todayStr);
  const currentDate = allDates[safeIndex] || todayStr;

  // 1. Get ALL shoots for the day
  const dayShootsList = shoots.filter(s => s.date === currentDate);

  // 2. Calculate which 4 to show
  const startIndex = shootPage * itemsPerPage;
  const visibleShoots = dayShootsList.slice(startIndex, startIndex + itemsPerPage);
  const totalShootPages = Math.ceil(dayShootsList.length / itemsPerPage);

  const goBackDay = () => { if (safeIndex > 0) setSelectedDate(allDates[safeIndex - 1]); };
  const goForwardDay = () => { if (safeIndex < allDates.length - 1) setSelectedDate(allDates[safeIndex + 1]); };

  return (
    <div className="space-y-4">
      {/* View Toggles */}
      <div className="flex justify-end">
        <div className="flex bg-gray-900 rounded-lg p-1">
          <button onClick={() => setViewMode('day')} className={`px-3 py-1 rounded-md text-xs ${viewMode === 'day' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}><List className="inline h-3 w-3 mr-1"/> Day</button>
          <button onClick={() => setViewMode('month')} className={`px-3 py-1 rounded-md text-xs ${viewMode === 'month' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}><CalendarDays className="inline h-3 w-3 mr-1"/> Month</button>
        </div>
      </div>

      {viewMode === 'day' && (
        <div className="space-y-4">
          {/* TOP NAVIGATOR: Calendar Days */}
          <div className="flex items-center justify-between bg-gray-800/80 p-3 rounded-xl border border-gray-700">
            <button onClick={goBackDay} disabled={safeIndex === 0} className="p-1 disabled:opacity-20"><ChevronLeft className="text-white"/></button>
            <div className="text-center">
              <div className="text-sm font-bold text-white">
                {currentDate === todayStr ? "Today's Shoots" : format(new Date(currentDate + 'T12:00:00'), 'EEEE, MMM d')}
              </div>
              <div className="text-[10px] text-blue-400 font-medium uppercase tracking-tighter">Day Navigator</div>
            </div>
            <button onClick={goForwardDay} disabled={safeIndex === allDates.length - 1} className="p-1 disabled:opacity-20"><ChevronRight className="text-white"/></button>
          </div>

          {/* THE SHOOT CARDS (Max 4) */}
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

          {/* BOTTOM NAVIGATOR: Shoot Pagination (Only shows if > 4 shoots) */}
          {dayShootsList.length > itemsPerPage && (
            <div className="flex items-center justify-between bg-gray-900/50 p-2 rounded-lg border border-dashed border-gray-700">
              <button 
                onClick={() => setShootPage(prev => prev - 1)} 
                disabled={shootPage === 0}
                className="text-xs flex items-center gap-1 text-gray-400 disabled:invisible"
              >
                <ChevronLeft className="h-3 w-3"/> Previous 4
              </button>
              
              <span className="text-[10px] text-gray-600 font-bold">
                SHOWING {startIndex + 1}-{Math.min(startIndex + itemsPerPage, dayShootsList.length)} OF {dayShootsList.length}
              </span>

              <button 
                onClick={() => setShootPage(prev => prev + 1)} 
                disabled={shootPage >= totalShootPages - 1}
                className="text-xs flex items-center gap-1 text-blue-500 font-semibold disabled:invisible"
              >
                Next 4 <ChevronRight className="h-3 w-3"/>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Month View logic stays here... (Shortened for clarity) */}
    </div>
  );
}