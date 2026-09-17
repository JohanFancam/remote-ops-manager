import React, { useState, useMemo } from 'react';
import { Clock, ChevronLeft, ChevronRight, X, Edit2, Check, XCircle, Trash2 } from 'lucide-react';
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

export default function ShootTimingPanel({ shoots = [], allUsers = [], onUpdate }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedShoot, setSelectedShoot] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const deleteEntry = async (s) => {
    if (!onUpdate) return;
    setSaving(true);
    const newPhaseStatus = { ...s.phase_status };
    delete newPhaseStatus.setup_complete;
    delete newPhaseStatus.shoot_complete;
    await onUpdate(s.id, { phase_status: newPhaseStatus, status: 'upcoming' });
    setSaving(false);
    setConfirmDeleteId(null);
    setSelectedShoot(null);
  };

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

  const getDayTotalMs = (dayShoots) => dayShoots.reduce((sum, s) => sum + s.durationMs, 0);

  const startEdit = (s) => {
    setEditingId(s.id);
    setEditStart(format(s.start, 'HH:mm'));
    setEditEnd(format(s.end, 'HH:mm'));
  };

  const saveEdit = async (s) => {
    if (!onUpdate) return;
    setSaving(true);
    const dateBase = s.date; // yyyy-MM-dd
    const newStart = new Date(`${dateBase}T${editStart}:00`);
    let newEnd = new Date(`${dateBase}T${editEnd}:00`);
    // If end is before start, the shoot crossed midnight — add one day to end
    if (newEnd <= newStart) {
      newEnd = new Date(newEnd.getTime() + 24 * 60 * 60 * 1000);
    }
    await onUpdate(s.id, { phase_status: { ...s.phase_status, setup_complete: newStart.toISOString(), shoot_complete: newEnd.toISOString() } });
    setSaving(false);
    setEditingId(null);
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
        <div className="bg-slate-800/40 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-purple-400">{monthShoots.length}</p>
          <p className="text-xs text-slate-400">This Month</p>
        </div>
        <div className="bg-slate-800/40 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-blue-400">{formatDuration(monthAvg)}</p>
          <p className="text-xs text-slate-400">Avg Duration</p>
        </div>
        <div className="bg-slate-800/40 rounded-lg p-3 text-center">
          <p className="text-xl font-bold text-emerald-400">{formatDuration(avgMs)}</p>
          <p className="text-xs text-slate-400">All-Time Avg</p>
        </div>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-3">
        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-slate-100" onClick={() => { setCurrentMonth(m => subMonths(m, 1)); setSelectedDay(null); }}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold text-slate-100">{format(currentMonth, 'MMMM yyyy')}</span>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-slate-100" onClick={() => { setCurrentMonth(m => addMonths(m, 1)); setSelectedDay(null); }}>
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
              className={`min-h-[88px] p-1.5 rounded-lg border transition-all ${
                isSelected ? 'border-purple-500 bg-purple-950/40' :
                hasShoots ? 'border-slate-800 hover:border-gray-500 cursor-pointer hover:bg-slate-800/40' :
                'border-slate-800/40'
              } ${today ? 'ring-1 ring-blue-500' : ''}`}
            >
              <div className={`text-xs mb-1.5 font-medium ${today ? 'text-blue-400' : 'text-slate-500'}`}>
                {format(day, 'd')}
              </div>
              <div className="space-y-0.5">
                {dayShoots.length > 0 && (
                  <div className="text-xs font-bold text-purple-300 px-1">{formatDuration(getDayTotalMs(dayShoots))}</div>
                )}
                {dayShoots.length > 0 && <div className="text-xs text-slate-500 px-1">{dayShoots.length} shoot{dayShoots.length !== 1 ? 's' : ''}</div>}
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
            <span className="text-slate-400">{l.label}</span>
          </div>
        ))}
      </div>

      {/* Selected day shoot list */}
      {selectedDay && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-slate-100">{format(selectedDay, 'EEE, MMM d')}</p>
            <button onClick={() => setSelectedDay(null)} className="text-slate-500 hover:text-slate-300">
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* Day total */}
          <div className="mb-3 bg-purple-900/20 border border-purple-800/30 rounded-lg px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-purple-300">Total hours this day</span>
            <span className="text-sm font-bold text-purple-200">{formatDuration(getDayTotalMs(selectedDayShoots))}</span>
          </div>
          <div className="space-y-2">
            {selectedDayShoots.map(s => (
              <div key={s.id} className="bg-slate-800/60 rounded-lg px-4 py-3">
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setSelectedShoot(selectedShoot?.id === s.id ? null : s)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-100 truncate">{shortenTitle(s.title)}</p>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      {format(s.start, 'HH:mm')} → {format(s.end, 'HH:mm')}
                    </p>
                  </div>
                  <div className={`ml-3 px-2.5 py-1 rounded-lg text-slate-100 text-sm font-bold ${getDurationColor(s.durationMs)}`}>
                    {formatDuration(s.durationMs)}
                  </div>
                </div>
                {/* Expanded detail */}
                {selectedShoot?.id === s.id && (
                  <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
                    {editingId === s.id ? (
                      <div className="space-y-2">
                        <p className="text-xs text-slate-400 font-medium">Edit Setup & Complete Times</p>
                        <div className="flex gap-3 items-center">
                          <div className="flex-1">
                            <label className="text-xs text-slate-500 block mb-1">Setup Start</label>
                            <input
                              type="time"
                              value={editStart}
                              onChange={e => setEditStart(e.target.value)}
                              className="w-full bg-slate-700 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-100 font-mono"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-xs text-slate-500 block mb-1">Shoot End</label>
                            <input
                              type="time"
                              value={editEnd}
                              onChange={e => setEditEnd(e.target.value)}
                              className="w-full bg-slate-700 border border-slate-700 rounded px-2 py-1.5 text-sm text-slate-100 font-mono"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => saveEdit(s)}
                            disabled={saving}
                            className="flex items-center gap-1 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white text-xs rounded font-medium disabled:opacity-50"
                          >
                            <Check className="h-3 w-3" /> Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-gray-600 text-slate-100 text-xs rounded"
                          >
                            <XCircle className="h-3 w-3" /> Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {s.game_time && (
                          <div className="flex gap-2 text-xs">
                            <span className="text-slate-500 w-20">Game Time</span>
                            <span className="text-slate-400 font-mono">{s.game_time}</span>
                          </div>
                        )}
                        {s.location && (
                          <div className="flex gap-2 text-xs">
                            <span className="text-slate-500 w-20">Location</span>
                            <span className="text-slate-400">{s.location}</span>
                          </div>
                        )}
                        <div className="flex gap-2 text-xs">
                          <span className="text-slate-500 w-20">Setup</span>
                          <span className="text-slate-400 font-mono">{format(s.start, 'HH:mm')}</span>
                        </div>
                        <div className="flex gap-2 text-xs">
                          <span className="text-slate-500 w-20">Complete</span>
                          <span className="text-slate-400 font-mono">{format(s.end, 'HH:mm')}</span>
                        </div>
                        {s.assigned_operators?.length > 0 && (
                          <div className="flex gap-2 text-xs">
                            <span className="text-slate-500 w-20 flex-shrink-0">Operators</span>
                            <div className="flex flex-col gap-0.5">
                              {s.assigned_operators.map(email => {
                                const u = allUsers.find(u2 => u2.email === email);
                                return <span key={email} className="text-slate-400">{getDisplayName(u, email)}</span>;
                              })}
                            </div>
                          </div>
                        )}
                        {onUpdate && (
                          <div className="flex items-center gap-3 pt-1">
                            <button
                              onClick={() => startEdit(s)}
                              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-400"
                            >
                              <Edit2 className="h-3 w-3" /> Edit timing
                            </button>
                            {confirmDeleteId === s.id ? (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-red-400">Delete entry?</span>
                                <button
                                  onClick={() => deleteEntry(s)}
                                  disabled={saving}
                                  className="text-xs px-2 py-0.5 bg-red-700 hover:bg-red-600 text-white rounded disabled:opacity-50"
                                >Yes</button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="text-xs px-2 py-0.5 bg-slate-700 hover:bg-gray-600 text-slate-100 rounded"
                                >No</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(s.id)}
                                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-400"
                              >
                                <Trash2 className="h-3 w-3" /> Delete
                              </button>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {timedShoots.length === 0 && (
        <div className="text-center py-10">
          <Clock className="h-10 w-10 text-gray-700 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">No completed shoots with timing data yet.</p>
          <p className="text-xs text-gray-600 mt-1">Timing is captured from "Setup Complete" → "Shoot Complete".</p>
        </div>
      )}
    </div>
  );
}