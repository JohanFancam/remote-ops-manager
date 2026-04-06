import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarDays, Plus, X, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth } from 'date-fns';
import { getDisplayName } from '../utils/nameUtils';

// Mini calendar cell helpers
function getCalendarGrid(month) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 }); // Mon
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
}

function entryCoversDate(entry, dateStr) {
  return entry.start_date <= dateStr && dateStr <= entry.end_date;
}

// ─── Admin view ──────────────────────────────────────────────────────────────
export function AdminAvailabilityView({ allUsers = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date());

  const { data: entries = [] } = useQuery({
    queryKey: ['operatorAvailability'],
    queryFn: () => base44.entities.OperatorAvailability.list('-start_date', 500),
  });

  const monthStr = format(calMonth, 'yyyy-MM');
  const monthEntries = entries.filter(e =>
    e.start_date?.startsWith(monthStr) || e.end_date?.startsWith(monthStr) ||
    (e.start_date < monthStr + '-01' && e.end_date > monthStr + '-31')
  );
  const unavailableCount = entries.filter(e =>
    e.type === 'unavailable' &&
    (e.start_date?.startsWith(monthStr) || e.end_date?.startsWith(monthStr) ||
      (e.start_date < monthStr && e.end_date > monthStr))
  ).length;

  const calDays = getCalendarGrid(calMonth);
  const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <Card className="bg-gray-900 border-gray-800 mb-6">
      <CardHeader className="border-b border-gray-800 pb-3">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 text-white font-semibold text-base hover:text-blue-400 transition-colors">
          <CalendarDays className="h-4 w-4 text-purple-400" />
          Operator Availability
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
          <span className="text-xs bg-purple-600/20 text-purple-400 border border-purple-700/40 px-2 py-0.5 rounded-full ml-1">
            {unavailableCount} unavailable this month
          </span>
        </button>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-4">
          {/* Month nav */}
          <div className="flex items-center gap-2 mb-3">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white" onClick={() => setCalMonth(subMonths(calMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm text-gray-300 font-medium w-28 text-center">{format(calMonth, 'MMMM yyyy')}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white" onClick={() => setCalMonth(addMonths(calMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
            {DOW.map(d => <div key={d} className="text-xs text-gray-500 py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {calDays.map(day => {
              const dateStr = format(day, 'yyyy-MM-dd');
              const inMonth = isSameMonth(day, calMonth);
              const dayEntries = entries.filter(e => entryCoversDate(e, dateStr));
              const unavail = dayEntries.filter(e => e.type === 'unavailable');
              const avail = dayEntries.filter(e => e.type === 'available');
              const today = format(new Date(), 'yyyy-MM-dd');

              return (
                <div key={dateStr}
                  className={`relative rounded-md p-1 min-h-[48px] ${!inMonth ? 'opacity-30' : ''} ${dateStr === today ? 'ring-1 ring-blue-500' : ''}`}
                  style={{ background: unavail.length > 0 ? 'rgba(127,29,29,0.25)' : avail.length > 0 ? 'rgba(20,83,45,0.25)' : 'rgba(31,41,55,0.4)' }}
                >
                  <span className={`text-xs font-medium ${dateStr === today ? 'text-blue-400' : 'text-gray-400'}`}>
                    {format(day, 'd')}
                  </span>
                  {unavail.length > 0 && (
                    <div className="mt-0.5 space-y-0.5">
                      {unavail.map(e => {
                        const u = allUsers.find(u => u.email === e.operator_email);
                        const name = getDisplayName(u, e.operator_email, e.operator_name);
                        return (
                          <div key={e.id} className="text-xs bg-red-700/50 text-red-200 rounded px-1 truncate" title={name}>
                            {name.split(' ')[0]}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {avail.length > 0 && (
                    <div className="mt-0.5 space-y-0.5">
                      {avail.map(e => {
                        const u = allUsers.find(u => u.email === e.operator_email);
                        const name = getDisplayName(u, e.operator_email, e.operator_name);
                        return (
                          <div key={e.id} className="text-xs bg-green-700/50 text-green-200 rounded px-1 truncate" title={name}>
                            {name.split(' ')[0]}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-4 mt-3">
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-3 h-3 rounded bg-red-700/50 inline-block" /> Unavailable
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
              <span className="w-3 h-3 rounded bg-green-700/50 inline-block" /> Available
            </span>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// ─── Operator view ───────────────────────────────────────────────────────────
export function OperatorAvailabilityPanel({ user }) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('calendar'); // 'calendar' | 'list'
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ start_date: '', end_date: '', type: 'unavailable', notes: '' });
  const [calMonth, setCalMonth] = useState(new Date());

  const { data: allEntries = [] } = useQuery({
    queryKey: ['operatorAvailability'],
    queryFn: () => base44.entities.OperatorAvailability.list('-start_date', 500),
  });

  const myEntries = allEntries.filter(e => e.operator_email === user?.email);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const upcoming = [...myEntries].filter(e => e.end_date >= todayStr).sort((a, b) => a.start_date.localeCompare(b.start_date));

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['operatorAvailability'] });

  const handleAdd = async () => {
    if (!form.start_date || !form.end_date) return;
    await base44.entities.OperatorAvailability.create({
      operator_email: user.email,
      operator_name: user.full_name || user.email,
      start_date: form.start_date,
      end_date: form.end_date,
      type: form.type,
      notes: form.notes,
    });
    refresh();
    setShowForm(false);
    setForm({ start_date: '', end_date: '', type: 'unavailable', notes: '' });
  };

  const handleRemove = async (id) => {
    await base44.entities.OperatorAvailability.delete(id);
    refresh();
  };

  const calDays = getCalendarGrid(calMonth);
  const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <Card className="bg-gray-900 border-gray-800 mb-6">
      <CardHeader className="border-b border-gray-800 pb-3">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 text-white font-semibold text-base hover:text-blue-400 transition-colors">
          <CalendarDays className="h-4 w-4 text-purple-400" />
          My Availability
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
          <span className="text-xs bg-purple-600/20 text-purple-400 border border-purple-700/40 px-2 py-0.5 rounded-full ml-1">
            {upcoming.length} upcoming
          </span>
        </button>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-4">
          <p className="text-xs text-gray-500 mb-3">Let admins know when you're in or out. Only admins can see this.</p>

          {/* Tab switcher */}
          <div className="flex gap-1 mb-4 bg-gray-800 rounded-lg p-1 w-fit">
            <button onClick={() => setTab('calendar')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'calendar' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              Calendar
            </button>
            <button onClick={() => setTab('list')}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === 'list' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              List
            </button>
          </div>

          {/* Add button (always visible) */}
          {!showForm && (
            <Button size="sm" variant="outline" className="border-purple-700/50 text-purple-400 hover:bg-purple-900/30 h-7 text-xs gap-1 mb-4"
              onClick={() => setShowForm(true)}>
              <Plus className="h-3 w-3" /> Add Availability
            </Button>
          )}

          {/* Add form */}
          {showForm && (
            <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-3 mb-4">
              <div className="flex gap-2">
                <button onClick={() => setForm({ ...form, type: 'unavailable' })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.type === 'unavailable' ? 'bg-red-700/40 border-red-600/50 text-red-300' : 'border-gray-700 text-gray-500 hover:text-white'}`}>
                  OUT (Unavailable)
                </button>
                <button onClick={() => setForm({ ...form, type: 'available' })}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.type === 'available' ? 'bg-green-700/40 border-green-600/50 text-green-300' : 'border-gray-700 text-gray-500 hover:text-white'}`}>
                  IN (Available)
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">From</label>
                  <Input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                    className="bg-gray-900 border-gray-700 text-white h-8 text-xs" />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">To</label>
                  <Input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
                    className="bg-gray-900 border-gray-700 text-white h-8 text-xs" />
                </div>
              </div>
              <Input placeholder="Notes (optional)" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                className="bg-gray-900 border-gray-700 text-white h-8 text-xs" />
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs bg-purple-700 hover:bg-purple-600 px-4" onClick={handleAdd}>Save</Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-500" onClick={() => setShowForm(false)}>Cancel</Button>
              </div>
            </div>
          )}

          {/* Calendar tab */}
          {tab === 'calendar' && (
            <>
              <div className="flex items-center gap-2 mb-3">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white" onClick={() => setCalMonth(subMonths(calMonth, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm text-gray-300 font-medium w-28 text-center">{format(calMonth, 'MMMM yyyy')}</span>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white" onClick={() => setCalMonth(addMonths(calMonth, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
                {DOW.map(d => <div key={d} className="text-xs text-gray-500 py-1">{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {calDays.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const inMonth = isSameMonth(day, calMonth);
                  const myDay = myEntries.find(e => entryCoversDate(e, dateStr));
                  const isToday = dateStr === todayStr;

                  let bg = 'rgba(31,41,55,0.4)';
                  let textCls = 'text-gray-600';
                  let label = null;
                  if (myDay) {
                    if (myDay.type === 'unavailable') { bg = 'rgba(127,29,29,0.4)'; textCls = 'text-red-300'; label = <div className="text-xs text-red-400 mt-0.5">OUT</div>; }
                    else { bg = 'rgba(20,83,45,0.4)'; textCls = 'text-green-300'; label = <div className="text-xs text-green-400 mt-0.5">IN</div>; }
                  }

                  return (
                    <div key={dateStr}
                      className={`rounded-md p-1 min-h-[44px] text-center ${!inMonth ? 'opacity-25' : ''} ${isToday ? 'ring-1 ring-blue-500' : ''}`}
                      style={{ background: bg }}
                    >
                      <span className={`text-xs font-medium ${isToday ? 'text-blue-400' : textCls}`}>{format(day, 'd')}</span>
                      {inMonth && label}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-4 mt-3">
                <span className="flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="w-3 h-3 rounded bg-red-700/50 inline-block" /> Unavailable
                </span>
                <span className="flex items-center gap-1.5 text-xs text-gray-400">
                  <span className="w-3 h-3 rounded bg-green-700/50 inline-block" /> Available
                </span>
              </div>
            </>
          )}

          {/* List tab */}
          {tab === 'list' && (
            upcoming.length === 0 ? (
              <p className="text-gray-600 text-sm">No upcoming entries.</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map(entry => (
                  <div key={entry.id} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border ${
                    entry.type === 'unavailable' ? 'bg-red-950/30 border-red-800/40' : 'bg-green-950/30 border-green-800/40'
                  }`}>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        entry.type === 'unavailable' ? 'bg-red-700/30 text-red-300' : 'bg-green-700/30 text-green-300'
                      }`}>
                        {entry.type === 'unavailable' ? 'OUT' : 'IN'}
                      </span>
                      <span className="text-xs text-gray-300">{entry.start_date} → {entry.end_date}</span>
                      {entry.notes && <span className="text-xs text-gray-500 italic">{entry.notes}</span>}
                    </div>
                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-600 hover:text-red-400"
                      onClick={() => handleRemove(entry.id)}>
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )
          )}
        </CardContent>
      )}
    </Card>
  );
}