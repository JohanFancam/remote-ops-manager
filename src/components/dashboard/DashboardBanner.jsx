import React, { useState, useEffect } from 'react';
import { Camera, Phone, Clock, CalendarDays, ChevronDown, Timer } from 'lucide-react';
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
  const [now, setNow] = useState(new Date()); // Added raw date for countdowns

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

  // --- LOGIC FOR STANDBY ---
  const currentStandby = standbyDays.filter(sd => {
    const startDate = sd.start_date || sd.date;
    const endDate = sd.end_date || startDate;
    if (!startDate) return false;
    const startDt = new Date(`${startDate}T${sd.start_time || '00:00'}`);
    const endDt = new Date(`${endDate}T${sd.end_time || '23:59:59'}`);
    return now >= startDt && now <= endDt;
  });

  const futureStandby = standbyDays
    .filter(sd => {
      const startDate = sd.start_date || sd.date;
      if (!startDate) return false;
      const startDt = new Date(`${startDate}T${sd.start_time || '00:00'}`);
      return startDt > now;
    })
    .sort((a, b) => new Date(`${a.start_date || a.date}T${a.start_time || '00:00'}`) - new Date(`${b.start_date || b.date}T${b.start_time || '00:00'}`));
  
  const nextStandby = futureStandby[0] || null;

  // --- LOGIC FOR NEXT SHOOT & COUNTDOWN ---
  const myNextShoot = shoots
    .filter(s => {
      if (s.status === 'cancelled' || !s.assigned_operators?.includes(user?.email)) return false;
      const shootTime = new Date(`${s.date}T${s.setup_time || '00:00'}`);
      return shootTime > now;
    })
    .sort((a, b) => new Date(`${a.date}T${a.setup_time || '00:00'}`) - new Date(`${b.date}T${b.setup_time || '00:00'}`))[0];

  const getCountdown = (targetDate, targetTime) => {
    if (!targetDate) return null;
    const target = new Date(`${targetDate}T${targetTime || '00:00'}`);
    const secondsDiff = differenceInSeconds(target, now);
    
    if (secondsDiff <= 0) return "Starting now";
    
    const duration = intervalToDuration({ start: now, end: target });
    const parts = [];
    if (duration.days) parts.push(`${duration.days}d`);
    if (duration.hours || duration.days) parts.push(`${duration.hours}h`);
    parts.push(`${duration.minutes}m`);
    parts.push(`${duration.seconds}s`);
    
    return parts.slice(0, 3).join(' '); // Show top 3 units
  };

  const getStandbyName = (sd) => {
    const u = allUsers.find(u => u.email === sd.admin_email);
    return u?.full_name || sd.admin_name || sd.admin_email?.split('@')[0] || '?';
  };

  const formatStandbyTime = (sd, type) => {
    const d = type === 'end' ? (sd.end_date || sd.start_date || sd.date) : (sd.start_date || sd.date);
    if (!d) return null;
    const t = type === 'end' ? sd.end_time : sd.start_time;
    return t ? `${format(new Date(d + 'T12:00:00'), 'MMM d')} ${t}` : format(new Date(d + 'T12:00:00'), 'MMM d');
  };

  // Admin stats (unchanged logic)
  const thisMonth = format(now, 'yyyy-MM');
  const myShootsThisMonth = shoots.filter(s => s.date?.startsWith(thisMonth) && s.assigned_operators?.includes(user?.email)).length;
  const pendingApprovalsCount = isAdmin
    ? shoots.filter(s => (s.pending_operators?.length || 0) > 0 && s.date >= todayStr).length
    : shoots.filter(s => s.pending_operators?.includes(user?.email) && s.date >= todayStr).length;

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-6">
        {/* Clock + Timezone */}
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

        <div className="hidden lg:block w-px h-16 bg-gray-800" />

        {/* Standby Status */}
        <div className="flex-shrink-0 min-w-[160px]">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 font-medium">Standby</p>
          {currentStandby.length > 0 ? (
            currentStandby.map((sd, i) => (
              <div key={i} className="mb-2">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-yellow-300">
                  <Phone className="h-3 w-3" /> {getStandbyName(sd)}
                </span>
                <span className="text-[10px] text-yellow-600 block ml-4.5">until {formatStandbyTime(sd, 'end')}</span>
              </div>
            ))
          ) : (
            <span className="text-sm text-gray-600 italic">None active</span>
          )}
        </div>

        <div className="hidden lg:block w-px h-16 bg-gray-800" />

        {/* NEW: Next Shoot Countdown Section */}
        <div className="flex-shrink-0 min-w-[200px]">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5 font-medium">My Next Shoot</p>
          {myNextShoot ? (
            <div>
              <div className="flex items-center gap-2 text-blue-300 font-semibold text-sm truncate max-w-[220px]">
                <Camera className="h-3.5 w-3.5" />
                {myNextShoot.shoot_name || 'Untitled Shoot'}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-400">{myNextShoot.setup_time || '00:00'}</span>
                <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-blue-500/10 border border-blue-500/20">
                  <Timer className="h-3 w-3 text-blue-400" />
                  <span className="text-xs font-mono text-blue-400">
                    {getCountdown(myNextShoot.date, myNextShoot.setup_time)}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <span className="text-sm text-gray-600 italic">No upcoming shoots</span>
          )}
        </div>

        <div className="hidden lg:block w-px h-16 bg-gray-800" />

        {/* Stats */}
        <div className="flex flex-wrap gap-2 flex-1 justify-end">
          {isAdmin ? (
            <>
              <StatChip label="Monthly" value={myShootsThisMonth} color="text-blue-300" />
              <StatChip label="Pending" value={pendingApprovalsCount} color={pendingApprovalsCount > 0 ? 'text-orange-300' : 'text-white'} highlight={pendingApprovalsCount > 0} />
            </>
          ) : (
            <>
              <StatChip label="Upcoming" value={shoots.filter(s => s.date >= todayStr && s.assigned_operators?.includes(user?.email)).length} color="text-blue-300" />
              <StatChip label="Pending" value={pendingApprovalsCount} color={pendingApprovalsCount > 0 ? 'text-orange-300' : 'text-white'} highlight={pendingApprovalsCount > 0} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}