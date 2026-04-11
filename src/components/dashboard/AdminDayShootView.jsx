import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import CountdownCard from './CountdownCard';

export default function AdminDayShootView({ shoots = [], isAdmin, rigSettings, onUpdate, userEmail, allUsers }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(todayStr);

  // Auto-advance selectedDate at midnight
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

  // Shoots from previous days that are still in progress (not marked complete)
  const inProgressPast = shoots.filter(s =>
    s.date < todayStr &&
    !s.phase_status?.shoot_complete
  );

  // Unique dates from upcoming shoots + always include today
  const allDates = [...new Set([...shoots.map(s => s.date), todayStr])].sort();

  const safeIndex = allDates.includes(selectedDate) ? allDates.indexOf(selectedDate) : allDates.indexOf(todayStr);
  const currentDate = allDates[safeIndex] || todayStr;

  const dayShootsList = shoots.filter(s => s.date === currentDate);

  const goBack = () => {
    if (safeIndex > 0) setSelectedDate(allDates[safeIndex - 1]);
  };
  const goForward = () => {
    if (safeIndex < allDates.length - 1) setSelectedDate(allDates[safeIndex + 1]);
  };

  return (
    <div>
      {/* In-progress shoots from previous days */}
      {inProgressPast.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-yellow-400 font-semibold uppercase tracking-wider mb-2">⚡ Still In Progress (from previous day)</p>
          <div className="space-y-2">
            {inProgressPast.map(shoot => (
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
          </div>
        </div>
      )}

      {/* Day navigator */}
      <div className="flex items-center gap-2 bg-gray-800/50 rounded-xl px-3 py-2 mb-3">
        <button
          onClick={goBack}
          disabled={safeIndex === 0}
          className="p-1 rounded hover:bg-gray-700 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft className="h-4 w-4 text-gray-400" />
        </button>
        <div className="flex-1 text-center">
          <span className="text-sm font-semibold text-white">
            {currentDate === todayStr ? 'Today — ' : ''}{format(new Date(currentDate + 'T12:00:00'), 'EEEE, MMM d')}
          </span>
          <span className="text-xs text-gray-500 ml-2">
            ({dayShootsList.length} shoot{dayShootsList.length !== 1 ? 's' : ''})
          </span>
        </div>
        <button
          onClick={goForward}
          disabled={safeIndex === allDates.length - 1}
          className="p-1 rounded hover:bg-gray-700 disabled:opacity-30 transition-colors"
        >
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </button>
      </div>

      {/* Shoots for selected day */}
      {dayShootsList.length === 0 ? (
        <div className="text-center py-6 text-gray-500 text-sm italic">No assigned shoots on this day.</div>
      ) : (
        <div className="space-y-2">
          {dayShootsList.map(shoot => (
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
        </div>
      )}
    </div>
  );
}