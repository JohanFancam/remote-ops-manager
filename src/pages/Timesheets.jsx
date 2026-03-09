import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Trash2, Play, Square, Coffee, UtensilsCrossed, Download } from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';

const statusColors = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  approved: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  paid: 'bg-green-500/20 text-green-400 border-green-500/30',
};

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
  doc.text('Operator', 20, y); doc.text('Date', 70, y); doc.text('Hours', 100, y);
  doc.text('Rate', 115, y); doc.text('Total', 135, y); doc.text('Status', 160, y);
  doc.setDrawColor(180, 180, 180); doc.line(20, y + 3, 190, y + 3); y += 10;
  doc.setFont('helvetica', 'normal');
  entries.forEach(e => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text((e.operator_name || e.operator_email || '').substring(0, 20), 20, y);
    doc.text(e.date || '', 70, y);
    doc.text(String(e.hours || 0), 100, y);
    doc.text(e.rate ? `R${e.rate}` : '-', 115, y);
    doc.text(`R${(e.total || 0).toLocaleString()}`, 135, y);
    doc.text(e.status || '', 160, y);
    y += 9;
  });
  const totalHours = entries.reduce((s, e) => s + (e.hours || 0), 0);
  const grandTotal = entries.reduce((s, e) => s + (e.total || 0), 0);
  doc.line(20, y + 2, 190, y + 2); y += 8;
  doc.setFont('helvetica', 'bold');
  doc.text('TOTALS', 20, y);
  doc.text(`${totalHours.toFixed(1)}h`, 100, y);
  doc.text(`R${grandTotal.toLocaleString()}`, 135, y);
  doc.save(`${title.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`);
}

// Active timer component
function ActiveTimer({ onStop }) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const iv = setInterval(() => setElapsed(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(iv);
  }, []);

  const h = Math.floor(elapsed / 3600);
  const m = Math.floor((elapsed % 3600) / 60);
  const s = elapsed % 60;

  return (
    <div className="flex items-center gap-3 bg-green-950/50 border border-green-800 rounded-xl px-4 py-3">
      <div className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
      <span className="font-mono text-green-300 text-xl font-bold">
        {String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
      </span>
      <span className="text-green-400 text-sm flex-1">Timer running</span>
      <Button onClick={() => onStop(elapsed)} className="bg-red-700 hover:bg-red-600 h-8 px-3 text-xs">
        <Square className="h-3.5 w-3.5 mr-1.5" /> Stop
      </Button>
    </div>
  );
}

