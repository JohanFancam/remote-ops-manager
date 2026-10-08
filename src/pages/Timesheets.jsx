import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Clock, Trash2, Download, Plus, X, ChevronLeft, ChevronRight, ChevronDown, Edit2, Save } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';

// Day types
const DAY_TYPES = [
  { value: 'work_day', label: 'Work Day', color: 'bg-slate-800 text-slate-400 border-slate-800' },
  { value: 'shoot', label: 'Shoot', color: 'bg-blue-950/40 text-blue-400 border-blue-800' },
  { value: 'standby', label: 'Standby', color: 'bg-yellow-900/30 text-amber-400 border-yellow-700/50' },
  { value: 'shoot_standby', label: 'Shoot/Standby', color: 'bg-purple-900/30 text-purple-400 border-purple-700/50' },
];

function getDayTypeInfo(type) {
  return DAY_TYPES.find(d => d.value === type) || DAY_TYPES[0];
}

function exportTimesheetPDF(dayEntries, title = 'Timesheet Report') {
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
  doc.text('Date', 20, y); doc.text('Type', 70, y); doc.text('Hours', 120, y); doc.text('Notes', 145, y);
  doc.setDrawColor(180, 180, 180); doc.line(20, y + 3, 190, y + 3); y += 10;
  doc.setFont('helvetica', 'normal');
  dayEntries.forEach(e => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text(e.date || '', 20, y);
    doc.text(getDayTypeInfo(e.day_type).label, 70, y);
    doc.text(`${Number(e.hours || 0).toFixed(2)}h`, 120, y);
    doc.text((e.notes || '').substring(0, 35), 145, y);
    y += 9;
  });
  const totalHours = dayEntries.reduce((s, e) => s + (e.hours || 0), 0);
  doc.line(20, y + 2, 190, y + 2); y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('TOTAL HOURS', 20, y);
  doc.text(`${totalHours.toFixed(2)}h`, 120, y);
  doc.save(`${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
}

function AddEntryForm({ onAdd, onClose }) {
  const today = format(new Date(), 'yyyy-MM-dd');
  const [form, setForm] = useState({
    date: today,
    day_type: 'work_day',
    start_time: '',
    end_time: '',
    hours: '',
    notes: '',
  });

  const calcHours = () => {
    if (!form.start_time || !form.end_time) return null;
    const [sh, sm] = form.start_time.split(':').map(Number);
    const [eh, em] = form.end_time.split(':').map(Number);
    const mins = (eh * 60 + em) - (sh * 60 + sm);
    return mins > 0 ? parseFloat((mins / 60).toFixed(2)) : null;
  };

  const derivedHours = calcHours();
  const effectiveHours = form.start_time && form.end_time ? derivedHours : (form.hours ? parseFloat(form.hours) : null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!effectiveHours) return;
    await onAdd({
      date: form.date,
      day_type: form.day_type,
      hours: effectiveHours,
      notes: form.notes,
    });
    onClose();
  };

  return (
    <Card className="bg-slate-800 border-slate-800 mb-4">
      <CardHeader className="pb-3 border-b border-slate-800">
        <div className="flex items-center justify-between">
          <CardTitle className="text-slate-100 text-sm flex items-center gap-2">
            <Plus className="h-4 w-4 text-orange-400" /> Add Work Day Entry
          </CardTitle>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-100"><X className="h-4 w-4" /></button>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Date</label>
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })}
                className="bg-slate-700 border-slate-700 text-slate-100 h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Type</label>
              <select value={form.day_type} onChange={e => setForm({ ...form, day_type: e.target.value })}
                className="w-full bg-slate-700 border border-slate-700 text-slate-100 rounded-md px-2 py-2 text-sm h-9">
                {DAY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">Start Time</label>
              <Input type="time" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })}
                className="bg-slate-700 border-slate-700 text-slate-100 h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 mb-1 block">End Time</label>
              <Input type="time" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })}
                className="bg-slate-700 border-slate-700 text-slate-100 h-9 text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-slate-400 mb-1 block">
                Hours {form.start_time && form.end_time ? '(auto)' : '(manual)'}
              </label>
              {form.start_time && form.end_time ? (
                <div className="h-9 flex items-center px-3 bg-slate-900 border border-slate-800 rounded-md font-mono text-sm text-slate-100">
                  {derivedHours ? `${derivedHours}h` : '—'}
                </div>
              ) : (
                <Input type="number" step="0.25" min="0" placeholder="e.g. 9.5"
                  value={form.hours} onChange={e => setForm({ ...form, hours: e.target.value })}
                  className="bg-slate-700 border-slate-700 text-slate-100 h-9 text-sm" />
              )}
            </div>
            <div className="col-span-1 md:col-span-3">
              <label className="text-xs text-slate-400 mb-1 block">Notes (optional)</label>
              <Input placeholder="e.g. Lakers shoot + travel" value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                className="bg-slate-700 border-slate-700 text-slate-100 h-9 text-sm" />
            </div>
          </div>
          <div className="text-xs text-slate-500">
            💡 Each day has one entry with a total duration. Multiple shoots/standby on the same day don't multiply hours.
          </div>
          <Button type="submit" disabled={!effectiveHours} className="bg-orange-500 hover:bg-orange-400 h-9 text-sm">
            Add Entry
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function DayBlock({ entry, isAdmin, userEmail, onDelete, onEdit }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ hours: entry.hours, notes: entry.notes || '', day_type: entry.day_type || 'work_day' });

  const isToday = entry.date === format(new Date(), 'yyyy-MM-dd');
  const dayLabel = format(new Date(entry.date + 'T12:00:00'), 'EEE');
  const dayNum = format(new Date(entry.date + 'T12:00:00'), 'd');
  const monthLabel = format(new Date(entry.date + 'T12:00:00'), 'MMM');
  const canModify = isAdmin || entry.operator_email === userEmail;
  const typeInfo = getDayTypeInfo(entry.day_type || 'work_day');

  const handleSave = async () => {
    await onEdit(entry.id, {
      hours: parseFloat(editForm.hours),
      notes: editForm.notes,
      day_type: editForm.day_type,
    });
    setEditing(false);
  };

  return (
    <div className={`rounded-xl border transition-colors ${isToday ? 'border-blue-500 bg-blue-950/40' : 'border-slate-800 bg-slate-900'}`}>
      <button className="w-full flex items-center gap-4 p-4 text-left" onClick={() => setOpen(!open)}>
        <div className={`flex-shrink-0 w-14 h-14 rounded-lg flex flex-col items-center justify-center ${isToday ? 'bg-orange-500' : 'bg-slate-800'}`}>
          <span className="text-xs text-slate-400 leading-none">{dayLabel}</span>
          <span className="text-xl font-bold text-slate-100 leading-tight">{dayNum}</span>
          <span className="text-xs text-slate-400 leading-none">{monthLabel}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-1">
            <span className={`text-xs px-2 py-0.5 rounded-full border ${typeInfo.color}`}>
              {typeInfo.label}
            </span>
            {entry.notes && (
              <span className="text-xs text-slate-500 truncate max-w-xs">{entry.notes}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="font-mono font-bold text-lg text-slate-100">
            {entry.hours ? `${Number(entry.hours).toFixed(1)}h` : '—'}
          </span>
          <ChevronDown className={`h-4 w-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-slate-800 pt-3">
          {editing ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Type</label>
                  <select value={editForm.day_type} onChange={e => setEditForm({ ...editForm, day_type: e.target.value })}
                    className="w-full bg-slate-700 border border-slate-700 text-slate-100 rounded-md px-2 py-1.5 text-sm">
                    {DAY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Hours</label>
                  <Input type="number" step="0.25" min="0" value={editForm.hours}
                    onChange={e => setEditForm({ ...editForm, hours: e.target.value })}
                    className="bg-slate-700 border-slate-700 text-slate-100 h-8 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Notes</label>
                  <Input value={editForm.notes} onChange={e => setEditForm({ ...editForm, notes: e.target.value })}
                    className="bg-slate-700 border-slate-700 text-slate-100 h-8 text-sm" />
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="bg-orange-500 hover:bg-orange-400 h-7 gap-1 text-xs" onClick={handleSave}>
                  <Save className="h-3 w-3" /> Save
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-400" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className={`text-xs border ${typeInfo.color}`}>{typeInfo.label}</Badge>
                  <span className="font-mono font-bold text-slate-100">{Number(entry.hours).toFixed(2)}h</span>
                </div>
                {entry.notes && <p className="text-sm text-slate-400">{entry.notes}</p>}
                <p className="text-xs text-gray-600">Added: {entry.operator_name || entry.operator_email}</p>
              </div>
              {canModify && (
                <div className="flex gap-1 flex-shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500 hover:text-orange-400 hover:bg-slate-800" onClick={() => setEditing(true)}>
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-600 hover:text-red-400 hover:bg-slate-800" onClick={() => onDelete(entry.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
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

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['timeEntries'] });

  const handleAdd = async (form) => {
    await base44.entities.TimeEntry.create({
      operator_email: user.email,
      operator_name: user.full_name,
      date: form.date,
      hours: form.hours,
      notes: form.notes || '',
      day_type: form.day_type,
      entry_type: 'manual',
      status: 'approved',
    });
    refresh();
  };

  const handleDelete = async (id) => {
    await base44.entities.TimeEntry.delete(id);
    refresh();
  };

  const handleEdit = async (id, data) => {
    await base44.entities.TimeEntry.update(id, data);
    refresh();
  };

  const myEmail = user?.email;

  // Filter to this user's entries for this month
  // Group by date — take ONE entry per date (no double-counting)
  const filtered = entries
    .filter(e => e.operator_email === myEmail && e.date?.startsWith(filterMonth))
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  // Deduplicate by date: only show one entry per date (most recent if multiple)
  const byDate = {};
  filtered.forEach(e => {
    if (!byDate[e.date] || e.updated_date > byDate[e.date].updated_date) {
      byDate[e.date] = e;
    }
  });
  const dedupedEntries = Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));

  const totalHours = dedupedEntries.reduce((s, e) => s + (Number(e.hours) || 0), 0);

  const goMonth = (delta) => {
    const [y, m] = filterMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setFilterMonth(format(d, 'yyyy-MM'));
  };

  return (
    <div className="min-h-screen bg-slate-800 text-slate-100 p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Timesheets</h1>
          <div className="flex gap-2">
            <Button onClick={() => setShowAddForm(!showAddForm)} className="bg-orange-500 hover:bg-orange-400 gap-2 h-9">
              <Plus className="h-4 w-4" /> Add Entry
            </Button>
            <Button onClick={() => exportTimesheetPDF(dedupedEntries, `Timesheet ${filterMonth}`)}
              variant="outline" className="border-slate-800 text-slate-400 hover:bg-slate-800 gap-2 h-9">
              <Download className="h-4 w-4" /> Export PDF
            </Button>
          </div>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-100 hover:bg-slate-800" onClick={() => goMonth(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-semibold text-slate-100">
            {format(new Date(filterMonth + '-01'), 'MMMM yyyy')}
          </h2>
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-100 hover:bg-slate-800" onClick={() => goMonth(1)}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-5">
              <p className="text-slate-400 text-sm">Total Hours</p>
              <p className="text-2xl font-bold text-slate-100 mt-1">{totalHours.toFixed(1)}h</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-5">
              <p className="text-slate-400 text-sm">Work Days</p>
              <p className="text-2xl font-bold text-slate-100 mt-1">{dedupedEntries.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-5">
              <p className="text-slate-400 text-sm">Shoot Days</p>
              <p className="text-2xl font-bold text-orange-400 mt-1">
                {dedupedEntries.filter(e => e.day_type === 'shoot' || e.day_type === 'shoot_standby').length}
              </p>
            </CardContent>
          </Card>
        </div>

        {showAddForm && (
          <AddEntryForm onAdd={handleAdd} onClose={() => setShowAddForm(false)} />
        )}

        <div className="mb-4 text-xs text-slate-500 bg-slate-900 border border-slate-800 rounded-lg px-4 py-3">
          💡 <strong className="text-slate-400">One entry per day</strong> — multiple shoots or standby on the same day are recorded as one duration. Use <em>Shoot/Standby</em> type if both apply. Hours don't stack per shoot.
        </div>

        {dedupedEntries.length === 0 ? (
          <div className="text-center py-16 text-slate-500">No entries for this month. Use "Add Entry" to log time.</div>
        ) : (
          <div className="space-y-3">
            {dedupedEntries.map(entry => (
              <DayBlock
                key={entry.id}
                entry={entry}
                isAdmin={isAdmin}
                userEmail={user?.email}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}