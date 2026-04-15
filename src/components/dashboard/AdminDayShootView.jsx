import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight, List, CalendarDays } from 'lucide-react';
import CountdownCard from './CountdownCard';

export default function AdminDayShootView({ shoots = [], isAdmin, rigSettings, onUpdate, userEmail, allUsers }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState('day');

  // Safety: Ensure shoots is always an array
  const safeShoots = Array.isArray(shoots) ? shoots : [];

  // Calendar logic
  const allDates = [...new Set([...safeShoots.filter(s => s && s.date).map(s => s.date), todayStr])].sort();
  const safeIndex = allDates.indexOf(selectedDate) === -1 ? allDates.indexOf(todayStr) : allDates.indexOf(selectedDate);
  const currentDate = allDates[safeIndex] || todayStr;

  // Filter for the day
  const dayShootsList = safeShoots.filter(s => s && s.date === currentDate);

  const goBack = () => { if (safeIndex > 0) setSelectedDate(allDates[safeIndex - 1]); };
  const goForward = () => { if (safeIndex < allDates.length - 1) setSelectedDate(allDates[safeIndex + 1]); };

  return (
    <div className="w-full max-w-5xl mx-auto p-4">
      {/* 1. View Toggles */}
      <div className="flex justify-end mb-4">
        <div className="flex bg-gray-800 rounded-lg p-1 border border-gray-700">
          <button onClick={() => setViewMode('day')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'day' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>Day</button>
          <button onClick={() => setViewMode('month')} className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${viewMode === 'month' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>Month</button>
        </div>
      </div>

      {viewMode === 'day' && (
        <div className="space-y-6">
          {/* 2. THE CALENDAR NAVIGATOR (This will now be visible and clickable) */}
          <div className="flex items-center justify-between bg-gray-800/80 p-4 rounded-2xl border border-gray-700 shadow-xl">
            <button onClick={goBack} disabled={safeIndex === 0} className="p-2 hover:bg-gray-700 rounded-xl disabled:opacity-10">
              <ChevronLeft className="text-white h-6 w-6"/>
            </button>
            <div className="text-center">
              <h2 className="text-lg font-bold text-white uppercase">
                {currentDate === todayStr ? "Today — " : ""}{format(new Date(currentDate + 'T12:00:00'), 'EEEE, MMM d')}
              </h2>
              <span className="text-[10px] text-blue-500 font-bold uppercase tracking-widest">Calendar Navigation</span>
            </div>
            <button onClick={goForward} disabled={safeIndex === allDates.length - 1} className="p-2 hover:bg-gray-700 rounded-xl disabled:opacity-10">
              <ChevronRight className="text-white h-6 w-6"/>
            </button>
          </div>

          {/* 3. THE SHOOT LIST */}
          <div className="grid gap-4">
            {dayShootsList.length === 0 ? (
              <div className="text-center py-20 text-gray-500 italic">No assigned shoots on this day.</div>
            ) : (
              dayShootsList.map(shoot => {
                // THE "SAFETY SHIELD": This stops the 'null' crash 
                // and allows your Sidebar to work again.
                if (!shoot || !shoot.id) return null;

                return (
                  <CountdownCard 
                    key={shoot.id} 
                    shoot={shoot} 
                    isAdmin={isAdmin} 
                    rigSettings={rigSettings} 
                    onUpdate={onUpdate} 
                    userEmail={userEmail} 
                    allUsers={allUsers} 
                  />
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}