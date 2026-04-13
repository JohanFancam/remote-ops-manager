import React, { useState, useEffect, useMemo } from 'react';
import { Camera, Phone, Clock, ChevronDown, Timer, ArrowRight } from 'lucide-react';
import { format, differenceInSeconds, intervalToDuration, isAfter, parseISO } from 'date-fns';

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
      setTime(current.toLocaleTimeString('en-ZA', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDate(current.toLocaleDateString('en-ZA', { timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [tz]);
  return { time, date, now };
}

export default function DashboardBanner({ user, shoots = [], standbyDays = [], allUsers = [] }) {
  const [tz, setTz] = useState(() => localStorage.getItem('dashboard_tz') || 'Africa/Johannesburg');
  const [showTzPicker, setShowTzPicker] = useState(false);
  const { time, date, now } = useClock(tz);

  const handleTzChange = (newTz) => {
    setTz(newTz);
    localStorage.setItem('dashboard_tz', newTz);
    setShowTzPicker(false);
  };

  const getStandbyName = (sd) => {
    const u = allUsers.find(u => u.email === sd.admin_email);
    return u?.full_name || sd.admin_name || sd.admin_email?.split('@')[0] || '?';
  };

  // --- STANDBY LOGIC ---
  const currentStandby = standbyDays.find(sd => {
    const start = new Date(`${sd.start_date || sd.date}T${sd.start_time || '00:00'}`);
    const end = new Date(`${sd.end_date || sd.start_date || sd.date}T${sd.end_time || '23:59:59'}`);
    return now >= start && now <= end;
  });

  const nextStandby = useMemo(() => {
    return standbyDays
      .filter(sd => isAfter(new Date(`${sd.start_date || sd.date}T${sd.start_time || '00:00'}`), now))
      .sort((a, b) => new Date(`${a.start_date || a.date}T${a.start_time || '00:00'}`) - new Date(`${b.start_date || b.date}T${b.start_time || '00:00'}`))[0];
  }, [standbyDays, now]);

  // --- INDIVIDUAL NEXT SHOOT LOGIC ---
  const myNextShoot = useMemo(() => {
    const upcoming = shoots.filter(s => {
      const isAssigned = s.assigned_operators?.includes(user?.email);
      // We check if it is assigned, not cancelled, and not already complete
      if (!isAssigned || s.status === 'cancelled' || s.phase_status?.shoot_complete) return false;

      // Extract time from whatever field your DB uses
      const sTime = s.setup_time || s.start_time || s.time || '00:00';
      const shootTime = new Date(`${s.date}T${sTime}:00`);
      
      // Keep shoots that are either happening now or in the future
      return isAfter(shootTime, now) || (s.date === format(now, 'yyyy-MM-dd') && !s.phase_status?.shoot_complete);
    });

    return upcoming.sort((a, b) => {
      const timeA = new Date(`${a.date}T${a.setup_time || a.start_time || a.time || '00:00'}`);
      const timeB = new Date(`${b.date}T${b.setup_time || b.start_time || b.time || '00:00'}`);
      return timeA - timeB;
    })[0];
  }, [shoots, now, user?.email]);

  const getCountdown = (targetDate, targetTime) => {
    const target = new Date(`${targetDate}T${targetTime || '00:00'}:00`);
    const diff = differenceInSeconds(target, now);
    if (diff <= 0) return "Starting Now";
    const d = intervalToDuration({ start: now, end: target });
    if (d.days > 0) return `${d.days}d ${d.hours}h ${d.minutes}m`;
    return `${d.hours}h ${d.minutes}m ${d.seconds}s`;
  };

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6 shadow-xl">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        
        {/* SECTION 1: CLOCK */}
        <div className="flex-shrink-0 min-w-[180px]">
          <div className="font-mono text-4xl font-bold text-white tracking-tighter tabular-nums">{time}</div>
          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">{date}</div>
          <button onClick={() => setShowTzPicker(!showTzPicker)} className="mt-3 flex items-center gap-2 text-[10px] font-bold text-blue-400 uppercase tracking-widest">
            <Clock className="h-3 w-3" /> {TIMEZONES.find(t => t.tz === tz)?.label} <ChevronDown className="h-3 w-3" />
          </button>
          {showTzPicker && (
            <div className="absolute mt-2 z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-2xl py-1 min-w-[160px]">
              {TIMEZONES.map(t => (
                <button key={t.tz} onClick={() => handleTzChange(t.tz)} className={`w-full text-left px-4 py-2 text-xs hover:bg-gray-700 ${tz === t.tz ? 'text-blue-400 font-bold' : 'text-gray-300'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* SECTION 2: STANDBY (Horizontal) */}
        <div className="flex flex-1 items-center gap-8 border-l border-gray-800 pl-8">
          <div className="flex-1">
            <p className="text-[10px] text-yellow-600 uppercase tracking-widest mb-2 font-bold">On Standby Now</p>
            {currentStandby ? (
              <div>
                <div className="text-white font-bold text-sm flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-yellow-500" /> {getStandbyName(currentStandby)}
                </div>
                <div className="text-[10px] text-gray-500 mt-1">Until {currentStandby.end_time || '23:59'}</div>
              </div>
            ) : <div className="text-xs text-gray-600 italic">None Active</div>}
          </div>

          <ArrowRight className="h-4 w-4 text-gray-700" />

          <div className="flex-1">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-bold">Next Standby</p>
            {nextStandby ? (
              <div>
                <div className="text-gray-300 font-bold text-sm">{getStandbyName(nextStandby)}</div>
                <div className="text-[10px] text-gray-500 mt-1">{format(new Date(nextStandby.start_date || nextStandby.date + 'T12:00:00'), 'MMM d')} @ {nextStandby.start_time || '00:00'}</div>
              </div>
            ) : <div className="text-xs text-gray-600 italic">None Scheduled</div>}
          </div>
        </div>

        {/* SECTION 3: YOUR NEXT SHOOT */}
        <div className="flex-shrink-0 min-w-[340px] border-l border-gray-800 pl-8">
          <p className="text-[10px] text-blue-500 uppercase tracking-widest mb-2 font-bold">Your Next Shoot</p>
          {myNextShoot ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-white font-bold text-base truncate max-w-[320px]">
                <Camera className="h-4 w-4 text-blue-400 flex-shrink-0" />
                {myNextShoot.event_name || myNextShoot.shoot_name || myNextShoot.name || 'Untitled Shoot'}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-[10px] font-mono font-bold text-gray-300 bg-gray-800 px-2.5 py-1 rounded">
                  {format(new Date(myNextShoot.date + 'T12:00:00'), 'MMM d')} @ {myNextShoot.setup_time || myNextShoot.start_time || myNextShoot.time || '00:00'}
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/20">
                  <Timer className="h-3.5 w-3.5 text-blue-400" />
                  <span className="text-[11px] font-mono font-bold text-blue-400 uppercase tabular-nums">
                    {getCountdown(myNextShoot.date, myNextShoot.setup_time || myNextShoot.start_time || myNextShoot.time)}
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