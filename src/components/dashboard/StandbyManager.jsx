import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, Plus, X, ArrowLeftRight, ChevronDown, ChevronUp } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval, parseISO } from 'date-fns';
import { getDisplayName } from '../utils/nameUtils';

function isStandbyActive(entry, now) {
  // Build start and end DateTime from entry fields
  const startStr = `${entry.start_date}T${entry.start_time || '00:00'}`;
  const endStr = entry.end_date
    ? `${entry.end_date}T${entry.end_time || '23:59'}`
    : `${entry.start_date}T${entry.end_time || '23:59'}`;
  const start = new Date(startStr);
  const end = new Date(endStr);
  return now >= start && now <= end;
}

export default function StandbyManager({ user, allUsers = [] }) {
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [swapping, setSwapping] = useState(null);
  const [form, setForm] = useState({
    start_date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '',
    end_date: '',
    end_time: '',
    notes: '',
  });

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const monthStr = format(currentMonth, 'yyyy-MM');
  const days = eachDayOfInterval({ start: startOfMonth(currentMonth), end: endOfMonth(currentMonth) });

  const { data: standbyDays = [] } = useQuery({
    queryKey: ['standbyDays'],
    queryFn: () => base44.entities.StandbyDay.list('-start_date', 500),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['standbyDays'] });

  // Filter entries that overlap with the current month
  const monthEntries = standbyDays.filter(s => {
    const sd = s.start_date || s.date;
    const ed = s.end_date || sd;
    if (!sd) return false;
    return sd.startsWith(monthStr) || ed.startsWith(monthStr) || (sd < monthStr && ed > monthStr);
  });

  // Get entries that cover a given date
  const getEntriesForDay = (dateStr) =>
    monthEntries.filter(s => {
      const sd = s.start_date || s.date;
      const ed = s.end_date || sd;
      return sd <= dateStr && dateStr <= ed;
    });

  const handleClaim = async () => {
    if (!form.start_date) return;
    await base44.entities.StandbyDay.create({
      start_date: form.start_date,
      start_time: form.start_time || '',
      end_date: form.end_date || form.start_date,
      end_time: form.end_time || '',
      notes: form.notes || '',
      admin_email: user.email,
      admin_name: user.full_name || user.email,
      // legacy
      date: form.start_date,
    });
    refresh();
    setShowForm(false);
    setForm({ start_date: format(new Date(), 'yyyy-MM-dd'), start_time: '', end_date: '', end_time: '', notes: '' });
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
  const now = new Date();
  const myMonthEntries = monthEntries.filter(s => s.admin_email === user.email);

  return (
    <Card className="bg-gray-900 border-gray-800 mb-6">
      <CardHeader className="border-b border-gray-800 pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 text-white font-semibold text-base hover:text-blue-400 transition-colors">
            <Phone className="h-4 w-4 text-yellow-400" />
            Standby Schedule
            {expanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
            <span className="text-xs bg-yellow-600/20 text-yellow-400 border border-yellow-700/40 px-2 py-0.5 rounded-full ml-1">
              {myMonthEntries.length} slot{myMonthEntries.length !== 1 ? 's' : ''} this month
            </span>
          </button>
          {expanded && (
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>{'<'}</Button>
              <span className="text-sm text-gray-300 font-medium">{format(currentMonth, 'MMM yyyy')}</span>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>{'>'}</Button>
            </div>
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-4">
          {/* Add new standby slot */}
          <div className="mb-4">
            {showForm ? (
              <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-3">
                <p className="text-sm font-medium text-yellow-300">New Standby Period</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">From Date</label>
                    <Input type="date" value={form.start_date}
                      onChange={e => setForm({ ...form, start_date: e.target.value })}
                      className="bg-gray-900 border-gray-700 text-white h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">From Time</label>
                    <Input type="time" value={form.start_time}
                      onChange={e => setForm({ ...form, start_time: e.target.value })}
                      className="bg-gray-900 border-gray-700 text-white h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">To Date</label>
                    <Input type="date" value={form.end_date}
                      onChange={e => setForm({ ...form, end_date: e.target.value })}
                      className="bg-gray-900 border-gray-700 text-white h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">To Time</label>
                    <Input type="time" value={form.end_time}
                      onChange={e => setForm({ ...form, end_time: e.target.value })}
                      className="bg-gray-900 border-gray-700 text-white h-8 text-xs" />
                  </div>
                </div>
                <Input placeholder="Notes (optional)" value={form.notes}
                  onChange={e => setForm({ ...form, notes: e.target.value })}
                  className="bg-gray-900 border-gray-700 text-white h-8 text-xs" />
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-xs bg-yellow-700 hover:bg-yellow-600 px-4" onClick={handleClaim}>
                    Claim Standby
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-500" onClick={() => setShowForm(false)}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="border-yellow-700/50 text-yellow-400 hover:bg-yellow-900/30 h-7 text-xs gap-1"
                onClick={() => setShowForm(true)}>
                <Plus className="h-3 w-3" /> Claim Standby Slot
              </Button>
            )}
          </div>

          {/* Calendar days */}
          <div className="space-y-1.5">
            {days.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const isPast = dateStr < todayStr;
              const entries = getEntriesForDay(dateStr);
              const hasMe = entries.some(s => s.admin_email === user.email);
              const dayLabel = format(day, 'EEE, MMM d');

              // Hide past days with no entries, BUT show past days that are part of an active multi-day range
              if (entries.length === 0 && isPast) return null;
              // Also hide past days that have entries but the entire range ends before today
              if (isPast && entries.length > 0 && entries.every(s => {
                const ed = s.end_date || s.start_date || s.date;
                return ed < todayStr;
              })) return null;

              return (
                <div key={dateStr} className={`rounded-lg px-3 py-2 border ${
                  hasMe ? 'bg-yellow-950/30 border-yellow-800/40' :
                  entries.length > 0 ? 'bg-gray-800/50 border-gray-700/50' :
                  'border-transparent'
                } ${isPast ? 'opacity-50' : ''}`}>
                  <div className="flex items-start gap-3">
                    <span className={`text-xs w-28 flex-shrink-0 font-mono mt-0.5 ${hasMe ? 'text-yellow-300' : 'text-gray-400'}`}>{dayLabel}</span>
                    <div className="flex-1">
                      {entries.length > 0 ? (
                        <div className="space-y-1">
                          {entries.map((standby, idx) => {
                            const isMe = standby.admin_email === user.email;
                            const u = allUsers.find(u => u.email === standby.admin_email);
                            const name = getDisplayName(u, standby.admin_email, standby.admin_name);
                            const isFirst = (standby.start_date || standby.date) === dateStr;
                            const isLast = (standby.end_date || standby.start_date || standby.date) === dateStr;
                            return (
                              <div key={standby.id} className={`flex items-center justify-between gap-2 flex-wrap ${idx > 0 ? 'pt-1 border-t border-gray-700/40' : ''}`}>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <Phone className={`h-3 w-3 ${isMe ? 'text-yellow-400' : 'text-blue-400'}`} />
                                    <span className={`text-sm font-medium ${isMe ? 'text-yellow-200' : 'text-blue-300'}`}>
                                      {name}{isMe ? ' (You)' : ''}
                                    </span>
                                    {standby.swapped_from && <span className="text-xs text-gray-600 italic">swapped</span>}
                                  </div>
                                  <p className="text-xs text-gray-500 ml-5">
                                    {isFirst && standby.start_time && `Starts ${standby.start_time}`}
                                    {isLast && standby.end_time && `${isFirst && standby.start_time ? ' → ' : ''}Ends ${standby.end_time}`}
                                    {!isFirst && !isLast && 'Continues'}
                                  </p>
                                  {standby.notes && <p className="text-xs text-gray-600 ml-5">{standby.notes}</p>}
                                </div>
                                {!isPast && isMe && (
                                  <div className="flex gap-1">
                                    <Button size="sm" variant="ghost" className="h-6 text-xs text-gray-500 hover:text-yellow-400 px-2 gap-1"
                                      onClick={() => setSwapping(swapping === standby.id ? null : standby.id)}>
                                      <ArrowLeftRight className="h-3 w-3" /> Swap
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-600 hover:text-red-400"
                                      onClick={() => handleRemove(standby.id)}>
                                      <X className="h-3 w-3" />
                                    </Button>
                                  </div>
                                )}
                                {swapping === standby.id && !isPast && (
                                  <div className="w-full mt-1">
                                    <select onChange={e => { if (e.target.value) handleSwap(standby.id, e.target.value); }}
                                      defaultValue=""
                                      className="w-full bg-gray-800 border border-gray-700 text-white text-xs rounded px-2 py-1">
                                      <option value="" disabled>Swap with…</option>
                                      {adminUsers.filter(u => u.email !== standby.admin_email).map(u => (
                                        <option key={u.email} value={u.email}>{getDisplayName(u, u.email)}</option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}