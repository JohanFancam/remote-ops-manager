import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, Plus, X, ArrowLeftRight, ChevronDown, ChevronUp } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addMonths, subMonths } from 'date-fns';

export default function StandbyManager({ user, allUsers = [] }) {
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [expanded, setExpanded] = useState(false);
  const [addingDate, setAddingDate] = useState(null);
  const [swapping, setSwapping] = useState(null); // standbyDay id being swapped

  const monthStr = format(currentMonth, 'yyyy-MM');
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const { data: standbyDays = [] } = useQuery({
    queryKey: ['standbyDays'],
    queryFn: () => base44.entities.StandbyDay.list('-date', 500),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['standbyDays'] });

  const monthStandbys = standbyDays.filter(s => s.date?.startsWith(monthStr));

  const getStandbyForDay = (dateStr) => monthStandbys.find(s => s.date === dateStr);

  const handleClaim = async (dateStr) => {
    const existing = getStandbyForDay(dateStr);
    if (existing) return;
    await base44.entities.StandbyDay.create({
      date: dateStr,
      admin_email: user.email,
      admin_name: user.full_name || user.email,
    });
    refresh();
    setAddingDate(null);
  };

  const handleRemove = async (id) => {
    await base44.entities.StandbyDay.delete(id);
    refresh();
  };

  const handleSwap = async (standbyId, newEmail) => {
    const newUser = allUsers.find(u => u.email === newEmail);
    await base44.entities.StandbyDay.update(standbyId, {
      admin_email: newEmail,
      admin_name: newUser?.full_name || newEmail,
      swapped_from: user.email,
    });
    refresh();
    setSwapping(null);
  };

  const adminUsers = allUsers.filter(u => u.role === 'admin');
  const myDays = monthStandbys.filter(s => s.admin_email === user.email).length;

  return (
    <Card className="bg-gray-900 border-gray-800 mb-6">
      <CardHeader className="border-b border-gray-800 pb-3">
        <div className="flex items-center justify-between">
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 text-white font-semibold text-base hover:text-blue-400 transition-colors">
            <Phone className="h-4 w-4 text-yellow-400" />
            Standby Schedule
            {expanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
            <span className="text-xs bg-yellow-600/20 text-yellow-400 border border-yellow-700/40 px-2 py-0.5 rounded-full ml-1">
              {myDays} day{myDays !== 1 ? 's' : ''} this month
            </span>
          </button>
          {expanded && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                {'<'}
              </Button>
              <span className="text-sm text-gray-300 font-medium">{format(currentMonth, 'MMM yyyy')}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                {'>'}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-4">
          <div className="space-y-1.5">
            {days.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const isPast = dateStr < todayStr;
              const standby = getStandbyForDay(dateStr);
              const isMe = standby?.admin_email === user.email;
              const dayLabel = format(day, 'EEE, MMM d');

              return (
                <div key={dateStr} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${
                  isMe ? 'bg-yellow-950/30 border border-yellow-800/40' :
                  standby ? 'bg-gray-800/50 border border-gray-700/50' :
                  'border border-transparent'
                } ${isPast ? 'opacity-50' : ''}`}>
                  <span className={`text-xs w-28 flex-shrink-0 font-mono ${isMe ? 'text-yellow-300' : 'text-gray-400'}`}>{dayLabel}</span>

                  {standby ? (
                    <div className="flex-1 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Phone className={`h-3 w-3 flex-shrink-0 ${isMe ? 'text-yellow-400' : 'text-gray-500'}`} />
                        <span className={`text-sm ${isMe ? 'text-yellow-200 font-medium' : 'text-gray-300'}`}>
                          {standby.admin_name || standby.admin_email}
                          {isMe && ' (You)'}
                        </span>
                        {standby.swapped_from && <span className="text-xs text-gray-600 italic">swapped</span>}
                      </div>
                      {!isPast && (
                        <div className="flex gap-1">
                          {isMe && (
                            <>
                              <Button size="sm" variant="ghost" className="h-6 text-xs text-gray-500 hover:text-yellow-400 px-2 gap-1"
                                onClick={() => setSwapping(swapping === standby.id ? null : standby.id)}>
                                <ArrowLeftRight className="h-3 w-3" /> Swap
                              </Button>
                              <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-600 hover:text-red-400"
                                onClick={() => handleRemove(standby.id)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ) : !isPast ? (
                    <div className="flex-1">
                      {addingDate === dateStr ? (
                        <div className="flex gap-2">
                          <Button size="sm" className="h-6 text-xs bg-yellow-700 hover:bg-yellow-600 px-3"
                            onClick={() => handleClaim(dateStr)}>Claim Standby</Button>
                          <Button size="sm" variant="ghost" className="h-6 text-xs text-gray-500" onClick={() => setAddingDate(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <button className="text-xs text-gray-600 hover:text-gray-400 flex items-center gap-1 transition-colors"
                          onClick={() => setAddingDate(dateStr)}>
                          <Plus className="h-3 w-3" /> Claim
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-600">—</span>
                  )}

                  {/* Swap dropdown */}
                  {swapping === standby?.id && !isPast && (
                    <div className="w-full mt-1">
                      <select onChange={e => { if (e.target.value) handleSwap(standby.id, e.target.value); }}
                        defaultValue=""
                        className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1">
                        <option value="" disabled>Swap with…</option>
                        {adminUsers.filter(u => u.email !== standby.admin_email).map(u => (
                          <option key={u.email} value={u.email}>{u.full_name || u.email}</option>
                        ))}
                      </select>
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