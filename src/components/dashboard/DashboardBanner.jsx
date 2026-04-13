import React, { useState, useEffect, useMemo } from 'react';
import { Camera, Phone, Clock, ChevronDown, Timer } from 'lucide-react';
import { format, differenceInSeconds, intervalToDuration } from 'date-fns';

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

function StatChip({ label, value, color = 'text-white', highlight = false }) {
  return (
    <div className={`flex flex-col items-center px-4 py-2 rounded-lg ${highlight ? 'bg-yellow-950/40 border border-yellow-700/40' : 'bg-gray-800/60 border border-gray-700/40'}`}>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      <span className={`text-xs mt-0.5 ${highlight ? 'text-yellow-400' : 'text-gray-400'}`}>{label}</span>
    </div>
  );
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

  // --- REFINED NEXT SHOOT LOGIC ---
  const myNextShoot = useMemo(() => {
    const filtered = shoots.filter(s => {
      if (s.status === 'cancelled') return false;
      
      // If not admin, only show shoots where user is assigned
      const isAssigned = s.assigned_operators?.includes(user?.email);
      if (!isAdmin && !isAssigned) return false;

      // Robust Date Parsing: Combine date and time
      // We use a space instead of 'T' to help some browser engines parse as local time
      const shootDateStr = `${s.date} ${s.setup_time || '00:00'}:00`;
      const shootTime = new Date(shootDateStr);

      // Return true if the shoot setup is in the future
      return shootTime > now;
    });

    // Sort by soonest first
    return filtered.sort((a, b) => {
      return new Date(`${a.date} ${a.setup_time}`) - new Date(`${b.date} ${b.setup_time}`);
    })[0];
  }, [shoots, now, user?.email, isAdmin]);

  const getCountdown = (targetDate, targetTime) => {
    const target = new Date(`${targetDate} ${targetTime || '00:00'}:00`);
    const diff = differenceInSeconds(target, now);
    
    if (diff <= 0) return "In Progress";
    
    const d = intervalToDuration({ start: now, end: target });
    
    if (d.days > 0) return `${d.days}d ${d.hours}h ${d.minutes}m`;
    if (d.hours > 0) return `${d.hours}h ${d.minutes}m ${d.seconds}s`;
    return `${d.minutes}m ${d.seconds}s`;
  };

  // --- STANDBY LOGIC ---
  const currentStandby = standbyDays.filter(sd => {
    const startDt = new Date(`${sd.start_date || sd.date} ${sd.start_time || '00:00'}`);
    const endDt = new Date(`${sd.end_date || sd.start_date || sd.date} ${sd.end_time || '23:59:59'}`);
    return now >= startDt && now <= endDt;
  });

  const getStandbyName = (sd) => {
    const u = allUsers.find(u => u.email === sd.admin_email);
    return u?.full_name || sd.admin_name || sd.admin_email?.split('@')[0] || '?';
  };

  const thisMonth = format(now, 'yyyy-MM');
  const pendingApprovalsCount = isAdmin
    ? shoots.filter(s => (s.pending_operators?.length || 0) > 0 && s.date >= todayStr).length
    : shoots.filter(s => s.pending_operators?.includes(user?.email) && s.date >= todayStr).length;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-6">
        
        {/* CLOCK */}
        <div className="flex-shrink-0">
          <div className="font-mono text-3xl font-bold text-white tracking-wider">{time}</div>
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

        {/* STANDBY */}
        <div className="flex-shrink-0 min-w-[140px]">
          <p className="text-[10px] text-gray-500 uppercase tracking-[0.1em] mb-2 font-semibold">Standby</p>
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
            <span className="text-sm text-gray-600 italic">None Active</span>
          )}
        </div>

        <div className="hidden lg:block w-px h-12 bg-gray-800" />

        {/* NEXT SHOOT SECTION */}
        <div className="flex-shrink-0 min-w-[240px]">
          <p className="text-[10px] text-gray-500 uppercase tracking-[0.1em] mb-2 font-semibold">
            {isAdmin ? "Next Company Shoot" : "My Next Shoot"}
          </p>
          {myNextShoot ? (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 text-blue-400 font-bold text-sm truncate max-w-[220px]">
                <Camera className="h-3.5 w-3.5" />
                {myNextShoot.shoot_name || myNextShoot.event_name || 'Untitled Shoot'}
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs font-mono text-gray-400">{myNextShoot.setup_time || '00:00'}</span>
                <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20">
                  <Timer className="h-3 w-3 text-blue-400" />
                  <span className="text-[11px] font-mono font-bold text-blue-400 uppercase">
                    {getCountdown(myNextShoot.date, myNextShoot.setup_time)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <span className="text-sm text-gray-600 italic">No upcoming shoots</span>
          )}
        </div>

        <div className="hidden lg:block w-px h-12 bg-gray-800" />

        {/* STATS */}
        <div className="flex gap-3 flex-1 justify-end">
          <StatChip 
            label={isAdmin ? "Total Pending" : "My Pending"} 
            value={pendingApprovalsCount} 
            color={pendingApprovalsCount > 0 ? 'text-orange-400' : 'text-gray-400'} 
            highlight={pendingApprovalsCount > 0} 
          />
          <StatChip 
            label="Monthly" 
            value={shoots.filter(s => s.date?.startsWith(thisMonth) && s.assigned_operators?.includes(user?.email)).length} 
            color="text-white" 
          />
        </div>
      </div>
    </div>
  );
}