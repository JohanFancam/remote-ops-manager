import React, { useState, useEffect, useMemo } from 'react';
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { getDisplayName } from '../utils/nameUtils';
import { getSchedule, getGameDateTime } from '../utils/scheduleUtils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const statusColors = {
  upcoming: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  confirmed: 'bg-green-500/20 text-green-400 border-green-500/30',
  in_progress: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  completed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

function formatMs(ms) {
  if (ms <= 0) return 'NOW';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 23) {
    const d = Math.floor(ms / 86400000);
    const rh = Math.floor((ms % 86400000) / 3600000);
    return `${d}d ${String(rh).padStart(2,'0')}h`;
  }
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function getNextPhaseInfo(shoot, now) {
  const schedule = getSchedule(shoot);
  const gameDate = getGameDateTime(shoot);
  const phase = shoot.phase_status || {};

  if (phase.shoot_complete) return { label: 'Complete', ms: null, done: true };

  if (!schedule || !shoot.date) return null;

  const toDate = (t) => {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    const d = new Date(shoot.date + 'T00:00:00');
    d.setHours(h, m, 0, 0);
    return d;
  };

  const candidates = [
    { label: 'Setup', key: 'setup_complete', time: toDate(schedule.setup) },
    { label: 'Pre-Shoot', key: 'pre_shoot_started', time: toDate(schedule.pre_shoot) },
    { label: 'Attention', key: 'attention_started', time: toDate(schedule.attention) },
    { label: 'Sound Check', key: 'sound_started', time: toDate(schedule.sound) },
    { label: 'Game Time', key: 'game_started', time: gameDate },
  ];

  for (const c of candidates) {
    if (phase[c.key]) continue;
    if (!c.time) continue;
    return { label: c.label, ms: c.time - now, time: c.time };
  }

  // All done — show game as reference
  if (gameDate) return { label: 'Game', ms: gameDate - now, time: gameDate };
  return null;
}

function ShootRow({ shoot, allUsers, now, rigSettings = [] }) {
  const phase = getNextPhaseInfo(shoot, now);
  const operators = (shoot.assigned_operators || []).map(e => {
    const u = allUsers.find(u => u.email === e);
    return getDisplayName(u, e);
  });

  const matchedRig = rigSettings.find(r =>
    r.team && shoot.client &&
    r.team.toLowerCase().trim() === shoot.client.toLowerCase().trim()
  );
  const rigType = shoot.rig_type_override || matchedRig?.rig_type || null;

  const countdownColor = phase?.done ? 'text-green-400' :
    phase?.ms != null && phase.ms <= 0 ? 'text-red-400' :
    phase?.ms != null && phase.ms < 30 * 60000 ? 'text-yellow-400' : 'text-blue-300';

  return (
    <div className="grid grid-cols-3 items-center gap-2 px-4 py-3 rounded-xl border border-gray-800 bg-gray-900">
      {/* Left: name + meta */}
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-white text-sm truncate">{shoot.title}</span>
          {rigType && <span className="text-xs text-blue-400 font-medium">{rigType}</span>}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 flex-wrap">
          <span>{format(new Date(shoot.date + 'T12:00:00'), 'EEE, MMM d')}</span>
          {shoot.game_time && <span className="font-mono text-blue-300">{shoot.game_time}</span>}
          {operators.length > 0 ? (
            <span className="text-gray-400">{operators.join(', ')}</span>
          ) : (
            <span className="text-orange-400 italic">Unassigned</span>
          )}
        </div>
      </div>

      {/* Center: big countdown */}
      <div className="flex flex-col items-center justify-center text-center">
        {phase?.done ? (
          <span className="text-sm text-green-400 font-semibold">✓ Complete</span>
        ) : phase?.ms != null ? (
          <>
            <div className={`font-mono font-bold text-2xl tracking-tight ${countdownColor}`}>{formatMs(phase.ms)}</div>
            <div className="text-xs text-gray-500 mt-0.5">until {phase.label}</div>
          </>
        ) : null}
      </div>

      {/* Right: status badge */}
      <div className="flex justify-end">
        <Badge className={`text-xs border ${statusColors[shoot.status] || statusColors.upcoming}`}>
          {shoot.status}
        </Badge>
      </div>
    </div>
  );
}

export default function AdminStandbyShootList({ shoots = [], allUsers = [], userEmail, standbyDays = [], rigSettings = [] }) {
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

  // Filter shoots by the selected standby date (simple date match — Dashboard already filters by standby window)
  const filteredShoots = standbyDates && standbyDates.length > 0
    ? shoots.filter(s => s.date === standbyDates[selectedDateIdx])
    : shoots;

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
      {/* Date selector — only show if we have standby day info */}
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
          No shoots on this standby day.
        </div>
      ) : (
        <div className="space-y-2">
          {pagedShoots.map(shoot => (
            <ShootRow key={shoot.id} shoot={shoot} allUsers={allUsers} userEmail={userEmail} now={now} rigSettings={rigSettings} />
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