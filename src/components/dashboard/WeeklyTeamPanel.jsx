import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, CheckCircle2, Clock, ChevronDown, ChevronUp, UserCheck } from 'lucide-react';
import { getDisplayName } from '../utils/nameUtils';
import { format, addDays } from 'date-fns';

export default function WeeklyTeamPanel({ shoots = [], allUsers = [] }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [approvingId, setApprovingId] = useState(null);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Build 7 day slots
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(new Date(), i);
    return format(d, 'yyyy-MM-dd');
  });

  const weekShoots = shoots.filter(s =>
    s.date >= days[0] && s.date <= days[days.length - 1] && s.status !== 'cancelled'
  );

  const totalPending = weekShoots.reduce((n, s) => n + (s.pending_operators?.length || 0), 0);

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

  return (
    <Card className="bg-gray-900 border-gray-800 mb-6">
      <CardHeader className="border-b border-gray-800 pb-3">
        <div className="flex items-center justify-between">
          <button onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-white font-semibold text-base hover:text-blue-400 transition-colors">
            <CalendarDays className="h-4 w-4 text-blue-400" />
            7-Day Team Schedule
            {expanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
            {totalPending > 0 && (
              <span className="text-xs bg-orange-600/20 text-orange-400 border border-orange-700/40 px-2 py-0.5 rounded-full ml-1">
                {totalPending} pending
              </span>
            )}
          </button>
          <span className="text-xs text-gray-500">{weekShoots.length} shoots</span>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-2">
            {days.map(dateStr => {
              const isToday = dateStr === todayStr;
              const dayShoots = weekShoots
                .filter(s => s.date === dateStr)
                .sort((a, b) => (a.game_time || '').localeCompare(b.game_time || ''));
              const dayPending = dayShoots.reduce((n, s) => n + (s.pending_operators?.length || 0), 0);

              return (
                <div key={dateStr} className={`rounded-xl border p-2.5 min-h-[80px] ${
                  isToday ? 'border-blue-600/50 bg-blue-950/20' :
                  dayPending > 0 ? 'border-orange-700/40 bg-orange-950/10' :
                  dayShoots.length > 0 ? 'border-gray-700/50 bg-gray-800/30' :
                  'border-gray-800/40 bg-gray-900/20'
                }`}>
                  {/* Day header */}
                  <div className="mb-2">
                    <p className={`text-xs font-semibold ${isToday ? 'text-blue-400' : 'text-gray-400'}`}>
                      {isToday ? 'Today' : format(new Date(dateStr + 'T12:00:00'), 'EEE')}
                    </p>
                    <p className={`text-base font-bold leading-tight ${isToday ? 'text-blue-300' : 'text-gray-300'}`}>
                      {format(new Date(dateStr + 'T12:00:00'), 'd MMM')}
                    </p>
                  </div>

                  {dayShoots.length === 0 ? (
                    <p className="text-xs text-gray-700 italic">No shoots</p>
                  ) : (
                    <div className="space-y-2">
                      {dayShoots.map(s => {
                        const assigned = s.assigned_operators || [];
                        const pending = s.pending_operators || [];
                        return (
                          <div key={s.id} className={`rounded-lg border px-2 py-1.5 text-xs ${
                            pending.length > 0 ? 'bg-orange-950/30 border-orange-700/40' : 'bg-gray-800/60 border-gray-700/40'
                          }`}>
                            <div className="font-medium text-white truncate">{s.title || s.client}</div>
                            {s.game_time && <div className="text-gray-500 font-mono">{s.game_time}</div>}

                            {assigned.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-0.5">
                                {assigned.map(email => (
                                  <span key={email} className="flex items-center gap-0.5 text-xs bg-green-900/30 text-green-400 border border-green-700/30 px-1.5 py-0.5 rounded-full">
                                    <CheckCircle2 className="h-2.5 w-2.5" />
                                    {getUserName(email).split(' ')[0]}
                                  </span>
                                ))}
                              </div>
                            )}

                            {assigned.length === 0 && pending.length === 0 && (
                              <p className="text-gray-600 mt-1 italic">Unassigned</p>
                            )}

                            {pending.length > 0 && (
                              <div className="mt-1.5 space-y-1 border-t border-orange-800/20 pt-1.5">
                                {pending.map(email => {
                                  const ak = `${s.id}_${email}`;
                                  const dk = `decline_${s.id}_${email}`;
                                  return (
                                    <div key={email} className="flex items-center justify-between gap-1">
                                      <div className="flex items-center gap-1 min-w-0">
                                        <Clock className="h-3 w-3 text-orange-400 flex-shrink-0" />
                                        <span className="text-orange-200 truncate text-xs">{getUserName(email).split(' ')[0]}</span>
                                      </div>
                                      <div className="flex gap-1 flex-shrink-0">
                                        <Button size="sm" disabled={approvingId === ak} onClick={() => handleApprove(s, email)}
                                          className="h-5 text-xs bg-green-700 hover:bg-green-600 px-1.5 gap-0.5">
                                          <UserCheck className="h-2.5 w-2.5" />
                                          {approvingId === ak ? '…' : '✓'}
                                        </Button>
                                        <Button size="sm" variant="ghost" disabled={approvingId === dk} onClick={() => handleDecline(s, email)}
                                          className="h-5 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 px-1.5">
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
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}