import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { CalendarDays, CheckCircle2, Clock, ChevronLeft, ChevronRight, UserCheck, X } from 'lucide-react';
import { getDisplayName } from '../utils/nameUtils';
import {
  format, addMonths, subMonths,
  startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth
} from 'date-fns';

function getCalendarGrid(month) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
}

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function WeeklyTeamPanel({ shoots = [], allUsers = [] }) {
  const queryClient = useQueryClient();
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [approvingId, setApprovingId] = useState(null);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const calDays = getCalendarGrid(calMonth);
  const gridStart = format(calDays[0], 'yyyy-MM-dd');
  const gridEnd = format(calDays[calDays.length - 1], 'yyyy-MM-dd');

  const visibleShoots = shoots.filter(s =>
    s.date >= gridStart && s.date <= gridEnd && s.status !== 'cancelled'
  );

  const getShootsForDay = (dateStr) =>
    visibleShoots.filter(s => s.date === dateStr)
      .sort((a, b) => (a.game_time || '').localeCompare(b.game_time || ''));

  const monthShootCount = shoots.filter(s =>
    s.date?.startsWith(format(calMonth, 'yyyy-MM')) && s.status !== 'cancelled'
  ).length;

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

  const selectedShoots = selectedDay ? getShootsForDay(selectedDay) : [];

  return (
    <div>
      {/* Month header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-blue-400" />
          <span className="text-white font-semibold">{format(calMonth, 'MMMM yyyy')}</span>
          <span className="text-xs bg-blue-600/20 text-blue-400 border border-blue-700/40 px-2 py-0.5 rounded-full">
            {monthShootCount} shoots
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white"
            onClick={() => { setCalMonth(subMonths(calMonth, 1)); setSelectedDay(null); }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white"
            onClick={() => { setCalMonth(addMonths(calMonth, 1)); setSelectedDay(null); }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
        {DOW.map(d => <div key={d} className="text-xs text-gray-500 py-1">{d}</div>)}
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
            <button
              key={dateStr}
              onClick={() => inMonth && setSelectedDay(isSelected ? null : dateStr)}
              className={`rounded-md p-1 min-h-[52px] text-left transition-all
                ${!inMonth ? 'opacity-25 cursor-default' : 'cursor-pointer hover:ring-1 hover:ring-gray-500'}
                ${isSelected ? 'ring-2 ring-blue-400' : ''}
                ${isToday ? 'ring-1 ring-blue-500' : ''}`}
              style={{ background: bg }}
            >
              <span className={`text-xs font-medium block ${isToday ? 'text-blue-400 font-bold' : dayShoots.length > 0 ? 'text-blue-300' : 'text-gray-500'}`}>
                {format(day, 'd')}
              </span>
              {inMonth && dayShoots.length > 0 && (
                <div className="mt-0.5 space-y-0.5">
                  {dayShoots.slice(0, 2).map(s => (
                    <div key={s.id} className={`text-xs truncate leading-tight rounded px-0.5 ${
                      (s.pending_operators?.length || 0) > 0 ? 'text-orange-300' : 'text-blue-300'
                    }`}>
                      {s.title?.split(' vs ')[0] || s.client || '•'}
                    </div>
                  ))}
                  {dayShoots.length > 2 && <div className="text-xs text-gray-500">+{dayShoots.length - 2}</div>}
                </div>
              )}
              {isToday && <div className="w-1 h-1 rounded-full bg-blue-400 mt-0.5 mx-auto" />}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="w-3 h-3 rounded inline-block" style={{ background: 'rgba(30,58,138,0.4)' }} /> Has Shoots
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="w-3 h-3 rounded inline-block" style={{ background: 'rgba(120,53,15,0.5)' }} /> Pending Approval
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-400 italic">Click a day to expand</span>
      </div>

      {/* Day detail */}
      {selectedDay && (
        <div className="bg-gray-800/60 border border-blue-700/40 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-white">
              {format(new Date(selectedDay + 'T12:00:00'), 'EEEE, MMMM d yyyy')}
            </p>
            <button onClick={() => setSelectedDay(null)} className="text-gray-500 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>

          {selectedShoots.length === 0 ? (
            <p className="text-xs text-gray-500">No shoots scheduled for this day.</p>
          ) : (
            <div className="space-y-3">
              {selectedShoots.map(s => {
                const assigned = s.assigned_operators || [];
                const pending = s.pending_operators || [];
                return (
                  <div key={s.id} className={`rounded-lg border px-3 py-2.5 ${
                    pending.length > 0 ? 'bg-orange-950/30 border-orange-700/40' : 'bg-gray-800/60 border-gray-700/40'
                  }`}>
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div>
                        <p className="text-sm font-medium text-white">{s.title || s.client}</p>
                        {s.game_time && <p className="text-xs text-gray-500 font-mono">{s.game_time}</p>}
                      </div>
                      {s.location && <span className="text-xs text-gray-500 text-right">{s.location}</span>}
                    </div>

                    {assigned.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        {assigned.map(email => (
                          <span key={email} className="flex items-center gap-0.5 text-xs bg-green-900/30 text-green-400 border border-green-700/30 px-2 py-0.5 rounded-full">
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
                        <p className="text-xs text-orange-400 font-medium mb-1">Pending approval:</p>
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
                                  <UserCheck className="h-3 w-3" />
                                  {approvingId === ak ? '…' : '✓'}
                                </Button>
                                <Button size="sm" variant="ghost" disabled={approvingId === dk} onClick={() => handleDecline(s, email)}
                                  className="h-6 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 px-2">
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
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}