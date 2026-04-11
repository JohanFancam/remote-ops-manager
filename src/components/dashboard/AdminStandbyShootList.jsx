import React, { useState, useEffect, useMemo } from 'react';
import { format } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import CountdownCard from './CountdownCard';



export default function AdminStandbyShootList({ shoots = [], allUsers = [], userEmail, standbyDays = [], rigSettings = [], onUpdate, isAdmin = true }) {
  const [now, setNow] = useState(new Date());
  const [selectedDateIdx, setSelectedDateIdx] = useState(0);
  const PAGE_SIZE = 10;

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Build list of unique dates covered by the admin's standby entries
  const standbyDates = React.useMemo(() => {
    if (!standbyDays.length) return null;
    const dates = new Set();
    const todayStr = format(now, 'yyyy-MM-dd');
    standbyDays.forEach(sd => {
      const start = sd.start_date || sd.date;
      const end = sd.end_date || start;
      if (!start) return;
      const cur = new Date(start + 'T12:00:00');
      const last = new Date(end + 'T12:00:00');
      while (cur <= last) {
        const ds = format(cur, 'yyyy-MM-dd');
        if (ds >= todayStr) dates.add(ds);
        cur.setDate(cur.getDate() + 1);
      }
    });
    return Array.from(dates).sort();
  }, [standbyDays, now]);

  // Filter shoots by selected date; apply time bounds on start/end days
  const filteredShoots = React.useMemo(() => {
    if (!standbyDates || standbyDates.length === 0) return shoots;
    const selectedDate = standbyDates[selectedDateIdx];
    const dayShots = shoots.filter(s => s.date === selectedDate);

    return dayShots.filter(shoot => {
      const shootTime = shoot.game_time || '12:00';
      const shootDt = new Date(`${shoot.date}T${shootTime}`);

      return standbyDays.some(sd => {
        const start = sd.start_date || sd.date;
        const end = sd.end_date || start;
        if (selectedDate < start || selectedDate > end) return false;

        // On start day: shoot must be at or after start_time
        if (selectedDate === start && sd.start_time) {
          const startDt = new Date(`${start}T${sd.start_time}`);
          if (shootDt < startDt) return false;
        }

        // On end day: shoot must be before end_time
        if (selectedDate === end && sd.end_time) {
          const endDt = new Date(`${end}T${sd.end_time}`);
          if (shootDt >= endDt) return false;
        }

        return true;
      });
    });
  }, [shoots, standbyDates, standbyDays, selectedDateIdx]);

  const pagedShoots = filteredShoots.slice(0, PAGE_SIZE);

  if (shoots.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm italic">
        No upcoming shoots on your standby shift.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Date selector */}
      {standbyDates && standbyDates.length > 0 && (
        <div className="flex items-center gap-2 bg-gray-800/50 rounded-xl px-3 py-2">
          <button
            onClick={() => setSelectedDateIdx(i => Math.max(0, i - 1))}
            disabled={selectedDateIdx === 0}
            className="p-1 rounded hover:bg-gray-700 disabled:opacity-30 transition-colors"
          >
            <ChevronLeft className="h-4 w-4 text-gray-400" />
          </button>
          <div className="flex-1 text-center">
            <span className="text-sm font-semibold text-white">
              {format(new Date(standbyDates[selectedDateIdx] + 'T12:00:00'), 'EEEE, MMM d')}
            </span>
            <span className="text-xs text-gray-500 ml-2">
              ({filteredShoots.length} shoot{filteredShoots.length !== 1 ? 's' : ''})
            </span>
          </div>
          <button
            onClick={() => setSelectedDateIdx(i => Math.min(standbyDates.length - 1, i + 1))}
            disabled={selectedDateIdx === standbyDates.length - 1}
            className="p-1 rounded hover:bg-gray-700 disabled:opacity-30 transition-colors"
          >
            <ChevronRight className="h-4 w-4 text-gray-400" />
          </button>
        </div>
      )}

      {/* Shoot list */}
      {pagedShoots.length === 0 ? (
        <div className="text-center py-6 text-gray-500 text-sm italic">
          No shoots during your standby window on this day.
        </div>
      ) : (
        <div className="space-y-2">
          {pagedShoots.map(shoot => (
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
          {filteredShoots.length > PAGE_SIZE && (
            <p className="text-xs text-gray-600 text-center pt-1">
              Showing {PAGE_SIZE} of {filteredShoots.length} shoots
            </p>
          )}
        </div>
      )}
    </div>
  );
}