import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { CalendarDays, CheckCircle2, Clock, ChevronLeft, ChevronRight, UserCheck, X, Calendar, List } from 'lucide-react';
import { getDisplayName } from '../utils/nameUtils';
import {
  format, addDays,
  startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth
} from 'date-fns';

function get7Days(startDateStr) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    days.push(format(addDays(new Date(startDateStr + 'T12:00:00'), i), 'yyyy-MM-dd'));
  }
  return days;
}

const DOW_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function WeeklyTeamPanel({ shoots = [], allUsers = [] }) {
  const queryClient = useQueryClient();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [approvingId, setApprovingId] = useState(null);

  // View mode: '7day' or 'month'
  const [viewMode, setViewMode] = useState('7day');

  // 7-day view state
  const getWeekStart = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    const dow = d.getDay();
    return format(addDays(d, -dow), 'yyyy-MM-dd');
  };
  const [weekStart, setWeekStart] = useState(() => getWeekStart(todayStr));

  // Month view state
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  const handleApprove = async (shoot, email) => {
    setApprovingId(`${shoot.id}_${email}`);
    const newAssigned = [...new Set([...(shoot.assigned_operators || []), email])];
    const newPending = (shoot.pending_operators || []).filter(e => e !== email);
    await base44.entities.Shoot.update(shoot.id, { assigned_operators: newAssigned, pending_operators: newPending });
    queryClient.invalidateQueries({ queryKey: ['shoots'] });
    setApprovingId(null);
  };

  const handleDecline = async (shoot, email) => {
    setApprovingId(`decline_${shoot.id}_${email}`);
    const newPending = (shoot.pending_operators || []).filter(e => e !== email);
    await base44.entities.Shoot.update(shoot.id, { pending_operators: newPending });
    queryClient.invalidateQueries({ queryKey: ['shoots'] });
    setApprovingId(null);
  };

  const getUserName = (email) => getDisplayName(allUsers.find(u => u.email === email), email);

  const getShootsForDay = (dateStr) =>
    shoots.filter(s => s.date === dateStr && s.status !== 'cancelled')
      .sort((a, b) => (a.game_time || '').localeCompare(b.game_time || ''));

  // ── 7-day helpers ─────────────────────────────────────────────────────────
  const days7 = get7Days(weekStart);
  const weekEndStr = days7[6];
  const weekLabel = (() => {
    const s = new Date(weekStart + 'T12:00:00');
    const e = new Date(weekEndStr + 'T12:00:00');
    if (format(s, 'MMM') === format(e, 'MMM')) return `${format(s, 'MMM d')} – ${format(e, 'd, yyyy')}`;
    return `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')}`;
  })();



  // ── Month view helpers ─────────────────────────────────────────────────────
  const monthStart = startOfMonth(calMonth);
  const monthEnd = endOfMonth(calMonth);
  const calDays = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 0 }),
    end: endOfWeek(monthEnd, { weekStartsOn: 0 })
  });
  const monthShootCount = shoots.filter(s =>
    s.date?.startsWith(format(calMonth, 'yyyy-MM')) && s.status !== 'cancelled'
  ).length;
  const selectedShoots = selectedDay ? getShootsForDay(selectedDay) : [];

  // ── ShootCard ─────────────────────────────────────────────────────────────
  const ShootCard = ({ s }) => {
    const assigned = s.assigned_operators || [];
    const pending = s.pending_operators || [];
    return (
      <div className={`rounded-lg border px-3 py-2.5 ${pending.length > 0 ? 'bg-orange-950/30 border-orange-700/40' : 'bg-zinc-100/60 border-zinc-200/40'}`}>
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-zinc-900 leading-tight truncate">{s.title || s.client}</p>
            {s.game_time && <p className="text-xs text-zinc-400 font-mono">{s.game_time}</p>}
          </div>
        </div>
        {assigned.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {assigned.map(email => (
              <span key={email} className="flex items-center gap-0.5 text-xs bg-green-900/30 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                <CheckCircle2 className="h-2.5 w-2.5" />
                {getUserName(email).split(' ')[0]}
              </span>
            ))}
          </div>
        )}
        {assigned.length === 0 && pending.length === 0 && (
          <p className="text-xs text-gray-600 italic">Unassigned</p>
        )}
        {pending.length > 0 && (
          <div className="mt-1.5 space-y-1 border-t border-orange-800/20 pt-1.5">
            <p className="text-xs text-orange-400 font-medium mb-1">Pending:</p>
            {pending.map(email => {
              const ak = `${s.id}_${email}`;
              const dk = `decline_${s.id}_${email}`;
              return (
                <div key={email} className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1 min-w-0">
                    <Clock className="h-3 w-3 text-orange-400 flex-shrink-0" />
                    <span className="text-orange-200 truncate text-xs">{getUserName(email)}</span>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button size="sm" disabled={approvingId === ak} onClick={() => handleApprove(s, email)}
                      className="h-6 text-xs bg-green-700 hover:bg-green-600 px-2 gap-0.5">
                      <UserCheck className="h-3 w-3" />{approvingId === ak ? '…' : '✓'}
                    </Button>
                    <Button size="sm" variant="ghost" disabled={approvingId === dk} onClick={() => handleDecline(s, email)}
                      className="h-6 text-xs text-red-600 hover:text-red-700 hover:bg-red-950/30 px-2">
                      {approvingId === dk ? '…' : '✕'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* View toggle + navigation */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="flex bg-zinc-100 rounded-lg p-0.5">
            <button onClick={() => setViewMode('7day')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === '7day' ? 'bg-teal-700 text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>
              <List className="h-3.5 w-3.5" /> 7-Day
            </button>
            <button onClick={() => setViewMode('month')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'month' ? 'bg-teal-700 text-white' : 'text-zinc-500 hover:text-zinc-900'}`}>
              <CalendarDays className="h-3.5 w-3.5" /> Month
            </button>
          </div>
          {viewMode === '7day' && (
            <span className="text-sm font-semibold text-zinc-900">{weekLabel}</span>
          )}
          {viewMode === 'month' && (
            <div className="flex items-center gap-2">
              <span className="text-zinc-900 font-semibold">{format(calMonth, 'MMMM yyyy')}</span>
              <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full">{monthShootCount} shoots</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">

          <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-zinc-900"
            onClick={() => {
              if (viewMode === '7day') setWeekStart(format(addDays(new Date(weekStart + 'T12:00:00'), -7), 'yyyy-MM-dd'));
              else { setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1)); setSelectedDay(null); }
            }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-zinc-900"
            onClick={() => {
              if (viewMode === '7day') setWeekStart(format(addDays(new Date(weekStart + 'T12:00:00'), 7), 'yyyy-MM-dd'));
              else { setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1)); setSelectedDay(null); }
            }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>



      {/* 7-DAY TILE VIEW */}
      {viewMode === '7day' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {days7.map(dateStr => {
            const dayShoots = getShootsForDay(dateStr);
            const isToday = dateStr === todayStr;
            const isPast = dateStr < todayStr;
            const hasPending = dayShoots.some(s => (s.pending_operators?.length || 0) > 0);

            return (
              <div key={dateStr} className={`rounded-xl border flex flex-col ${
                isToday ? 'border-teal-700/60 bg-teal-50' :
                isPast ? 'border-zinc-200 bg-white/30 opacity-70' :
                hasPending ? 'border-orange-800/50 bg-orange-950/10' :
                dayShoots.length > 0 ? 'border-blue-800/40 bg-teal-50' :
                'border-zinc-200 bg-white/20'
              }`}>
                {/* Day header */}
                <div className={`flex items-center justify-between px-3 py-2.5 border-b rounded-t-xl ${
                  isToday ? 'border-teal-200 bg-teal-50' : 'border-zinc-200'
                }`}>
                  <div>
                    <p className={`text-sm font-bold ${isToday ? 'text-teal-700' : isPast ? 'text-gray-600' : 'text-zinc-900'}`}>
                      {format(new Date(dateStr + 'T12:00:00'), 'EEE, MMM d')}
                      {isToday && <span className="ml-1.5 text-xs bg-teal-700 text-white px-1.5 py-0.5 rounded-full">Today</span>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {hasPending && (
                      <span className="text-xs bg-orange-700/30 text-orange-400 px-1.5 py-0.5 rounded-full">!</span>
                    )}
                    {dayShoots.length > 0 && (
                      <span className="text-xs bg-zinc-200/50 text-zinc-500 px-1.5 py-0.5 rounded-full">{dayShoots.length}</span>
                    )}
                  </div>
                </div>

                {/* Shoots */}
                <div className="flex-1 p-2 space-y-1.5">
                  {dayShoots.length === 0 ? (
                    <p className="text-xs text-gray-700 italic text-center py-3">No shoots</p>
                  ) : (
                    dayShoots.map(s => <ShootCard key={s.id} s={s} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MONTH VIEW */}
      {viewMode === 'month' && (
        <div>
          {/* Legend */}
          <div className="flex items-center gap-4 mb-3 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="w-3 h-3 rounded inline-block" style={{ background: 'rgba(30,58,138,0.4)' }} /> Has Shoots
            </span>
            <span className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="w-3 h-3 rounded inline-block" style={{ background: 'rgba(120,53,15,0.5)' }} /> Pending Approval
            </span>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
            {DOW_SHORT.map(d => <div key={d} className="text-xs text-zinc-400 py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5 mb-4">
            {calDays.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const inMonth = isSameMonth(day, calMonth);
              const isToday = dateStr === todayStr;
              const dayShoots = getShootsForDay(dateStr);
              const hasPending = dayShoots.some(s => (s.pending_operators?.length || 0) > 0);
              const isSelected = selectedDay === dateStr;

              let bg = inMonth ? 'rgba(31,41,55,0.6)' : 'rgba(17,24,39,0.3)';
              if (dayShoots.length > 0) bg = 'rgba(30,58,138,0.3)';
              if (hasPending) bg = 'rgba(120,53,15,0.4)';

              return (
                <button key={dateStr}
                  onClick={() => inMonth && setSelectedDay(isSelected ? null : dateStr)}
                  className={`rounded-md p-1 min-h-[52px] text-left transition-all
                    ${!inMonth ? 'opacity-25 cursor-default' : 'cursor-pointer hover:ring-1 hover:ring-gray-500'}
                    ${isSelected ? 'ring-2 ring-blue-400' : ''}
                    ${isToday ? 'ring-1 ring-blue-500' : ''}`}
                  style={{ background: bg }}>
                  <span className={`text-xs font-medium block ${isToday ? 'text-teal-700 font-bold' : dayShoots.length > 0 ? 'text-teal-700' : 'text-zinc-400'}`}>
                    {format(day, 'd')}
                  </span>
                  {inMonth && dayShoots.length > 0 && (
                    <div className="mt-0.5 space-y-0.5">
                      {dayShoots.slice(0, 2).map(s => (
                        <div key={s.id} className={`text-xs truncate leading-tight rounded px-0.5 ${(s.pending_operators?.length || 0) > 0 ? 'text-orange-300' : 'text-teal-700'}`}>
                          {s.title?.split(' vs ')[0] || s.client || '•'}
                        </div>
                      ))}
                      {dayShoots.length > 2 && <div className="text-xs text-zinc-400">+{dayShoots.length - 2}</div>}
                    </div>
                  )}
                  {isToday && <div className="w-1 h-1 rounded-full bg-teal-600 mt-0.5 mx-auto" />}
                </button>
              );
            })}
          </div>

          {/* Selected day detail */}
          {selectedDay && (
            <div className="bg-zinc-100/60 border border-teal-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-zinc-900">
                  {format(new Date(selectedDay + 'T12:00:00'), 'EEEE, MMMM d yyyy')}
                </p>
                <button onClick={() => setSelectedDay(null)} className="text-zinc-400 hover:text-zinc-900">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {selectedShoots.length === 0 ? (
                <p className="text-xs text-zinc-400">No shoots scheduled for this day.</p>
              ) : (
                <div className="space-y-3">
                  {selectedShoots.map(s => <ShootCard key={s.id} s={s} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}