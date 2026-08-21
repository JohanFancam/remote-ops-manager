import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CalendarDays, Plus, X, ChevronDown, ChevronUp,
  ChevronLeft, ChevronRight, Pencil, Check, Save
} from 'lucide-react';
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
  return entry.start_date <= dateStr && dateStr <= entry.end_date;
}

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

// ─── Admin view ───────────────────────────────────────────────────────────────
export function AdminAvailabilityView({ allUsers = [] }) {
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  const { data: entries = [], refetch: refetchEntries } = useQuery({
    queryKey: ['operatorAvailability'],
    queryFn: () => base44.entities.OperatorAvailability.list('-start_date', 500),
  });

  useEffect(() => {
    const unsub = base44.entities.OperatorAvailability.subscribe((event) => {
      if (event.type === 'create' || event.type === 'update') {
        const e = event.data;
        const name = e?.operator_name || e?.operator_email || 'An operator';
        const typeLabel = e?.type === 'unavailable' ? 'OUT' : 'IN';
        toast.info(`📅 Availability updated`, {
          description: `${name} marked ${typeLabel}: ${e?.start_date} → ${e?.end_date}`,
          duration: 8000,
        });
        refetchEntries();
      }
      if (event.type === 'delete') refetchEntries();
    });
    return () => unsub();
  }, []);

  const monthStr = format(calMonth, 'yyyy-MM');
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const entryCount = entries.filter(e =>
    e.start_date?.startsWith(monthStr) || e.end_date?.startsWith(monthStr) ||
    (e.start_date < monthStr && e.end_date > monthStr)
  ).length;

  const calDays = getCalendarGrid(calMonth);

  const selectedDayEntries = selectedDay ? entries.filter(e => entryCoversDate(e, selectedDay)) : [];
  const unavailSelected = selectedDayEntries.filter(e => e.type === 'unavailable');
  const availSelected = selectedDayEntries.filter(e => e.type === 'available');

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-purple-400" />
          <span className="text-zinc-900 font-semibold">{format(calMonth, 'MMMM yyyy')}</span>
          <span className="text-xs bg-purple-600/20 text-purple-400 border border-purple-700/40 px-2 py-0.5 rounded-full">
            {entryCount} entries
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-zinc-900"
            onClick={() => { setCalMonth(subMonths(calMonth, 1)); setSelectedDay(null); }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-zinc-900"
            onClick={() => { setCalMonth(addMonths(calMonth, 1)); setSelectedDay(null); }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {DOW.map(d => <div key={d} className="text-xs text-zinc-500 py-2 font-semibold uppercase tracking-wider">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1 mb-4">
        {calDays.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const inMonth = isSameMonth(day, calMonth);
          const isToday = dateStr === todayStr;
          const dayEntries = entries.filter(e => entryCoversDate(e, dateStr));
          const unavail = dayEntries.filter(e => e.type === 'unavailable');
          const avail = dayEntries.filter(e => e.type === 'available');
          const isSelected = selectedDay === dateStr;
          const bg = unavail.length > 0 ? 'rgba(127,29,29,0.35)' : avail.length > 0 ? 'rgba(20,83,45,0.35)' : inMonth ? 'rgba(31,41,55,0.5)' : 'rgba(17,24,39,0.3)';
          return (
            <button
              key={dateStr}
              onClick={() => inMonth && setSelectedDay(isSelected ? null : dateStr)}
              className={`rounded-lg p-2 min-h-[96px] text-left transition-all flex flex-col
                ${!inMonth ? 'opacity-20 cursor-default' : 'cursor-pointer hover:ring-1 hover:ring-gray-500'}
                ${isToday ? 'ring-2 ring-blue-500' : ''}
                ${isSelected ? 'ring-2 ring-purple-400' : ''}`}
              style={{ background: bg }}
            >
              <span className={`text-sm font-bold block mb-1.5 ${isToday ? 'text-teal-700' : unavail.length > 0 ? 'text-red-700' : avail.length > 0 ? 'text-green-300' : 'text-zinc-500'}`}>
                {format(day, 'd')}
              </span>
              <div className="flex-1 space-y-0.5">
                {inMonth && unavail.length > 0 && (
                  <>
                    {unavail.slice(0, 3).map(e => {
                      const u = allUsers.find(u => u.email === e.operator_email);
                      return (
                        <div key={e.id} className="text-xs bg-red-700/60 text-red-100 rounded px-1 py-0.5 truncate leading-tight">
                          {getDisplayName(u, e.operator_email, e.operator_name).split(' ')[0]}
                        </div>
                      );
                    })}
                    {unavail.length > 3 && <div className="text-xs text-red-600 font-medium">+{unavail.length - 3} more</div>}
                  </>
                )}
                {inMonth && avail.length > 0 && unavail.length === 0 && (
                  <>
                    {avail.slice(0, 3).map(e => {
                      const u = allUsers.find(u => u.email === e.operator_email);
                      return (
                        <div key={e.id} className="text-xs bg-green-700/60 text-green-100 rounded px-1 py-0.5 truncate leading-tight">
                          {getDisplayName(u, e.operator_email, e.operator_name).split(' ')[0]}
                        </div>
                      );
                    })}
                    {avail.length > 3 && <div className="text-xs text-emerald-700 font-medium">+{avail.length - 3} more</div>}
                  </>
                )}
              </div>
              {isToday && <div className="w-1.5 h-1.5 rounded-full bg-teal-600 mt-1" />}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs text-zinc-500">
          <span className="w-3 h-3 rounded bg-red-700/50 inline-block" /> Unavailable
        </span>
        <span className="flex items-center gap-1.5 text-xs text-zinc-500">
          <span className="w-3 h-3 rounded bg-green-700/50 inline-block" /> Available
        </span>
        <span className="flex items-center gap-1.5 text-xs text-zinc-500 italic">Click a day to expand</span>
      </div>

      {/* Day detail panel */}
      {selectedDay && (
        <div className="bg-zinc-100/60 border border-purple-700/40 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-zinc-900">
              {format(new Date(selectedDay + 'T12:00:00'), 'EEEE, MMMM d yyyy')}
            </p>
            <button onClick={() => setSelectedDay(null)} className="text-zinc-400 hover:text-zinc-900">
              <X className="h-4 w-4" />
            </button>
          </div>
          {selectedDayEntries.length === 0 ? (
            <p className="text-xs text-zinc-400">No availability entries for this day.</p>
          ) : (
            <div className="space-y-3">
              {unavailSelected.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-1.5">❌ Unavailable ({unavailSelected.length})</p>
                  <div className="space-y-1">
                    {unavailSelected.map(e => {
                      const u = allUsers.find(u => u.email === e.operator_email);
                      return (
                        <div key={e.id} className="flex items-center justify-between bg-red-950/30 border border-red-800/30 rounded-lg px-3 py-2">
                          <div>
                            <p className="text-sm text-zinc-900 font-medium">{getDisplayName(u, e.operator_email, e.operator_name)}</p>
                            <p className="text-xs text-zinc-400">{e.start_date} → {e.end_date}{e.notes ? ` · ${e.notes}` : ''}</p>
                          </div>
                          <span className="text-xs bg-red-700/30 text-red-700 px-2 py-0.5 rounded-full">OUT</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {availSelected.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-1.5">✅ Available ({availSelected.length})</p>
                  <div className="space-y-1">
                    {availSelected.map(e => {
                      const u = allUsers.find(u => u.email === e.operator_email);
                      return (
                        <div key={e.id} className="flex items-center justify-between bg-emerald-50 border border-green-800/30 rounded-lg px-3 py-2">
                          <div>
                            <p className="text-sm text-zinc-900 font-medium">{getDisplayName(u, e.operator_email, e.operator_name)}</p>
                            <p className="text-xs text-zinc-400">{e.start_date} → {e.end_date}{e.notes ? ` · ${e.notes}` : ''}</p>
                          </div>
                          <span className="text-xs bg-green-700/30 text-green-300 px-2 py-0.5 rounded-full">IN</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Operator view ────────────────────────────────────────────────────────────
const BLANK_FORM = { start_date: '', end_date: '', type: 'unavailable', notes: '' };

export function OperatorAvailabilityPanel({ user }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [rangeStart, setRangeStart] = useState(null);
  const [rangeEnd, setRangeEnd] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [form, setForm] = useState(BLANK_FORM);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const { data: allEntries = [] } = useQuery({
    queryKey: ['operatorAvailability'],
    queryFn: () => base44.entities.OperatorAvailability.list('-start_date', 500),
  });

  const myEntries = allEntries.filter(e => e.operator_email === user?.email);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['operatorAvailability'] });
  const calDays = getCalendarGrid(calMonth);
  const upcoming = [...myEntries].filter(e => e.end_date >= todayStr).sort((a, b) => a.start_date.localeCompare(b.start_date));

  const isInRange = (dateStr) => {
    if (!rangeStart) return false;
    const lo = rangeEnd && rangeEnd < rangeStart ? rangeEnd : rangeStart;
    const hi = rangeEnd ? (rangeEnd < rangeStart ? rangeStart : rangeEnd) : rangeStart;
    return dateStr >= lo && dateStr <= hi;
  };

  const handleDayClick = (dateStr) => {
    if (selectMode) {
      if (!rangeStart || (rangeStart && rangeEnd)) {
        setRangeStart(dateStr); setRangeEnd(null);
        setForm(f => ({ ...f, start_date: dateStr, end_date: dateStr }));
        setShowForm(true); setEditingEntry(null); setSelectedDay(null);
      } else {
        const lo = dateStr < rangeStart ? dateStr : rangeStart;
        const hi = dateStr < rangeStart ? rangeStart : dateStr;
        setRangeStart(lo); setRangeEnd(hi);
        setForm(f => ({ ...f, start_date: lo, end_date: hi }));
        setShowForm(true); setEditingEntry(null); setSelectedDay(null);
      }
    } else {
      setSelectedDay(selectedDay === dateStr ? null : dateStr);
      setRangeStart(null); setRangeEnd(null);
    }
  };

  const openQuickAdd = (dateStr) => {
    setForm({ ...BLANK_FORM, start_date: dateStr, end_date: dateStr });
    setEditingEntry(null); setShowForm(true); setSelectedDay(null);
  };

  const openEdit = (entry) => {
    setEditingEntry(entry);
    setForm({ start_date: entry.start_date, end_date: entry.end_date, type: entry.type, notes: entry.notes || '' });
    setShowForm(true); setSelectedDay(null);
  };

  const handleSave = async () => {
    if (!form.start_date || !form.end_date) return;
    if (editingEntry) {
      await base44.entities.OperatorAvailability.update(editingEntry.id, {
        start_date: form.start_date, end_date: form.end_date, type: form.type, notes: form.notes,
      });
    } else {
      await base44.entities.OperatorAvailability.create({
        operator_email: user.email, operator_name: user.full_name || user.email,
        start_date: form.start_date, end_date: form.end_date, type: form.type, notes: form.notes,
      });
    }
    refresh(); closeForm();
  };

  const handleRemove = async (id) => {
    await base44.entities.OperatorAvailability.delete(id);
    refresh(); setSelectedDay(null);
  };

  const closeForm = () => {
    setShowForm(false); setEditingEntry(null); setSelectMode(false);
    setRangeStart(null); setRangeEnd(null); setForm(BLANK_FORM);
  };

  const selectedEntries = selectedDay ? myEntries.filter(e => entryCoversDate(e, selectedDay)) : [];

  return (
    <Card className="bg-white border-zinc-200 mb-6">
      <CardHeader className="border-b border-zinc-200 pb-3">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 text-zinc-900 font-semibold text-base hover:text-teal-700 transition-colors">
          <CalendarDays className="h-4 w-4 text-purple-400" />
          My Availability
          {expanded ? <ChevronUp className="h-4 w-4 text-zinc-400" /> : <ChevronDown className="h-4 w-4 text-zinc-400" />}
          <span className="text-xs bg-purple-600/20 text-purple-400 border border-purple-700/40 px-2 py-0.5 rounded-full ml-1">
            {upcoming.length} upcoming
          </span>
        </button>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-4 space-y-4">
          <p className="text-xs text-zinc-400">Let admins know when you're in or out. Click a day or select a range.</p>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="outline"
              className="border-purple-700/50 text-purple-400 hover:bg-purple-900/30 h-7 text-xs gap-1"
              onClick={() => {
                setShowForm(!showForm); setSelectMode(false);
                setRangeStart(null); setRangeEnd(null); setSelectedDay(null);
                if (!showForm) { setEditingEntry(null); setForm(BLANK_FORM); }
              }}>
              <Plus className="h-3 w-3" /> Add Entry
            </Button>
            <Button size="sm" variant={selectMode ? 'default' : 'outline'}
              className={selectMode
                ? 'h-7 text-xs gap-1 bg-teal-700 hover:bg-teal-700 border-teal-700'
                : 'h-7 text-xs gap-1 border-teal-200 text-teal-700 hover:bg-teal-50'}
              onClick={() => { setSelectMode(!selectMode); setShowForm(false); setSelectedDay(null); setRangeStart(null); setRangeEnd(null); }}>
              {selectMode ? <><Check className="h-3 w-3" /> Selecting…</> : 'Select Range'}
            </Button>
            {selectMode && (
              <span className="text-xs text-teal-700">
                {!rangeStart ? 'Click start date' : !rangeEnd ? `Start: ${rangeStart} — click end` : `${rangeStart} → ${rangeEnd}`}
              </span>
            )}
          </div>

          {/* Form */}
          {showForm && (
            <div className="bg-zinc-100/60 border border-zinc-200 rounded-xl p-4 space-y-3">
              <p className="text-sm font-medium text-purple-300">
                {editingEntry ? 'Edit Entry' : rangeStart && rangeEnd ? `${rangeStart} → ${rangeEnd}` : 'New Entry'}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setForm({ ...form, type: 'unavailable' })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.type === 'unavailable' ? 'bg-red-700/40 border-red-600/50 text-red-700' : 'border-zinc-200 text-zinc-400 hover:text-zinc-900'}`}>
                  OUT (Unavailable)
                </button>
                <button onClick={() => setForm({ ...form, type: 'available' })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.type === 'available' ? 'bg-green-700/40 border-green-600/50 text-green-300' : 'border-zinc-200 text-zinc-400 hover:text-zinc-900'}`}>
                  IN (Available)
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">From</label>
                  <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                    className="bg-white border-zinc-200 text-zinc-900 h-8 text-xs" />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 block mb-1">To</label>
                  <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
                    className="bg-white border-zinc-200 text-zinc-900 h-8 text-xs" />
                </div>
              </div>
              <Input placeholder="Notes (optional)" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                className="bg-white border-zinc-200 text-zinc-900 h-8 text-xs" />
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs bg-purple-700 hover:bg-purple-600 px-4 gap-1" onClick={handleSave}>
                  <Save className="h-3 w-3" /> {editingEntry ? 'Update' : 'Save'}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-zinc-400" onClick={closeForm}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Month nav */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-zinc-900"
              onClick={() => { setCalMonth(subMonths(calMonth, 1)); setSelectedDay(null); setRangeStart(null); setRangeEnd(null); }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-zinc-600 font-medium w-28 text-center">{format(calMonth, 'MMMM yyyy')}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-zinc-500 hover:text-zinc-900"
              onClick={() => { setCalMonth(addMonths(calMonth, 1)); setSelectedDay(null); setRangeStart(null); setRangeEnd(null); }}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Calendar */}
          <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
            {DOW.map(d => <div key={d} className="text-xs text-zinc-400 py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {calDays.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const inMonth = isSameMonth(day, calMonth);
              const isToday = dateStr === todayStr;
              const myDay = myEntries.find(e => entryCoversDate(e, dateStr));
              const isSelected = selectedDay === dateStr;
              const inSelRange = isInRange(dateStr);
              const isEdge = dateStr === rangeStart || dateStr === rangeEnd;

              let bg = 'rgba(31,41,55,0.4)';
              if (myDay?.type === 'unavailable') bg = 'rgba(127,29,29,0.4)';
              else if (myDay?.type === 'available') bg = 'rgba(20,83,45,0.4)';
              if (inSelRange) bg = 'rgba(109,40,217,0.25)';
              if (isEdge) bg = 'rgba(109,40,217,0.5)';

              return (
                <button
                  key={dateStr}
                  onClick={() => handleDayClick(dateStr)}
                  className={`rounded-md p-1 min-h-[44px] text-center transition-all ${!inMonth ? 'opacity-25' : ''}
                    ${isSelected ? 'ring-2 ring-purple-400' : isEdge ? 'ring-2 ring-blue-400' : inSelRange ? 'ring-1 ring-blue-600' : 'hover:ring-1 hover:ring-gray-600'}
                    ${isToday ? 'ring-1 ring-blue-500' : ''}`}
                  style={{ background: bg }}
                >
                  <span className={`text-xs font-medium ${isToday ? 'text-teal-700 font-bold' : myDay?.type === 'unavailable' ? 'text-red-700' : myDay?.type === 'available' ? 'text-green-300' : 'text-zinc-400'}`}>
                    {format(day, 'd')}
                  </span>
                  {inMonth && myDay && (
                    <div className={`text-xs mt-0.5 ${myDay.type === 'unavailable' ? 'text-red-600' : 'text-emerald-700'}`}>
                      {myDay.type === 'unavailable' ? 'OUT' : 'IN'}
                    </div>
                  )}
                  {isToday && <div className="w-1 h-1 rounded-full bg-teal-600 mt-0.5 mx-auto" />}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 flex-wrap">
            <span className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="w-3 h-3 rounded bg-red-700/50 inline-block" /> Unavailable
            </span>
            <span className="flex items-center gap-1.5 text-xs text-zinc-500">
              <span className="w-3 h-3 rounded bg-green-700/50 inline-block" /> Available
            </span>
          </div>

          {/* Day detail panel */}
          {selectedDay && (
            <div className="bg-zinc-100/60 border border-zinc-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold text-zinc-900">
                  {format(new Date(selectedDay + 'T12:00:00'), 'EEEE, MMMM d yyyy')}
                </p>
                <Button size="sm" variant="outline"
                  className="h-7 text-xs border-purple-700/50 text-purple-400 hover:bg-purple-900/30 gap-1"
                  onClick={() => openQuickAdd(selectedDay)}>
                  <Plus className="h-3 w-3" /> Add Here
                </Button>
              </div>
              {selectedEntries.length === 0 ? (
                <p className="text-xs text-zinc-400">Nothing set for this day — click "Add Here" to add an entry.</p>
              ) : (
                <div className="space-y-2">
                  {selectedEntries.map(entry => (
                    <div key={entry.id} className={`rounded-lg px-3 py-2.5 border flex items-start justify-between gap-2 ${
                      entry.type === 'unavailable' ? 'bg-red-950/40 border-red-800/40' : 'bg-emerald-50 border-green-800/40'
                    }`}>
                      <div>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          entry.type === 'unavailable' ? 'bg-red-700/30 text-red-700' : 'bg-green-700/30 text-green-300'
                        }`}>
                          {entry.type === 'unavailable' ? 'OUT' : 'IN'}
                        </span>
                        <p className="text-xs text-zinc-600 mt-1">{entry.start_date} → {entry.end_date}</p>
                        {entry.notes && <p className="text-xs text-zinc-400 italic mt-0.5">{entry.notes}</p>}
                      </div>
                      <div className="flex gap-1 flex-shrink-0">
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-zinc-400 hover:text-teal-700"
                          onClick={() => openEdit(entry)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-600 hover:text-red-600"
                          onClick={() => handleRemove(entry.id)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Upcoming list */}
          {upcoming.length > 0 && !selectedDay && !showForm && (
            <div className="border-t border-zinc-200 pt-3">
              <p className="text-xs text-zinc-400 uppercase tracking-wider mb-2">All Upcoming Entries</p>
              <div className="space-y-1.5">
                {upcoming.map(entry => (
                  <div key={entry.id} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border ${
                    entry.type === 'unavailable' ? 'bg-red-950/30 border-red-800/40' : 'bg-emerald-50 border-green-800/40'
                  }`}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        entry.type === 'unavailable' ? 'bg-red-700/30 text-red-700' : 'bg-green-700/30 text-green-300'
                      }`}>
                        {entry.type === 'unavailable' ? 'OUT' : 'IN'}
                      </span>
                      <span className="text-xs text-zinc-600">{entry.start_date} → {entry.end_date}</span>
                      {entry.notes && <span className="text-xs text-zinc-400 italic">{entry.notes}</span>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-zinc-400 hover:text-teal-700"
                        onClick={() => openEdit(entry)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-600 hover:text-red-600"
                        onClick={() => handleRemove(entry.id)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}