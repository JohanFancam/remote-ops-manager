import React, { useState, useEffect, useMemo } from 'react';
import { Phone, Clock, ChevronDown, CheckCircle2, Play } from 'lucide-react';
import { format } from 'date-fns';
import { shortenTitle } from '../utils/scheduleUtils';

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
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-ZA', { timeZone: tz, hour: '2-digit', minute: '2-digit', second: '2-digit' }));
      setDate(now.toLocaleDateString('en-ZA', { timeZone: tz, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }));
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [tz]);
  return { time, date };
}

function StatChip({ label, value, color = 'text-white', highlight = false }) {
  return (
    <div className={`flex flex-col items-center px-4 py-2 rounded-lg ${highlight ? 'bg-yellow-950/40 border border-yellow-700/40' : 'bg-gray-800/60 border border-gray-700/40'}`}>
      <span className={`text-2xl font-bold ${color}`}>{value}</span>
      <span className={`text-xs mt-0.5 ${highlight ? 'text-yellow-400' : 'text-gray-400'}`}>{label}</span>
    </div>
  );
}

function getSetupTime(shoot) {
  if (!shoot?.game_time) return null;
  const [h, m] = shoot.game_time.split(':').map(Number);
  const offset = shoot.setup_offset ?? -150;
  const totalMins = h * 60 + m + offset;
  const hh = Math.floor(((totalMins % 1440) + 1440) % 1440 / 60);
  const mm = ((totalMins % 60) + 60) % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function getCountdownToSetup(shoot) {
  if (!shoot?.game_time || !shoot?.date) return null;
  const setupTime = getSetupTime(shoot);
  if (!setupTime) return null;
  const setupDt = new Date(`${shoot.date}T${setupTime}:00`);
  const diff = setupDt - new Date();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function DashboardBanner({ user, isAdmin, shoots = [], standbyDays = [], allUsers = [], todayStr }) {
  const [tz, setTz] = useState(() => localStorage.getItem('dashboard_tz') || 'Africa/Johannesburg');
  const [showTzPicker, setShowTzPicker] = useState(false);
  const { time, date } = useClock(tz);

  const handleTzChange = (newTz) => {
    setTz(newTz);
    localStorage.setItem('dashboard_tz', newTz);
    setShowTzPicker(false);
  };

  const now = new Date();

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
    .sort((a, b) => {
      const aStart = new Date(`${a.start_date || a.date}T${a.start_time || '00:00'}`);
      const bStart = new Date(`${b.start_date || b.date}T${b.start_time || '00:00'}`);
      return aStart - bStart;
    });
  const nextStandby = futureStandby[0] || null;

  const getStandbyName = (sd) => {
    const u = allUsers.find(u => u.email === sd.admin_email);
    return u?.full_name || sd.admin_name || sd.admin_email?.split('@')[0] || '?';
  };

  const formatStandbyTime = (sd, type) => {
    if (type === 'end') {
      const endDate = sd.end_date || sd.start_date || sd.date;
      if (!endDate) return null;
      return sd.end_time ? `${format(new Date(endDate + 'T12:00:00'), 'MMM d')} ${sd.end_time}` : format(new Date(endDate + 'T12:00:00'), 'MMM d');
    } else {
      const startDate = sd.start_date || sd.date;
      if (!startDate) return null;
      return sd.start_time ? `${format(new Date(startDate + 'T12:00:00'), 'MMM d')} ${sd.start_time}` : format(new Date(startDate + 'T12:00:00'), 'MMM d');
    }
  };

  const thisMonth = format(now, 'yyyy-MM');

  const myShootsThisMonth = shoots.filter(s =>
    s.date?.startsWith(thisMonth) && s.assigned_operators?.includes(user?.email)
  ).length;

  const myStandbyDaysThisMonth = (() => {
    const dates = new Set();
    standbyDays.filter(sd => sd.admin_email === user?.email).forEach(sd => {
      const start = sd.start_date || sd.date;
      const end = sd.end_date || start;
      if (!start) return;
      const cur = new Date(start + 'T12:00:00');
      const last = new Date(end + 'T12:00:00');
      while (cur <= last) {
        const ds = format(cur, 'yyyy-MM-dd');
        if (ds.startsWith(thisMonth)) dates.add(ds);
        cur.setDate(cur.getDate() + 1);
      }
    });
    return dates.size;
  })();

  const pendingApprovalsCount = isAdmin
    ? shoots.filter(s => (s.pending_operators?.length || 0) > 0 && s.date >= todayStr).length
    : shoots.filter(s => s.pending_operators?.includes(user?.email) && s.date >= todayStr).length;

  // Current & next shoot — shown for ALL users
  const myTodayShoots = useMemo(() => {
    return shoots
      .filter(s => s.date === todayStr && s.status !== 'cancelled' && s.assigned_operators?.includes(user?.email))
      .sort((a, b) => (a.game_time || '').localeCompare(b.game_time || ''));
  }, [shoots, todayStr, user?.email]);

  const currentShoot = useMemo(() => {
    return myTodayShoots.find(s => s.phase_status?.setup_complete && !s.phase_status?.shoot_complete) || null;
  }, [myTodayShoots]);

  const nextShoot = useMemo(() => {
    if (currentShoot) {
      const idx = myTodayShoots.findIndex(s => s.id === currentShoot.id);
      return myTodayShoots[idx + 1] || null;
    }
    const nowStr = new Date().toTimeString().slice(0, 5);
    const upcoming = myTodayShoots.find(s => !s.phase_status?.shoot_complete && (s.game_time || '99:99') >= nowStr);
    if (upcoming) return upcoming;
    return shoots.find(s =>
      s.date > todayStr && s.status !== 'cancelled' && s.assigned_operators?.includes(user?.email) && !s.phase_status?.shoot_complete
    ) || null;
  }, [myTodayShoots, currentShoot, shoots, todayStr, user?.email]);

  const myUpcomingCount = shoots.filter(s => {
    if (s.status === 'cancelled') return false;
    if (s.date === todayStr) return s.assigned_operators?.includes(user?.email) && !s.phase_status?.shoot_complete;
    return s.date > todayStr && s.assigned_operators?.includes(user?.email);
  }).length;

  const thisMonthCount = shoots.filter(s =>
    s.date?.startsWith(thisMonth) && s.assigned_operators?.includes(user?.email)
  ).length;

  const totalAssignedCount = shoots.filter(s => s.assigned_operators?.includes(user?.email)).length;

  const selectedTzLabel = TIMEZONES.find(t => t.tz === tz)?.label || 'SA Time';

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
        {/* Clock + Timezone */}
        <div className="flex-shrink-0">
          <div className="font-mono text-3xl font-bold text-white tracking-wider">{time}</div>
          <div className="text-xs text-gray-400 mt-0.5">{date}</div>
          <div className="relative mt-2">
            <button
              onClick={() => setShowTzPicker(!showTzPicker)}
              className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 bg-blue-950/30 border border-blue-800/40 px-2.5 py-1 rounded-lg"
            >
              <Clock className="h-3 w-3" />
              {selectedTzLabel}
              <ChevronDown className="h-3 w-3" />
            </button>
            {showTzPicker && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[180px]">
                {TIMEZONES.map(t => (
                  <button
                    key={t.tz}
                    onClick={() => handleTzChange(t.tz)}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-800 transition-colors ${tz === t.tz ? 'text-blue-400 font-semibold' : 'text-gray-300'}`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="hidden lg:block w-px h-16 bg-gray-700 flex-shrink-0" />

        {/* Standby Status */}
        <div className="flex-shrink-0 min-w-[180px]">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">On Standby Now</p>
          {currentStandby.length > 0 ? (
            <div className="space-y-1">
              {currentStandby.map((sd, i) => (
                <div key={i} className="flex flex-col gap-0">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-yellow-300">
                    <Phone className="h-3 w-3 flex-shrink-0" />
                    {getStandbyName(sd)}
                  </span>
                  {formatStandbyTime(sd, 'end') && (
                    <span className="text-xs text-yellow-600 pl-4">until {formatStandbyTime(sd, 'end')}</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <span className="text-sm text-gray-500 italic">No one assigned</span>
          )}
          {nextStandby && (
            <div className="mt-2 pt-2 border-t border-gray-700/50">
              <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Next Up</p>
              <div className="flex flex-col gap-0">
                <span className="text-sm font-medium text-gray-300">{getStandbyName(nextStandby)}</span>
                {formatStandbyTime(nextStandby, 'start') && (
                  <span className="text-xs text-gray-500">from {formatStandbyTime(nextStandby, 'start')}</span>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="hidden lg:block w-px h-16 bg-gray-700 flex-shrink-0" />

        {/* Current / Next Shoot — all users */}
        <div className="flex-shrink-0 min-w-[180px]">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">Current Shoot</p>
          {currentShoot ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <Play className="h-3 w-3 text-green-400 flex-shrink-0" />
                <span className="text-sm font-semibold text-green-300 leading-tight">{shortenTitle(currentShoot.title)}</span>
              </div>
              {currentShoot.game_time && (
                <span className="text-xs text-green-600 pl-4 block">Game @ {currentShoot.game_time}</span>
              )}
            </div>
          ) : (
            <span className="text-sm text-gray-500 italic">No active shoot</span>
          )}
          {nextShoot && (
            <div className="mt-2 pt-2 border-t border-gray-700/50">
              <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Next Shoot</p>
              <p className="text-sm font-medium text-gray-300 leading-tight">{shortenTitle(nextShoot.title)}</p>
              {nextShoot.game_time && (
                <p className="text-xs text-gray-500">Game @ {nextShoot.game_time}</p>
              )}
              {getCountdownToSetup(nextShoot) && (
                <p className="text-xs text-orange-400 font-mono mt-0.5">Setup in {getCountdownToSetup(nextShoot)}</p>
              )}
            </div>
          )}
        </div>

        <div className="hidden lg:block w-px h-16 bg-gray-700 flex-shrink-0" />

        {/* Stats */}
        <div className="flex flex-wrap gap-2 flex-1">
          {isAdmin ? (
            <>
              <StatChip label="My Shoots (Month)" value={myShootsThisMonth} color="text-blue-300" />
              <StatChip label="My Standby (Month)" value={myStandbyDaysThisMonth} color="text-yellow-300" />
              <StatChip label="Pending Approvals" value={pendingApprovalsCount} color={pendingApprovalsCount > 0 ? 'text-orange-300' : 'text-white'} highlight={pendingApprovalsCount > 0} />
            </>
          ) : (
            <>
              <StatChip label="My Upcoming" value={myUpcomingCount} color="text-blue-300" />
              <StatChip label="This Month" value={thisMonthCount} color="text-purple-300" />
              <StatChip label="Total Assigned" value={totalAssignedCount} color="text-white" />
              <StatChip label="Pending Approval" value={pendingApprovalsCount} color={pendingApprovalsCount > 0 ? 'text-orange-300' : 'text-white'} highlight={pendingApprovalsCount > 0} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}