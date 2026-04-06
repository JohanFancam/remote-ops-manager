import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, Plus, X, ArrowLeftRight, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import {
  format, addMonths, subMonths,
  startOfMonth, endOfMonth, eachDayOfInterval,
  startOfWeek, endOfWeek, isSameMonth
} from 'date-fns';
import { getDisplayName } from '../utils/nameUtils';

function getCalendarGrid(month) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
}

function entryCoversDate(entry, dateStr) {
  const sd = entry.start_date || entry.date;
  const ed = entry.end_date || sd;
  if (!sd) return false;
  return sd <= dateStr && dateStr <= ed;
}

export default function StandbyManager({ user, allUsers = [] }) {
  const queryClient = useQueryClient();
  const [calMonth, setCalMonth] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [swapping, setSwapping] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  // Multi-select: user clicks days to build a range
  const [rangeStart, setRangeStart] = useState(null);
  const [rangeEnd, setRangeEnd] = useState(null);
  const [selectMode, setSelectMode] = useState(false); // toggle range selection mode
  const [form, setForm] = useState({
    start_date: format(new Date(), 'yyyy-MM-dd'),
    start_time: '',
    end_date: '',
    end_time: '',
    notes: '',
  });

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const { data: standbyDays = [] } = useQuery({
    queryKey: ['standbyDays'],
    queryFn: () => base44.entities.StandbyDay.list('-start_date', 500),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['standbyDays'] });

  const calDays = getCalendarGrid(calMonth);
  const gridStart = format(calDays[0], 'yyyy-MM-dd');
  const gridEnd = format(calDays[calDays.length - 1], 'yyyy-MM-dd');

  const visibleEntries = standbyDays.filter(s => {
    const sd = s.start_date || s.date;
    const ed = s.end_date || sd;
    if (!sd) return false;
    return sd <= gridEnd && ed >= gridStart;
  });

  const getEntriesForDay = (dateStr) =>
    visibleEntries.filter(s => entryCoversDate(s, dateStr));

  // Is this dateStr within the selected range?
  const isInRange = (dateStr) => {
    if (!rangeStart) return false;
    const lo = rangeEnd && rangeEnd < rangeStart ? rangeEnd : rangeStart;
    const hi = rangeEnd && rangeEnd < rangeStart ? rangeStart : (rangeEnd || rangeStart);
    return dateStr >= lo && dateStr <= hi;
  };

  const handleDayClick = (dateStr) => {
    if (selectMode) {
      // Build a range
      if (!rangeStart || (rangeStart && rangeEnd)) {
        setRangeStart(dateStr);
        setRangeEnd(null);
        setForm(f => ({ ...f, start_date: dateStr, end_date: '' }));
      } else {
        // second click — set end
        const lo = dateStr < rangeStart ? dateStr : rangeStart;
        const hi = dateStr < rangeStart ? rangeStart : dateStr;
        setRangeEnd(hi);
        setRangeStart(lo);
        setForm(f => ({ ...f, start_date: lo, end_date: hi }));
      }
      setSelectedDay(null);
      setShowForm(true);
    } else {
      setSelectedDay(selectedDay === dateStr ? null : dateStr);
      setRangeStart(null);
      setRangeEnd(null);
    }
  };

  const openQuickClaim = (dateStr) => {
    setForm(f => ({ ...f, start_date: dateStr, end_date: dateStr }));
    setShowForm(true);
    setSelectedDay(null);
  };

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
      date: form.start_date,
    });
    refresh();
    setShowForm(false);
    setSelectMode(false);
    setRangeStart(null);
    setRangeEnd(null);
    setForm({ start_date: format(new Date(), 'yyyy-MM-dd'), start_time: '', end_date: '', end_time: '', notes: '' });
  };

  const handleRemove = async (id) => {
    await base44.entities.StandbyDay.delete(id);
    refresh();
    setSelectedDay(null);
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
  const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  const monthStr = format(calMonth, 'yyyy-MM');
  const myMonthCount = standbyDays.filter(s => {
    if (s.admin_email !== user.email) return false;
    const sd = s.start_date || s.date;
    const ed = s.end_date || sd;
    return sd?.startsWith(monthStr) || ed?.startsWith(monthStr);
  }).length;

  const selectedEntries = selectedDay ? getEntriesForDay(selectedDay) : [];
  const isCurrentMonth = format(calMonth, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

  return (
    <Card className="bg-gray-900 border-gray-800 mb-6">
      <CardHeader className="border-b border-gray-800 pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-yellow-400" />
            <span className="text-white font-semibold text-base">Standby Schedule</span>
            <span className="text-xs bg-yellow-600/20 text-yellow-400 border border-yellow-700/40 px-2 py-0.5 rounded-full">
              {myMonthCount} slot{myMonthCount !== 1 ? 's' : ''} this month
            </span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white"
              onClick={() => { setCalMonth(subMonths(calMonth, 1)); setSelectedDay(null); setRangeStart(null); setRangeEnd(null); }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-300 font-medium w-24 text-center">{format(calMonth, 'MMM yyyy')}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white"
              onClick={() => { setCalMonth(addMonths(calMonth, 1)); setSelectedDay(null); setRangeStart(null); setRangeEnd(null); }}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4">
        {/* Action buttons */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <Button size="sm" variant="outline"
            className="border-yellow-700/50 text-yellow-400 hover:bg-yellow-900/30 h-7 text-xs gap-1"
            onClick={() => {
              setShowForm(!showForm);
              setSelectMode(false);
              setRangeStart(null); setRangeEnd(null);
              if (!showForm) setForm({ start_date: format(new Date(), 'yyyy-MM-dd'), start_time: '', end_date: '', end_time: '', notes: '' });
            }}>
            <Plus className="h-3 w-3" /> Claim Slot
          </Button>
          <Button size="sm" variant={selectMode ? 'default' : 'outline'}
            className={selectMode
              ? 'h-7 text-xs gap-1 bg-blue-700 hover:bg-blue-600 border-blue-600'
              : 'h-7 text-xs gap-1 border-blue-700/50 text-blue-400 hover:bg-blue-900/30'}
            onClick={() => {
              setSelectMode(!selectMode);
              setShowForm(false);
              setSelectedDay(null);
              setRangeStart(null); setRangeEnd(null);
            }}>
            {selectMode ? <><Check className="h-3 w-3" /> Selecting Range…</> : 'Select Range'}
          </Button>
          {selectMode && (
            <span className="text-xs text-blue-300">
              {!rangeStart ? 'Click start date' : !rangeEnd ? `Start: ${rangeStart} — click end date` : `${rangeStart} → ${rangeEnd}`}
            </span>
          )}
        </div>

        {/* Claim form */}
        {showForm && (
          <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-3 mb-4">
            <p className="text-sm font-medium text-yellow-300">
              {rangeStart && rangeEnd ? `Standby: ${rangeStart} → ${rangeEnd}` : 'New Standby Period'}
            </p>
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
              <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-500"
                onClick={() => { setShowForm(false); setSelectMode(false); setRangeStart(null); setRangeEnd(null); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
          {DOW.map(d => <div key={d} className="text-xs text-gray-500 py-1">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-0.5 mb-4">
          {calDays.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const inMonth = isSameMonth(day, calMonth);
            const isToday = dateStr === todayStr;
            const isPast = dateStr < todayStr;
            const entries = getEntriesForDay(dateStr);
            const hasMe = entries.some(s => s.admin_email === user.email);
            const hasOther = entries.some(s => s.admin_email !== user.email);
            const isSelected = selectedDay === dateStr;
            const inSelRange = isInRange(dateStr);
            const isRangeEdge = dateStr === rangeStart || dateStr === rangeEnd;

            let bg = inMonth ? 'rgba(31,41,55,0.6)' : 'rgba(17,24,39,0.3)';
            if (hasMe && hasOther) bg = 'rgba(120,53,15,0.5)';
            else if (hasMe) bg = 'rgba(113,63,18,0.5)';
            else if (hasOther) bg = 'rgba(30,58,138,0.4)';
            if (inSelRange) bg = 'rgba(29,78,216,0.3)';
            if (isRangeEdge) bg = 'rgba(29,78,216,0.6)';

            return (
              <button
                key={dateStr}
                onClick={() => handleDayClick(dateStr)}
                className={`rounded-md p-1 min-h-[52px] text-left transition-all ${
                  isSelected ? 'ring-2 ring-yellow-400' :
                  isRangeEdge ? 'ring-2 ring-blue-400' :
                  inSelRange ? 'ring-1 ring-blue-600' :
                  'hover:ring-1 hover:ring-gray-600'
                } ${!inMonth ? 'opacity-30' : ''}`}
                style={{ background: bg }}
              >
                <span className={`text-xs font-medium block ${
                  isToday ? 'text-blue-400 font-bold' :
                  hasMe ? 'text-yellow-300' :
                  hasOther ? 'text-blue-300' :
                  isPast ? 'text-gray-600' : 'text-gray-400'
                }`}>
                  {format(day, 'd')}
                </span>
                {hasMe && (
                  <div className="mt-0.5">
                    <Phone className="h-2.5 w-2.5 text-yellow-400 inline" />
                    <span className="text-xs text-yellow-400 ml-0.5">You</span>
                  </div>
                )}
                {hasOther && !hasMe && (
                  <div className="mt-0.5 space-y-0.5">
                    {entries.filter(e => e.admin_email !== user.email).slice(0, 2).map(e => {
                      const u = allUsers.find(u => u.email === e.admin_email);
                      const name = getDisplayName(u, e.admin_email, e.admin_name);
                      return (
                        <div key={e.id} className="text-xs text-blue-300 truncate leading-tight">
                          {name.split(' ')[0]}
                        </div>
                      );
                    })}
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
            <span className="w-3 h-3 rounded inline-block" style={{ background: 'rgba(113,63,18,0.6)' }} /> My Standby
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-3 h-3 rounded inline-block" style={{ background: 'rgba(30,58,138,0.5)' }} /> Other Admin
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-1 h-1 rounded-full bg-blue-400 inline-block" /> Today
          </span>
        </div>

        {/* Detail panel for selected day */}
        {selectedDay && (
          <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-white">
                {format(new Date(selectedDay + 'T12:00:00'), 'EEEE, MMMM d yyyy')}
              </p>
              <Button size="sm" variant="outline"
                className="h-7 text-xs border-yellow-700/50 text-yellow-400 hover:bg-yellow-900/30 gap-1"
                onClick={() => openQuickClaim(selectedDay)}>
                <Plus className="h-3 w-3" /> Claim This Day
              </Button>
            </div>
            {selectedEntries.length === 0 ? (
              <p className="text-xs text-gray-500">No standby scheduled — click "Claim This Day" to add one.</p>
            ) : (
              <div className="space-y-3">
                {selectedEntries.map(standby => {
                  const isMe = standby.admin_email === user.email;
                  const u = allUsers.find(u => u.email === standby.admin_email);
                  const name = getDisplayName(u, standby.admin_email, standby.admin_name);
                  const isPastDay = selectedDay < todayStr;
                  const sd = standby.start_date || standby.date;
                  const ed = standby.end_date || sd;

                  return (
                    <div key={standby.id} className={`rounded-lg px-3 py-2 border ${
                      isMe ? 'bg-yellow-950/40 border-yellow-800/40' : 'bg-blue-950/30 border-blue-800/30'
                    }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <Phone className={`h-3 w-3 ${isMe ? 'text-yellow-400' : 'text-blue-400'}`} />
                            <span className={`text-sm font-medium ${isMe ? 'text-yellow-200' : 'text-blue-300'}`}>
                              {name}{isMe ? ' (You)' : ''}
                            </span>
                            {standby.swapped_from && <span className="text-xs text-gray-600 italic">swapped</span>}
                          </div>
                          <p className="text-xs text-gray-400 mt-1 ml-5">
                            {sd}{standby.start_time ? ` @ ${standby.start_time}` : ''} → {ed}{standby.end_time ? ` @ ${standby.end_time}` : ''}
                          </p>
                          {standby.notes && <p className="text-xs text-gray-500 ml-5 italic">{standby.notes}</p>}
                        </div>
                        {!isPastDay && isMe && (
                          <div className="flex gap-1 flex-shrink-0">
                            <Button size="sm" variant="ghost"
                              className="h-6 text-xs text-gray-500 hover:text-yellow-400 px-2 gap-1"
                              onClick={() => setSwapping(swapping === standby.id ? null : standby.id)}>
                              <ArrowLeftRight className="h-3 w-3" /> Swap
                            </Button>
                            <Button size="sm" variant="ghost"
                              className="h-6 w-6 p-0 text-gray-600 hover:text-red-400"
                              onClick={() => handleRemove(standby.id)}>
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                      </div>
                      {swapping === standby.id && !isPastDay && (
                        <div className="mt-2">
                          <select
                            onChange={e => { if (e.target.value) handleSwap(standby.id, e.target.value); }}
                            defaultValue=""
                            className="w-full bg-gray-900 border border-gray-700 text-white text-xs rounded px-2 py-1">
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
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}