import React, { useState, useEffect } from 'react';
import { Camera, Phone, Clock, CalendarDays, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';

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

  // Who's on standby right now?
  const currentStandby = standbyDays.filter(sd => {
    const startDate = sd.start_date || sd.date;
    const endDate = sd.end_date || startDate;
    if (!startDate) return false;
    const startDt = new Date(`${startDate}T${sd.start_time || '00:00'}`);
    const endDt = new Date(`${endDate}T${sd.end_time || '23:59:59'}`);
    return now >= startDt && now <= endDt;
  });

  const standbyNames = currentStandby.map(sd => {
    const u = allUsers.find(u => u.email === sd.admin_email);
    return u?.full_name?.split(' ')[0] || sd.admin_name?.split(' ')[0] || sd.admin_email?.split('@')[0] || '?';
  });

  // Stats
  const upcomingCount = shoots.filter(s =>
    s.status !== 'cancelled' &&
    (s.date > todayStr || (s.date === todayStr && !s.phase_status?.shoot_complete))
  ).length;

  const myStandbyCount = standbyDays.filter(sd => {
    const startDate = sd.start_date || sd.date;
    return sd.admin_email === user?.email && startDate >= todayStr;
  }).length;

  const pendingApprovalsCount = isAdmin
    ? shoots.filter(s => (s.pending_operators?.length || 0) > 0 && s.date >= todayStr).length
    : shoots.filter(s => s.pending_operators?.includes(user?.email) && s.date >= todayStr).length;

  const myUpcomingCount = shoots.filter(s => {
    if (s.status === 'cancelled') return false;
    if (s.date === todayStr) return s.assigned_operators?.includes(user?.email) && !s.phase_status?.shoot_complete;
    return s.date > todayStr && s.assigned_operators?.includes(user?.email);
  }).length;

  const thisMonthCount = shoots.filter(s =>
    s.date?.startsWith(format(now, 'yyyy-MM')) &&
    s.assigned_operators?.includes(user?.email)
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

        {/* Divider */}
        <div className="hidden lg:block w-px h-16 bg-gray-700 flex-shrink-0" />

        {/* Standby Status */}
        <div className="flex-shrink-0">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1.5">On Standby Now</p>
          {standbyNames.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {standbyNames.map((name, i) => (
                <span key={i} className="flex items-center gap-1 text-sm font-semibold text-yellow-300 bg-yellow-950/40 border border-yellow-700/40 px-2.5 py-1 rounded-lg">
                  <Phone className="h-3 w-3" /> {name}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-sm text-gray-500 italic">No one assigned</span>
          )}
        </div>

        {/* Divider */}
        <div className="hidden lg:block w-px h-16 bg-gray-700 flex-shrink-0" />

        {/* Stats */}
        <div className="flex flex-wrap gap-2 flex-1">
          {isAdmin ? (
            <>
              <StatChip label="Upcoming Shoots" value={upcomingCount} color="text-blue-300" />
              <StatChip label="My Standby Days" value={myStandbyCount} color="text-yellow-300" />
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