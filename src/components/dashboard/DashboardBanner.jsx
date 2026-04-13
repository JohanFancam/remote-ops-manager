import React, { useState, useEffect, useMemo } from 'react';
import { Camera, Phone, Clock, ChevronDown, Timer } from 'lucide-react';
import { format, differenceInSeconds, intervalToDuration, isAfter, parse } from 'date-fns';

const TIMEZONES = [
  { label: 'SA Time (SAST)', tz: 'Africa/Johannesburg' },
  { label: 'US Eastern (ET)', tz: 'America/New_York' },
  { label: 'US Central (CT)', tz: 'America/Chicago' },
  { label: 'US Mountain (MT)', tz: 'America/Denver' },
  { label: 'US Pacific (PT)', tz: 'America/Los_Angeles' },
];

function useClock(tz) {
  const [time, setTime] = useState('');
  const [date, setDate] = useState('');
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const tick = () => {
      const current = new Date();
      setNow(current);
      // We use en-ZA to get the 24h format naturally
      setTime(current.toLocaleTimeString('en-ZA', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDate(current.toLocaleDateString('en-ZA', { timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [tz]);
  return { time, date, now };
}

export default function DashboardBanner({ user, isAdmin, shoots = [], standbyDays = [], allUsers = [], todayStr }) {
  const [tz, setTz] = useState(() => localStorage.getItem('dashboard_tz') || 'Africa/Johannesburg');
  const [showTzPicker, setShowTzPicker] = useState(false);
  const { time, date, now } = useClock(tz);

  const handleTzChange = (newTz) => {
    setTz(newTz);
    localStorage.setItem('dashboard_tz', newTz);
    setShowTzPicker(false);
  };

  // --- 1. ROBUST NEXT SHOOT CALCULATION ---
  const myNextShoot = useMemo(() => {
    const upcoming = shoots.filter(s => {
      // Basic validation
      if (!s.date || s.status === 'cancelled') return false;
      
      // Permissions: Admin sees all, User sees assigned
      const isAssigned = s.assigned_operators?.includes(user?.email);
      if (!isAdmin && !isAssigned) return false;

      // Parse the shoot time safely (combining date and time)
      // We use "YYYY-MM-DD HH:mm" format
      const shootDateTime = new Date(`${s.date}T${s.setup_time || '00:00'}:00`);
      
      // Return true only if the shoot setup is actually in the future
      return isAfter(shootDateTime, now);
    });

    // Sort by chronological order
    return upcoming.sort((a, b) => {
      const dateA = new Date(`${a.date}T${a.setup_time || '00:00'}`);
      const dateB = new Date(`${b.date}T${b.setup_time || '00:00'}`);
      return dateA - dateB;
    })[0];
  }, [shoots, now, user?.email, isAdmin]);

  // --- 2. COUNTDOWN FORMATTER ---
  const getCountdown = (targetDate, targetTime) => {
    const target = new Date(`${targetDate}T${targetTime || '00:00'}:00`);
    const diff = differenceInSeconds(target, now);
    
    if (diff <= 0) return "Live Now";
    
    const d = intervalToDuration({ start: now, end: target });
    
    if (d.days > 0) return `${d.days}d ${d.hours}h ${d.minutes}m`;
    if (d.hours > 0) return `${d.hours}h ${d.minutes}m ${d.seconds}s`;
    return `${d.minutes}m ${d.seconds}s`;
  };

  // --- 3. STANDBY LOGIC ---
  const currentStandby = standbyDays.filter(sd => {
    const startDt = new Date(`${sd.start_date || sd.date}T${sd.start_time || '00:00'}`);
    const endDt = new Date(`${sd.end_date || sd.start_date || sd.date}T${sd.end_time || '23:59:59'}`);
    return now >= startDt && now <= endDt;
  });

  const getStandbyName = (sd) => {
    const u = allUsers.find(u => u.email === sd.admin_email);
    return u?.full_name || sd.admin_name || sd.admin_email?.split('@')[0] || '?';
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-6">
        
        {/* TIME SECTION */}
        <div className="flex-shrink-0">
          <div className="font-mono text-3xl font-bold text-white tracking-wider tabular-nums">{time}</div>
          <div className="text-xs text-gray-400 mt-0.5">{date}</div>
          <div className="relative mt-2">
            <button onClick={() => setShowTzPicker(!showTzPicker)} className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-950/30 border border-blue-800/40 px-2.5 py-1 rounded-lg">
              <Clock className="h-3 w-3" /> {TIMEZONES.find(t => t.tz === tz)?.label} <ChevronDown className="h-3 w-3" />
            </button>
            {showTzPicker && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[180px]">
                {TIMEZONES.map(t => (
                  <button key={t.tz} onClick={() => handleTzChange(t.tz)} className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-800 ${tz === t.tz ? 'text-blue-400 font-semibold' : 'text-gray-300'}`}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="hidden lg:block w-px h-12 bg-gray-800" />

        {/* STANDBY SECTION */}
        <div className="flex-shrink-0 min-w-[140px]">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-bold">Standby</p>
          {currentStandby.length > 0 ? (
            currentStandby.map((sd, i) => (
              <div key={i} className="mb-1">
                <span className="flex items-center gap-1.5 text-sm font-bold text-yellow-500">
                  <Phone className="h-3 w-3" /> {getStandbyName(sd)}
                </span>
                <span className="text-[10px] text-gray-500 block ml-4.5">until {sd.end_time || '23:59'}</span>
              </div>
            ))
          ) : (
            <span className="text-sm text-gray-600 italic">No Standby</span>
          )}
        </div>

        <div className="hidden lg:block w-px h-12 bg-gray-800" />

        {/* NEXT SHOOT SECTION */}
        <div className="flex-shrink-0 min-w-[260px]">
          <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-bold">
            {isAdmin ? "Next Company Shoot" : "My Next Shoot"}
          </p>
          {myNextShoot ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-sm truncate max-w-[240px]">
                <Camera className="h-3.5 w-3.5" />
                {/* Check for all possible naming conventions from your DB */}
                {myNextShoot.shoot_name || myNextShoot.event_name || myNextShoot.title || 'Untitled Shoot'}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-gray-300">{myNextShoot.setup_time || '00:00'}</span>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                  <Timer className="h-3 w-3 text-blue-400" />
                  <span className="text-[11px] font-mono font-bold text-blue-400 tabular-nums">
                    {getCountdown(myNextShoot.date, myNextShoot.setup_time)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <span className="text-sm text-gray-500 italic">No shoots found</span>
          )}
        </div>

        <div className="hidden lg:block w-px h-12 bg-gray-800 flex-1" />

        {/* COMPACT STATS */}
        <div className="flex gap-4">
          <div className="text-right">
            <div className="text-xl font-bold text-white leading-none">
              {shoots.filter(s => s.date?.startsWith(format(now, 'yyyy-MM')) && s.assigned_operators?.includes(user?.email)).length}
            </div>
            <div className="text-[10px] text-gray-500 uppercase mt-1">Monthly</div>
          </div>
          <div className="text-right">
            <div className={`text-xl font-bold leading-none ${shoots.filter(s => s.pending_operators?.length > 0).length > 0 ? 'text-orange-400' : 'text-white'}`}>
              {isAdmin 
                ? shoots.filter(s => (s.pending_operators?.length || 0) > 0 && s.date >= todayStr).length
                : shoots.filter(s => s.pending_operators?.includes(user?.email) && s.date >= todayStr).length}
            </div>
            <div className="text-[10px] text-gray-500 uppercase mt-1">Pending</div>
          </div>
        </div>

      </div>
    </div>
  );
}