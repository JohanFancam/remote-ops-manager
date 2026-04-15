import React, { useState, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, List } from 'lucide-react';
import CountdownCard from './CountdownCard';

export default function AdminDayShootView({ shoots = [], isAdmin, rigSettings, onUpdate, userEmail, allUsers }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [viewMode, setViewMode] = useState('day'); 
  const [shootPage, setShootPage] = useState(0);
  const itemsPerPage = 4;

  useEffect(() => { setShootPage(0); }, [selectedDate]);

  const allDates = [...new Set([...shoots.map(s => s.date), todayStr])].sort();
  const safeIndex = allDates.includes(selectedDate) ? allDates.indexOf(selectedDate) : allDates.indexOf(todayStr);
  const currentDate = allDates[safeIndex] || todayStr;
  const dayShootsList = shoots.filter(s => s && s.date === currentDate);
  
  const totalShootPages = Math.ceil(dayShootsList.length / itemsPerPage);
  const visibleShoots = dayShootsList.slice(shootPage * itemsPerPage, (shootPage + 1) * itemsPerPage);

  const goBack = () => { if (safeIndex > 0) setSelectedDate(allDates[safeIndex - 1]); };
  const goForward = () => { if (safeIndex < allDates.length - 1) setSelectedDate(allDates[safeIndex + 1]); };

  return (
    <div className="p-4">
      <div className="flex justify-end mb-4">
        <div className="flex bg-gray-800 rounded-lg p-1">
          <button onClick={() => setViewMode('day')} className={`px-4 py-1.5 rounded-md text-xs font-bold ${viewMode === 'day' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>Day</button>
          <button onClick={() => setViewMode('month')} className={`px-4 py-1.5 rounded-md text-xs font-bold ${viewMode === 'month' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>Month</button>
        </div>
      </div>

      {viewMode === 'day' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-gray-800/50 p-3 rounded-xl border border-gray-700">
            <button onClick={goBack} disabled={safeIndex === 0} className="p-1 disabled:opacity-20"><ChevronLeft className="text-white"/></button>
            <div className="text-center">
              <span className="block text-sm font-bold text-white uppercase">{format(new Date(currentDate + 'T12:00:00'), 'EEEE, MMM d')}</span>
            </div>
            <button onClick={goForward} disabled={safeIndex === allDates.length - 1} className="p-1 disabled:opacity-20"><ChevronRight className="text-white"/></button>
          </div>

          <div className="space-y-3">
            {visibleShoots.map(shoot => shoot && (
              <CountdownCard key={shoot.id} shoot={shoot} isAdmin={isAdmin} rigSettings={rigSettings} onUpdate={onUpdate} userEmail={userEmail} allUsers={allUsers} />
            ))}
            {totalShootPages > 1 && (
              <div className="flex items-center justify-between mt-4 bg-gray-900/50 p-2 rounded-lg">
                <button onClick={() => setShootPage(p => Math.max(0, p - 1))} disabled={shootPage === 0} className="text-xs font-bold text-gray-500 disabled:opacity-0">Prev</button>
                <span className="text-[10px] text-blue-500 font-bold uppercase">Page {shootPage + 1} of {totalShootPages}</span>
                <button onClick={() => setShootPage(p => Math.min(totalShootPages - 1, p + 1))} disabled={shootPage >= totalShootPages - 1} className="text-xs font-bold text-blue-500 disabled:opacity-0">Next 4</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}