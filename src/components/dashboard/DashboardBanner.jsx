import React, { useState, useEffect, useMemo } from 'react';
import { Camera, Phone, Clock, ChevronDown, Timer, ArrowRight } from 'lucide-react';
import { format, differenceInSeconds, intervalToDuration, isAfter, isValid, parseISO } from 'date-fns';

// ... (useClock hook remains the same)

export default function DashboardBanner({ user, shoots = [], standbyDays = [], allUsers = [], calendarEvents = [] }) {
  const [tz, setTz] = useState(() => localStorage.getItem('dashboard_tz') || 'Africa/Johannesburg');
  const { time, date, now } = useClock(tz);

  // --- CALENDAR-BASED NEXT SHOOT LOGIC ---
  const myNextShoot = useMemo(() => {
    // 1. Filter the Remote Photographers calendar events
    const upcoming = (calendarEvents || [])
      .filter(event => {
        const eventStart = new Date(event.start_time);
        // Ensure it's in the future and not a cancelled/past event
        return isValid(eventStart) && isAfter(eventStart, now);
      })
      .sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

    return upcoming[0]; // The very next calendar entry
  }, [calendarEvents, now]);

  const getCountdown = (startTime) => {
    if (!startTime) return "--:--:--";
    const target = new Date(startTime);
    const diff = differenceInSeconds(target, now);
    
    if (diff <= 0) return "LIVE";
    
    const d = intervalToDuration({ start: now, end: target });
    if (d.days > 0) return `${d.days}d ${d.hours}h ${d.minutes}m`;
    return `${String(d.hours).padStart(2, '0')}:${String(d.minutes).padStart(2, '0')}:${String(d.seconds).padStart(2, '0')}`;
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6 shadow-xl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        
        {/* SECTION 1: CLOCK (as before) */}
        <div className="flex-shrink-0 min-w-[180px]">
          <div className="font-mono text-4xl font-bold text-white tabular-nums">{time}</div>
          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">{date}</div>
        </div>

        {/* SECTION 2: STANDBY (as before) */}
        {/* ... */}

        {/* SECTION 3: YOUR NEXT SHOOT (CALENDAR DATA) */}
        <div className="flex-shrink-0 min-w-[340px] border-l border-gray-800 pl-8">
          <p className="text-[10px] text-blue-500 uppercase tracking-widest mb-2 font-bold">Your Next Shoot</p>
          {myNextShoot ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-white font-bold text-base truncate max-w-[320px]">
                <Camera className="h-4 w-4 text-blue-400 flex-shrink-0" />
                {/* Pulls directly from Calendar Event Title */}
                {myNextShoot.event_title}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-[10px] font-mono font-bold text-gray-300 bg-gray-800 px-2.5 py-1 rounded">
                  {/* Pulls precise date and time from Calendar start_time */}
                  {format(new Date(myNextShoot.start_time), 'MMM d @ HH:mm')}
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/20">
                  <Timer className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-[11px] font-mono font-bold text-blue-400 uppercase tabular-nums">
                    {getCountdown(myNextShoot.start_time)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-600 italic">No calendar events found</div>
          )}
        </div>

      </div>
    </div>
  );
}