export default function Timesheets() {
  const { user, isAdmin } = useApp();
  const queryClient = useQueryClient();
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerNote, setTimerNote] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterOperator, setFilterOperator] = useState('all');

  const { data: entries = [] } = useQuery({
    queryKey: ['timeEntries'],
    queryFn: () => base44.entities.TimeEntry.list('-date', 500),
  });

  const { data: shoots = [] } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list('-date', 100),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['timeEntries'] });

  const logEntry = async (hours, note, type = 'manual') => {
    const today = format(new Date(), 'yyyy-MM-dd');
    await base44.entities.TimeEntry.create({
      operator_email: user.email,
      operator_name: user.full_name,
      date: today,
      hours: parseFloat(hours.toFixed(4)),
      rate: 0,
      total: 0,
      notes: note,
      entry_type: type,
    });
    refresh();
  };

  const handleStopTimer = async (elapsedSeconds) => {
    setTimerRunning(false);
    const hours = elapsedSeconds / 3600;
    await logEntry(hours, timerNote || 'Clock entry', 'clock');
    setTimerNote('');
  };

  const handleBreak = async (minutes, type, label) => {
    await logEntry(minutes / 60, label, type);
  };

  const updateStatus = async (id, status) => {
    await base44.entities.TimeEntry.update(id, { status });
    refresh();
  };

  const handleDelete = async (id) => {
    await base44.entities.TimeEntry.delete(id);
    refresh();
  };

  let filtered = isAdmin ? entries : entries.filter(e => e.operator_email === user?.email);
  if (filterStatus !== 'all') filtered = filtered.filter(e => e.status === filterStatus);
  if (isAdmin && filterOperator !== 'all') filtered = filtered.filter(e => e.operator_email === filterOperator);

  const operators = [...new Set(entries.map(e => e.operator_email).filter(Boolean))];
  const totalHours = filtered.reduce((s, e) => s + (e.hours || 0), 0);
  const totalPending = filtered.filter(e => e.status === 'pending').reduce((s, e) => s + (e.total || 0), 0);
  const totalPaid = filtered.filter(e => e.status === 'paid').reduce((s, e) => s + (e.total || 0), 0);

  const entryTypeIcon = { clock: '⏱', coffee_break: '☕', lunch_break: '🍽', manual: '📝' };
  const entryTypeLabel = { clock: 'Clock', coffee_break: 'Coffee', lunch_break: 'Lunch', manual: 'Manual' };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Timesheets</h1>
          <Button onClick={() => exportTimesheetPDF(filtered, 'Timesheet Report')} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
            <Download className="h-4 w-4" /> Export PDF
          </Button>
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
              <p className="text-gray-400 text-sm">Pending</p>
              <p className="text-2xl font-bold text-yellow-400 mt-1">R {totalPending.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-5">
              <p className="text-gray-400 text-sm">Paid</p>
              <p className="text-2xl font-bold text-green-400 mt-1">R {totalPaid.toLocaleString()}</p>
            </CardContent>
          </Card>
        </div>

        {/* Timer Controls — Admin only */}
        {isAdmin && (
          <Card className="bg-gray-900 border-gray-800 mb-6">
            <CardHeader className="border-b border-gray-800 pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-400" /> Time Tracker
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {timerRunning ? (
                <ActiveTimer onStop={handleStopTimer} />
              ) : (
                <>
                  <Input
                    placeholder="Optional note for this time entry..."
                    value={timerNote}
                    onChange={e => setTimerNote(e.target.value)}
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button onClick={() => setTimerRunning(true)} className="bg-green-700 hover:bg-green-600 gap-2">
                      <Play className="h-4 w-4" /> Start Timer
                    </Button>
                    <Button onClick={() => handleBreak(15, 'coffee_break', '☕ Coffee Break')} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
                      <Coffee className="h-4 w-4" /> Coffee Break (15min)
                    </Button>
                    <Button onClick={() => handleBreak(60, 'lunch_break', '🍽 Lunch Break')} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
                      <UtensilsCrossed className="h-4 w-4" /> Lunch Break (1hr)
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex gap-3 mb-4 flex-wrap">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36 bg-gray-900 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              <SelectItem value="all" className="text-white">All Status</SelectItem>
              {['pending', 'approved', 'paid'].map(s => (
                <SelectItem key={s} value={s} className="text-white capitalize">{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Select value={filterOperator} onValueChange={setFilterOperator}>
              <SelectTrigger className="w-52 bg-gray-900 border-gray-700 text-white">
                <SelectValue placeholder="All Operators" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700">
                <SelectItem value="all" className="text-white">All Operators</SelectItem>
                {operators.map(o => (
                  <SelectItem key={o} value={o} className="text-white">{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Entries */}
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-0">
            <div className="divide-y divide-gray-800">
              {filtered.length === 0 ? (
                <p className="text-gray-500 text-sm p-8 text-center">No time entries found.</p>
              ) : filtered.map(entry => {
                const linkedShoot = shoots.find(s => s.id === entry.shoot_id);
                return (
                  <div key={entry.id} className="p-4 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">{entryTypeIcon[entry.entry_type] || '📝'}</span>
                        <span className="font-medium text-white text-sm truncate">{entry.operator_name || entry.operator_email}</span>
                        <Badge className="text-xs border border-gray-600 bg-gray-700/50 text-gray-400">{entryTypeLabel[entry.entry_type] || 'Manual'}</Badge>
                      </div>
                      <p className="text-xs text-gray-400">{entry.date} · <span className="font-mono text-white">{Number(entry.hours || 0).toFixed(2)}h</span>{entry.rate > 0 && ` @ R${entry.rate}/h`}</p>
                      {linkedShoot && <p className="text-xs text-blue-400 mt-0.5">📸 {linkedShoot.title}</p>}
                      {entry.notes && <p className="text-xs text-gray-500 mt-0.5">{entry.notes}</p>}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        {entry.total > 0 && <p className="font-bold text-white text-sm">R {(entry.total || 0).toLocaleString()}</p>}
                        <Badge className={`text-xs border ${statusColors[entry.status]}`}>{entry.status}</Badge>
                      </div>
                      {isAdmin && (
                        <div className="flex flex-col gap-1">
                          {entry.status === 'pending' && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-green-400 hover:bg-gray-800" onClick={() => updateStatus(entry.id, 'approved')}>Approve</Button>
                          )}
                          {entry.status === 'approved' && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-400 hover:bg-gray-800" onClick={() => updateStatus(entry.id, 'paid')}>Mark Paid</Button>
                          )}
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-600 hover:text-red-400 hover:bg-gray-800" onClick={() => handleDelete(entry.id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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