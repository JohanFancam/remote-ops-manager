import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Trash2, Download, Plus, X, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';

import { format } from 'date-fns';
import jsPDF from 'jspdf';

const statusColors = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  approved: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  paid: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const entryTypeLabel = { clock: 'Clock', coffee_break: 'Coffee', lunch_break: 'Lunch', manual: 'Manual', shoot: 'Shoot', standby: 'Standby' };

function exportTimesheetPDF(entries, title = 'Timesheet Report') {
  const doc = new jsPDF();
  doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.text('Remote Ops Manager — Timesheet', 20, 20);
  doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  doc.text(title, 20, 30);
  doc.setFontSize(8); doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${new Date().toLocaleDateString()}`, 20, 38);
  let y = 52;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('Operator', 20, y); doc.text('Date', 75, y); doc.text('Hours', 110, y); doc.text('Type', 130, y); doc.text('Notes', 155, y);
  doc.setDrawColor(180, 180, 180); doc.line(20, y + 3, 190, y + 3); y += 10;
  doc.setFont('helvetica', 'normal');
  entries.forEach(e => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text((e.operator_name || e.operator_email || '').substring(0, 20), 20, y);
    doc.text(e.date || '', 75, y);
    doc.text(`${Number(e.hours || 0).toFixed(2)}h`, 110, y);
    doc.text(entryTypeLabel[e.entry_type] || 'Manual', 130, y);
    doc.text((e.notes || '').substring(0, 30), 155, y);
    y += 9;
  });
  const totalHours = entries.reduce((s, e) => s + (e.hours || 0), 0);
  doc.line(20, y + 2, 190, y + 2); y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL HOURS', 20, y);
  doc.text(`${totalHours.toFixed(2)}h`, 110, y);
  doc.save(`${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
}

function ManualAddForm({ onAdd, onClose, shoots = [] }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [form, setForm] = useState({ date: today, hours: '', notes: '', shoot_id: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.hours || isNaN(Number(form.hours))) return;
    setSaving(true);
    await onAdd(form);
    setSaving(false);
    onClose();
  };

  return (
    <Card className="bg-gray-800 border-gray-700 mb-4">
      <CardHeader className="pb-3 border-b border-gray-700">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-sm flex items-center gap-2">
            <Plus className="h-4 w-4 text-blue-400" /> Add Manual Time Entry
          </CardTitle>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <form onSubmit={handleSubmit} className="grid grid-cols-2 md:grid-cols-4 gap-3 items-end">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Date</label>
            <Input
              type="date"
              value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })}
              className="bg-gray-700 border-gray-600 text-white h-9 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Hours</label>
            <Input
              type="number"
              step="0.25"
              min="0"
              placeholder="e.g. 4.5"
              value={form.hours}
              onChange={e => setForm({ ...form, hours: e.target.value })}
              className="bg-gray-700 border-gray-600 text-white h-9 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Linked Shoot (optional)</label>
            <select
              value={form.shoot_id}
              onChange={e => setForm({ ...form, shoot_id: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded-md px-2 h-9"
            >
              <option value="">— none —</option>
              {shoots.slice(0, 50).map(s => (
                <option key={s.id} value={s.id}>{s.title} ({s.date})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Notes</label>
            <Input
              placeholder="Optional note"
              value={form.notes}
              onChange={e => setForm({ ...form, notes: e.target.value })}
              className="bg-gray-700 border-gray-600 text-white h-9 text-sm"
            />
          </div>
          <div className="col-span-2 md:col-span-4 flex justify-end">
            <Button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 h-9 text-sm">
              {saving ? 'Saving...' : 'Add Entry'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function Timesheets() {
  const { user, isAdmin } = useApp();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'));

  const { data: entries = [] } = useQuery({
    queryKey: ['timeEntries'],
    queryFn: () => base44.entities.TimeEntry.list('-date', 500),
  });

  const { data: shoots = [] } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list('-date', 1000),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['timeEntries'] });

  const handleAddManual = async (form) => {
    const linkedShoot = shoots.find(s => s.id === form.shoot_id);
    await base44.entities.TimeEntry.create({
      operator_email: user.email,
      operator_name: user.full_name,
      shoot_id: form.shoot_id || undefined,
      date: form.date,
      hours: parseFloat(Number(form.hours).toFixed(4)),
      rate: 0,
      total: 0,
      notes: form.notes || (linkedShoot ? linkedShoot.title : 'Manual entry'),
      entry_type: 'manual',
      status: 'approved',
    });
    refresh();
  };

  const handleDelete = async (id) => {
    await base44.entities.TimeEntry.delete(id);
    refresh();
  };

  const updateStatus = async (id, status) => {
    await base44.entities.TimeEntry.update(id, { status });
    refresh();
  };

  // Show only the current user's shoots (assigned or standby) for the selected month
  const myEmail = user?.email;
  const monthShoots = shoots.filter(s =>
    s.date?.startsWith(filterMonth) &&
    s.status !== 'cancelled' &&
    (s.assigned_operators?.includes(myEmail) || s.standby_admin === myEmail)
  );

  // Build rows: one per shoot, merged with any existing TimeEntry
  const shootRows = monthShoots.map(shoot => {
    const isStandby = shoot.standby_admin === myEmail && !shoot.assigned_operators?.includes(myEmail);
    const existingEntry = entries.find(e => e.shoot_id === shoot.id && e.operator_email === myEmail);
    if (existingEntry) return { ...existingEntry, _synthetic: false, _shootTitle: shoot.title };
    return {
      _synthetic: true,
      id: `syn_${shoot.id}`,
      shoot_id: shoot.id,
      date: shoot.date,
      operator_email: myEmail,
      operator_name: user?.full_name || myEmail,
      hours: null,
      entry_type: isStandby ? 'standby' : 'shoot',
      notes: shoot.title,
      status: 'pending',
      _shootTitle: shoot.title,
    };
  });

  // Also include manual entries not linked to any shoot
  const manualEntries = entries.filter(e =>
    e.operator_email === myEmail &&
    e.date?.startsWith(filterMonth) &&
    (!e.shoot_id || !monthShoots.find(s => s.id === e.shoot_id))
  ).map(e => ({ ...e, _synthetic: false }));

  const filtered = [...shootRows, ...manualEntries].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const totalHours = filtered.reduce((s, e) => s + (Number(e.hours) || 0), 0);

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return format(d, 'yyyy-MM');
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Timesheets</h1>
          <div className="flex gap-2">
            <Button onClick={() => setShowAddForm(!showAddForm)} className="bg-blue-600 hover:bg-blue-700 gap-2 h-9">
              <Plus className="h-4 w-4" /> Add Entry
            </Button>
            <Button onClick={() => exportTimesheetPDF(filtered, `Timesheet ${filterMonth}`)} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2 h-9">
              <Download className="h-4 w-4" /> Export PDF
            </Button>
          </div>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-5">
              <p className="text-gray-400 text-sm">Total Hours</p>
              <p className="text-2xl font-bold text-white mt-1">{totalHours.toFixed(1)}h</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-5">
              <p className="text-gray-400 text-sm">Entries</p>
              <p className="text-2xl font-bold text-white mt-1">{filtered.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-5">
              <p className="text-gray-400 text-sm">Avg per Entry</p>
              <p className="text-2xl font-bold text-white mt-1">
                {filtered.length > 0 ? (totalHours / filtered.length).toFixed(1) : '0'}h
              </p>
            </CardContent>
          </Card>
        </div>

        {showAddForm && (
          <ManualAddForm onAdd={handleAddManual} onClose={() => setShowAddForm(false)} shoots={shoots} />
        )}

        {/* Filters */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-40 bg-gray-900 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              {monthOptions.map(m => (
                <SelectItem key={m} value={m} className="text-white">{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Entries */}
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-0">
            <div className="divide-y divide-gray-800">
              {filtered.length === 0 ? (
                <p className="text-gray-500 text-sm p-8 text-center">No time entries for this period.</p>
              ) : filtered.map(entry => {
                const canDelete = isAdmin || entry.operator_email === user?.email;
                return (
                  <div key={entry.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <Clock className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                        <span className="font-medium text-white text-sm truncate">{entry._shootTitle || entry.notes || entry.operator_name || entry.operator_email}</span>
                        <Badge className="text-xs border border-gray-600 bg-gray-700/50 text-gray-400">{entryTypeLabel[entry.entry_type] || 'Manual'}</Badge>
                      </div>
                      <p className="text-xs text-gray-400">
                        {entry.date} · <span className="font-mono text-white font-bold">{entry.hours != null ? `${Number(entry.hours).toFixed(2)}h` : '—'}</span>
                      </p>
                      {entry.notes && !entry._shootTitle && <p className="text-xs text-gray-500 mt-0.5">{entry.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {canDelete && !entry._synthetic && (
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-600 hover:text-red-400 hover:bg-gray-800" onClick={() => handleDelete(entry.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}