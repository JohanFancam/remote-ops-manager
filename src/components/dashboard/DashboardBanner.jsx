import React, { useState, useEffect, useMemo } from 'react';
import { Camera, Phone, Clock, ChevronDown, Timer, ArrowRight } from 'lucide-react';
import { format, differenceInSeconds, intervalToDuration, isAfter, isValid } from 'date-fns';

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
      try {
        setTime(current.toLocaleTimeString('en-ZA', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        setDate(current.toLocaleDateString('en-ZA', { timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
      } catch (e) {
        setTime(current.toLocaleTimeString());
        setDate(current.toLocaleDateString());
      }
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

  // --- STANDBY LOGIC ---
  const getStandbyName = (sd) => {
    if (!sd) return '';
    const u = allUsers?.find(u => u.email === sd.admin_email);
    return u?.full_name || sd.admin_name || sd.admin_email?.split('@')[0] || 'Unknown';
  };

  const currentStandby = standbyDays?.find(sd => {
    const start = new Date(`${sd.start_date || sd.date}T${sd.start_time || '00:00'}`);
    const end = new Date(`${sd.end_date || sd.start_date || sd.date}T${sd.end_time || '23:59:59'}`);
    return isValid(start) && isValid(end) && now >= start && now <= end;
  });

  const nextStandby = (standbyDays || [])
    .filter(sd => isAfter(new Date(`${sd.start_date || sd.date}T${sd.start_time || '00:00'}`), now))
    .sort((a, b) => new Date(`${a.start_date || a.date}T${a.start_time || '00:00'}`) - new Date(`${b.start_date || b.date}T${b.start_time || '00:00'}`))[0];

  // --- NEXT SHOOT ENGINE ---
  const myNextShoot = useMemo(() => {
    if (!user?.email || !shoots?.length) return null;

    return shoots
      .filter(s => {
        const isAssigned = s.assigned_operators?.includes(user.email);
        const isNotComplete = !s.phase_status?.shoot_complete;
        const isNotCancelled = s.status !== 'cancelled';
        if (!isAssigned || !isNotComplete || !isNotCancelled) return false;

        const sTime = s.setup_time || s.start_time || s.time || "00:00";
        const shootTime = new Date(`${s.date}T${sTime}`);
        // We show it if it's today or in the future
        return isValid(shootTime) && (isAfter(shootTime, now) || s.date === format(now, 'yyyy-MM-dd'));
      })
      .sort((a, b) => {
        const tA = new Date(`${a.date}T${a.setup_time || a.start_time || a.time || "00:00"}`);
        const tB = new Date(`${b.date}T${b.setup_time || b.start_time || b.time || "00:00"}`);
        return tA - tB;
      })[0];
  }, [shoots, now, user?.email]);

  const getCountdown = (s) => {
    if (!s) return "";
    const target = new Date(`${s.date}T${s.setup_time || s.start_time || s.time || "00:00"}`);
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

        {/* SECTION 2: STANDBY */}
        <div className="flex flex-1 items-center gap-8 border-l border-gray-800 pl-8">
          <div className="flex-1">
            <p className="text-[10px] text-yellow-600 uppercase tracking-widest mb-2 font-bold">On Standby Now</p>
            {currentStandby ? (
              <div>
                <div className="text-white font-bold text-sm flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-yellow-500" /> {getStandbyName(currentStandby)}
                </div>
                <div className="text-[10px] text-gray-500 mt-1 font-mono">Until {currentStandby.end_time || '06:30'}</div>
              </div>
            ) : <div className="text-xs text-gray-600 italic">None Active</div>}
          </div>

          <ArrowRight className="h-4 w-4 text-gray-800" />

          <div className="flex-1">
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mb-2 font-bold">Next Standby</p>
            {nextStandby ? (
              <div>
                <div className="text-gray-300 font-bold text-sm">{getStandbyName(nextStandby)}</div>
                <div className="text-[10px] text-gray-500 mt-1 font-mono">{format(new Date(nextStandby.start_date + 'T12:00:00'), 'MMM d')} @ {nextStandby.start_time || '07:00'}</div>
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
                {/* AGGRESSIVE KEY CHECK: 
                  Looks through every possible property name to find the game title.
                */}
                {
                  myNextShoot.shoot_name || 
                  myNextShoot.event_name || 
                  myNextShoot.title || 
                  myNextShoot.label || 
                  myNextShoot.description || 
                  myNextShoot.client_name || 
                  'Next Shoot'
                }
              </div>
              <div className="flex items-center gap-3">
                <div className="text-[10px] font-mono font-bold text-gray-300 bg-gray-800 px-2.5 py-1 rounded uppercase tracking-wider">
                  {format(new Date(myNextShoot.date + 'T12:00:00'), 'MMM d')}
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