import React, { useState, useEffect, useMemo } from 'react';
import { Camera, Phone, Clock, ChevronDown, Timer, ArrowRight } from 'lucide-react';
import { format, differenceInSeconds, intervalToDuration, isAfter, isValid } from 'date-fns';

// ... (useClock hook remains the same)

export default function DashboardBanner({ user, shoots = [], standbyDays = [], allUsers = [] }) {
  const [tz, setTz] = useState(() => localStorage.getItem('dashboard_tz') || 'Africa/Johannesburg');
  const { time, date, now } = useClock(tz);

  // --- LOGIC SYNCED WITH COUNTDOWNCARD ---
  const myNextShoot = useMemo(() => {
    if (!user?.email || !shoots?.length) return null;

    // Use the exact same filter as your card list
    const userUpcoming = shoots.filter(s => {
      const isAssigned = s.assigned_operators?.includes(user.email);
      const isNotComplete = !s.phase_status?.shoot_complete;
      const isNotCancelled = s.status !== 'cancelled';
      return isAssigned && isNotComplete && isNotCancelled;
    });

    // Sort to get the absolute next setup
    return userUpcoming.sort((a, b) => {
      const tA = new Date(`${a.date}T${a.setup_time || a.start_time || "00:00"}`);
      const tB = new Date(`${b.date}T${b.setup_time || b.start_time || "00:00"}`);
      return tA - tB;
    })[0];
  }, [shoots, now, user?.email]);

  // Mirror the CountdownCard display logic
  const getCountdown = (s) => {
    if (!s) return "";
    const target = new Date(`${s.date}T${s.setup_time || s.start_time || "00:00"}`);
    if (!isValid(target)) return "--:--:--";
    
    const diff = differenceInSeconds(target, now);
    if (diff <= 0) return "LIVE";
    
    const d = intervalToDuration({ start: now, end: target });
    const parts = [];
    if (d.days > 0) parts.push(`${d.days}d`);
    const h = String(d.hours || 0).padStart(2, '0');
    const m = String(d.minutes || 0).padStart(2, '0');
    const s_val = String(d.seconds || 0).padStart(2, '0');
    return `${parts.join(' ')} ${h}:${m}:${s_val}`.trim();
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6 shadow-xl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        
        {/* SECTION 1: CLOCK */}
        <div className="flex-shrink-0 min-w-[180px]">
          <div className="font-mono text-4xl font-bold text-white tracking-tighter tabular-nums">{time}</div>
          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">{date}</div>
        </div>

        {/* SECTION 2: STANDBY (Uniform Box Style) */}
        <div className="flex flex-1 items-center gap-8 border-l border-gray-800 pl-8">
          <div className="flex-1 min-w-[150px]">
            <p className="text-[10px] text-yellow-500 uppercase tracking-widest mb-2 font-bold">On Standby Now</p>
            {currentStandby ? (
              <div className="space-y-2">
                <div className="text-white font-bold text-sm flex items-center gap-2 truncate">
                  <Phone className="h-3.5 w-3.5 text-yellow-500" /> {getStandbyName(currentStandby)}
                </div>
                <div className="flex items-center gap-2">
                   <div className="text-[10px] font-mono font-bold text-gray-400 bg-gray-800 px-2 py-0.5 rounded uppercase">
                      {format(new Date(`${currentStandby.end_date || currentStandby.date}T12:00:00`), 'MMM d')}
                   </div>
                   <div className="text-[10px] font-mono font-bold text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded">
                      {currentStandby.end_time || '06:30'}
                   </div>
                </div>
              </div>
            ) : <div className="text-xs text-gray-600 italic">None Active</div>}
          </div>

          <ArrowRight className="h-4 w-4 text-gray-700" />

          <div className="flex-1 min-w-[150px]">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-bold">Next Standby</p>
            {nextStandby ? (
              <div className="space-y-2">
                <div className="text-gray-300 font-bold text-sm truncate">{getStandbyName(nextStandby)}</div>
                <div className="flex items-center gap-2">
                  <div className="text-[10px] font-mono font-bold text-gray-400 bg-gray-800 px-2 py-0.5 rounded uppercase">
                    {format(new Date(`${nextStandby.start_date || nextStandby.date}T12:00:00`), 'MMM d')}
                  </div>
                  <div className="text-[10px] font-mono font-bold text-gray-400 bg-gray-800 px-2 py-0.5 rounded">
                    {nextStandby.start_time || '07:00'}
                  </div>
                </div>
              </div>
            ) : <div className="text-xs text-gray-600 italic">None Scheduled</div>}
          </div>
        </div>

        {/* SECTION 3: YOUR NEXT SHOOT (Synced with Card) */}
        <div className="flex-shrink-0 min-w-[340px] border-l border-gray-800 pl-8">
          <p className="text-[10px] text-blue-500 uppercase tracking-widest mb-2 font-bold">Your Next Shoot</p>
          {myNextShoot ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-white font-bold text-base truncate max-w-[320px]">
                <Camera className="h-4 w-4 text-blue-400 flex-shrink-0" />
                {/* Same logic as CountdownCard */}
                {myNextShoot.shoot_name || myNextShoot.event_name || 'Untitled Shoot'}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-[10px] font-mono font-bold text-gray-300 bg-gray-800 px-2.5 py-1 rounded uppercase">
                  {format(new Date(`${myNextShoot.date}T12:00:00`), 'MMM d')}
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/20">
                  <Timer className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-[11px] font-mono font-bold text-blue-400 uppercase tabular-nums">
                    {getCountdown(myNextShoot)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-600 italic">No upcoming assignments</div>
          )}
        </div>
      </div>
    </div>
  );
}