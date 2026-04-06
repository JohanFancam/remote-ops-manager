import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarDays, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';
import { getDisplayName } from '../utils/nameUtils';

// Admin view — shows all operators' availability entries
export function AdminAvailabilityView({ allUsers = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [monthFilter, setMonthFilter] = useState(format(new Date(), 'yyyy-MM'));

  const { data: entries = [] } = useQuery({
    queryKey: ['operatorAvailability'],
    queryFn: () => base44.entities.OperatorAvailability.list('-start_date', 500),
  });

  const filtered = entries.filter(e => {
    return e.start_date?.startsWith(monthFilter) || e.end_date?.startsWith(monthFilter) ||
      (e.start_date < monthFilter && e.end_date > monthFilter);
  });

  const operators = allUsers.filter(u => u.role === 'user');

  return (
    <Card className="bg-gray-900 border-gray-800 mb-6">
      <CardHeader className="border-b border-gray-800 pb-3">
        <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-2 text-white font-semibold text-base hover:text-blue-400 transition-colors">
          <CalendarDays className="h-4 w-4 text-purple-400" />
          Operator Availability
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
          <span className="text-xs bg-purple-600/20 text-purple-400 border border-purple-700/40 px-2 py-0.5 rounded-full ml-1">
            {filtered.filter(e => e.type === 'unavailable').length} unavailable this month
          </span>
        </button>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-4">
          <div className="mb-3 flex items-center gap-2">
            <label className="text-xs text-gray-400">Month:</label>
            <Input type="month" value={monthFilter} onChange={e => setMonthFilter(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white h-7 text-xs w-36" />
          </div>
          {filtered.length === 0 ? (
            <p className="text-gray-600 text-sm">No availability entries for this month.</p>
          ) : (
            <div className="space-y-2">
              {filtered.map(entry => {
                const u = allUsers.find(u => u.email === entry.operator_email);
                const name = getDisplayName(u, entry.operator_email, entry.operator_name);
                return (
                  <div key={entry.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
                    entry.type === 'unavailable'
                      ? 'bg-red-950/30 border-red-800/40'
                      : 'bg-green-950/30 border-green-800/40'
                  }`}>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                      entry.type === 'unavailable' ? 'bg-red-700/30 text-red-300' : 'bg-green-700/30 text-green-300'
                    }`}>
                      {entry.type === 'unavailable' ? 'OUT' : 'IN'}
                    </span>
                    <span className="text-sm text-white font-medium">{name}</span>
                    <span className="text-xs text-gray-400">{entry.start_date} → {entry.end_date}</span>
                    {entry.notes && <span className="text-xs text-gray-500 italic">{entry.notes}</span>}
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

// Remote operator view — add/remove their own availability
export function OperatorAvailabilityPanel({ user }) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ start_date: '', end_date: '', type: 'unavailable', notes: '' });

  const { data: allEntries = [] } = useQuery({
    queryKey: ['operatorAvailability'],
    queryFn: () => base44.entities.OperatorAvailability.list('-start_date', 500),
  });

  const myEntries = allEntries.filter(e => e.operator_email === user?.email);
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const upcoming = myEntries.filter(e => e.end_date >= todayStr).sort((a, b) => a.start_date.localeCompare(b.start_date));

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

          {/* Add form */}
          {showForm ? (
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
          ) : (
            <Button size="sm" variant="outline" className="border-purple-700/50 text-purple-400 hover:bg-purple-900/30 h-7 text-xs gap-1 mb-4"
              onClick={() => setShowForm(true)}>
              <Plus className="h-3 w-3" /> Add Availability
            </Button>
          )}

          {/* List */}
          {upcoming.length === 0 ? (
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
          )}
        </CardContent>
      )}
    </Card>
  );
}