import React, { useState, useMemo } from 'react';
import { Clock, ChevronLeft, ChevronRight, X, Users } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday } from 'date-fns';
import { shortenTitle } from '../utils/scheduleUtils';
import { getDisplayName } from '../utils/nameUtils';

function formatDuration(ms) {
  if (!ms || ms < 0) return '—';
  const totalMins = Math.round(ms / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function getDurationColor(ms) {
  const mins = ms / 60000;
  if (mins < 90) return 'bg-green-600';
  if (mins < 180) return 'bg-blue-600';
  if (mins < 300) return 'bg-yellow-600';
  return 'bg-orange-600';
}

export default function ShootTimingPanel({ shoots = [], allUsers = [] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedShoot, setSelectedShoot] = useState(null);

  const timedShoots = useMemo(() => {
    return shoots
      .filter(s =>
        s.phase_status?.setup_complete &&
        s.phase_status?.shoot_complete
      )
      .map(s => {
        const start = new Date(s.phase_status.setup_complete);
        const end = new Date(s.phase_status.shoot_complete);
        const durationMs = end - start;
        return { ...s, durationMs, start, end };
      });
  }, [shoots]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = monthStart.getDay();

  const getShootsForDay = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return timedShoots.filter(s => s.date === dateStr);
  };

  const selectedDayShoots = selectedDay ? getShootsForDay(selectedDay) : [];

  const avgMs = timedShoots.length > 0
    ? timedShoots.reduce((sum, s) => sum + s.durationMs, 0) / timedShoots.length
    : 0;

  const monthStr = format(currentMonth, 'yyyy-MM');
  const monthShoots = timedShoots.filter(s => s.date?.startsWith(monthStr));
  const monthAvg = monthShoots.length > 0
    ? monthShoots.reduce((sum, s) => sum + s.durationMs, 0) / monthShoots.length
    : 0;

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-purple-400">{monthShoots.length}</p>
          <p className="text-xs text-gray-400">This Month</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-blue-400">{formatDuration(monthAvg)}</p>
          <p className="text-xs text-gray-400">Avg Duration</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-green-400">{formatDuration(avgMs)}</p>
          <p className="text-xs text-gray-400">All-Time Avg</p>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-white" onClick={() => { setCurrentMonth(m => subMonths(m, 1)); setSelectedDay(null); }}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold text-white">{format(currentMonth, 'MMMM yyyy')}</span>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-gray-400 hover:text-white" onClick={() => { setCurrentMonth(m => addMonths(m, 1)); setSelectedDay(null); }}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-center text-xs text-gray-600 py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 mb-4">
        {Array(startPadding).fill(null).map((_, i) => <div key={`p${i}`} />)}
        {calendarDays.map(day => {
          const dayShoots = getShootsForDay(day);
          const isSelected = selectedDay && isSameDay(day, selectedDay);
          const today = isToday(day);
          const hasShoots = dayShoots.length > 0;
          return (
            <div
              key={day.toISOString()}
              onClick={() => hasShoots ? setSelectedDay(isSameDay(day, selectedDay) ? null : day) : null}
              className={`min-h-[56px] p-1 rounded-lg border transition-all ${
                isSelected ? 'border-purple-500 bg-purple-950/40' :
                hasShoots ? 'border-gray-700 hover:border-gray-500 cursor-pointer hover:bg-gray-800/40' :
                'border-gray-800/40'
              } ${today ? 'ring-1 ring-blue-500' : ''}`}
            >
              <div className={`text-xs mb-1 font-medium ${today ? 'text-blue-400' : 'text-gray-500'}`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayShoots.slice(0, 2).map(s => (
                  <div
                    key={s.id}
                    className={`text-white text-xs px-1 py-0.5 rounded truncate ${getDurationColor(s.durationMs)}`}
                    title={`${shortenTitle(s.title)}: ${formatDuration(s.durationMs)}`}
                  >
                    {formatDuration(s.durationMs)}
                  </div>
                ))}
                {dayShoots.length > 2 && (
                  <div className="text-xs text-gray-500">+{dayShoots.length - 2}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mb-4 text-xs">
        {[
          { color: 'bg-green-600', label: '< 1.5h' },
          { color: 'bg-blue-600', label: '1.5–3h' },
          { color: 'bg-yellow-600', label: '3–5h' },
          { color: 'bg-orange-600', label: '5h+' },
        ].map(l => (
          <div key={l.label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${l.color}`} />
            <span className="text-gray-400">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Selected day shoot list */}
      {selectedDay && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-white">{format(selectedDay, 'EEE, MMM d')}</p>
            <button onClick={() => setSelectedDay(null)} className="text-gray-500 hover:text-gray-300">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="space-y-2">
            {selectedDayShoots.map(s => (
              <button
                key={s.id}
                onClick={() => setSelectedShoot(selectedShoot?.id === s.id ? null : s)}
                className="w-full text-left bg-gray-800/60 rounded-lg px-4 py-3 hover:bg-gray-800 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{shortenTitle(s.title)}</p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">
                      {format(s.start, 'HH:mm')} → {format(s.end, 'HH:mm')}
                    </p>
                  </div>
                  <div className={`ml-3 px-2.5 py-1 rounded-lg text-white text-sm font-bold ${getDurationColor(s.durationMs)}`}>
                    {formatDuration(s.durationMs)}
                  </div>
                </div>
                {/* Expanded detail */}
                {selectedShoot?.id === s.id && (
                  <div className="mt-3 pt-3 border-t border-gray-700 space-y-2" onClick={e => e.stopPropagation()}>
                    {s.game_time && (
                      <div className="flex gap-2 text-xs">
                        <span className="text-gray-500 w-20">Game Time</span>
                        <span className="text-gray-300 font-mono">{s.game_time}</span>
                      </div>
                    )}
                    {s.location && (
                      <div className="flex gap-2 text-xs">
                        <span className="text-gray-500 w-20">Location</span>
                        <span className="text-gray-300">{s.location}</span>
                      </div>
                    )}
                    <div className="flex gap-2 text-xs">
                      <span className="text-gray-500 w-20">Setup</span>
                      <span className="text-gray-300 font-mono">{format(s.start, 'HH:mm')}</span>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <span className="text-gray-500 w-20">Complete</span>
                      <span className="text-gray-300 font-mono">{format(s.end, 'HH:mm')}</span>
                    </div>
                    {s.assigned_operators?.length > 0 && (
                      <div className="flex gap-2 text-xs">
                        <span className="text-gray-500 w-20 flex-shrink-0">Operators</span>
                        <div className="flex flex-col gap-0.5">
                          {s.assigned_operators.map(email => {
                            const u = allUsers.find(u2 => u2.email === email);
                            return (
                              <span key={email} className="text-gray-300">
                                {getDisplayName(u, email)}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {timedShoots.length === 0 && (
        <div className="text-center py-10">
          <Clock className="h-10 w-10 text-gray-700 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">No completed shoots with timing data yet.</p>
          <p className="text-xs text-gray-600 mt-1">Timing is captured from "Setup Complete" → "Shoot Complete".</p>
        </div>
      )}
    </div>
  );
}