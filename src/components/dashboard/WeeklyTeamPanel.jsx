import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, CheckCircle2, Clock, ChevronDown, ChevronUp, UserCheck } from 'lucide-react';
import { format, addDays } from 'date-fns';

export default function WeeklyTeamPanel({ shoots = [], allUsers = [] }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [approvingId, setApprovingId] = useState(null);

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const endStr = format(addDays(new Date(), 7), 'yyyy-MM-dd');

  const weekShoots = shoots
    .filter(s => s.date >= todayStr && s.date <= endStr && s.status !== 'cancelled')
    .sort((a, b) => a.date.localeCompare(b.date) || (a.game_time || '').localeCompare(b.game_time || ''));

  const totalPending = weekShoots.reduce((n, s) => n + (s.pending_operators?.length || 0), 0);

  const handleApprove = async (shoot, email) => {
    setApprovingId(`${shoot.id}_${email}`);
    const newAssigned = [...new Set([...(shoot.assigned_operators || []), email])];
    const newPending = (shoot.pending_operators || []).filter(e => e !== email);
    await base44.entities.Shoot.update(shoot.id, {
      assigned_operators: newAssigned,
      pending_operators: newPending,
    });
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

  const getUserName = (email) => {
    const u = allUsers.find(u => u.email === email);
    return (u?.full_name && u.full_name.trim()) ? u.full_name : email;
  };

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
        <CardContent className="pt-3 pb-4">
          {weekShoots.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No shoots in the next 7 days.</p>
          ) : (
            <div className="space-y-2">
              {weekShoots.map(s => {
                const assigned = s.assigned_operators || [];
                const pending = s.pending_operators || [];
                const hasPending = pending.length > 0;
                const isToday = s.date === todayStr;

                return (
                  <div key={s.id} className={`rounded-lg border px-3 py-2.5 ${hasPending ? 'bg-orange-950/20 border-orange-800/30' : 'bg-gray-800/40 border-gray-700/40'}`}>
                    {/* Header row */}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${isToday ? 'bg-blue-600/20 text-blue-400' : 'bg-gray-700/50 text-gray-400'}`}>
                          {isToday ? 'Today' : format(new Date(s.date + 'T12:00:00'), 'EEE d/M')}
                        </span>
                        {s.game_time && <span className="text-xs text-gray-500 font-mono">{s.game_time}</span>}
                        <span className="text-sm font-medium text-white">{s.title || s.client}</span>
                      </div>
                      {hasPending && (
                        <span className="text-xs text-orange-400 font-medium">{pending.length} request{pending.length > 1 ? 's' : ''}</span>
                      )}
                    </div>

                    {/* Assigned operators */}
                    {assigned.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {assigned.map(email => (
                          <span key={email} className="flex items-center gap-1 text-xs bg-green-900/30 text-green-400 border border-green-700/30 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="h-3 w-3" /> {getUserName(email)}
                          </span>
                        ))}
                      </div>
                    )}

                    {assigned.length === 0 && !hasPending && (
                      <p className="text-xs text-gray-600 mt-1">No operators assigned</p>
                    )}

                    {/* Pending approvals */}
                    {hasPending && (
                      <div className="mt-2 space-y-1.5 border-t border-orange-800/20 pt-2">
                        {pending.map(email => {
                          const approveKey = `${s.id}_${email}`;
                          const declineKey = `decline_${s.id}_${email}`;
                          return (
                            <div key={email} className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                <Clock className="h-3.5 w-3.5 text-orange-400 flex-shrink-0" />
                                <span className="text-sm text-orange-200">{getUserName(email)}</span>
                                <span className="text-xs text-gray-600">{email}</span>
                              </div>
                              <div className="flex gap-1.5 flex-shrink-0">
                                <Button size="sm"
                                  disabled={approvingId === approveKey}
                                  onClick={() => handleApprove(s, email)}
                                  className="h-6 text-xs bg-green-700 hover:bg-green-600 gap-1 px-2">
                                  <UserCheck className="h-3 w-3" />
                                  {approvingId === approveKey ? '...' : 'Approve'}
                                </Button>
                                <Button size="sm" variant="ghost"
                                  disabled={approvingId === declineKey}
                                  onClick={() => handleDecline(s, email)}
                                  className="h-6 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 px-2">
                                  {approvingId === declineKey ? '...' : 'Decline'}
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
        </CardContent>
      )}
    </Card>
  );
}