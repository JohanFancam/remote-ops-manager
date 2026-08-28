import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Download, AlertCircle, CheckCircle2, Copy, Check,
  ChevronLeft, ChevronRight, ChevronDown, X, Trash2, Plus, Save
} from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  addMonths, subMonths, getDay, startOfYear, endOfYear, eachMonthOfInterval
} from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import DailyShootSummary from '../components/reports/DailyShootSummary';

function CopyBtn({ text }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button size="sm" variant="ghost" className="h-6 text-xs text-gray-400 hover:text-white"
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>
      {copied ? <><Check className="h-3 w-3 mr-1 text-green-400" />Copied</> : <><Copy className="h-3 w-3 mr-1" />Copy</>}
    </Button>
  );
}

function buildCSV(reports) {
  const headers = ['Date', 'Shoot Title', 'Operator', 'Had Issues', 'Notes', 'Completed At'];
  const rows = reports.map(r => [
    r.shoot_date || r.created_date?.slice(0, 10) || '',
    `"${(r.shoot_title || '').replace(/"/g, '""')}"`,
    `"${(r.operator_name || r.operator_email || '').replace(/"/g, '""')}"`,
    r.had_issues ? 'YES' : 'No',
    `"${(r.notes || '').replace(/"/g, '""')}"`,
    r.completed_at ? new Date(r.completed_at).toLocaleString() : '',
  ]);
  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function DayPanel({ date, reports, onClose, onDelete, onAdd, onEdit }) {
  const [expanded, setExpanded] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [addForm, setAddForm] = useState({ shoot_title: '', operator_name: '', had_issues: false, notes: '' });
  const [saving, setSaving] = useState(false);
  const label = format(date, 'EEE, MMMM d yyyy');
  const hasIssues = reports.filter(r => r.had_issues);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div className="relative w-full max-w-md h-full bg-gray-900 border-l border-gray-800 shadow-2xl overflow-y-auto flex flex-col"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <div>
            <p className="text-white font-bold text-base">{label}</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {reports.length} report{reports.length !== 1 ? 's' : ''}
              {hasIssues.length > 0 && <span className="text-red-400 ml-2">· {hasIssues.length} with issues</span>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" className="text-xs text-gray-400 hover:text-white gap-1.5 h-8"
              onClick={() => downloadCSV(buildCSV(reports), `Reports_${format(date, 'yyyy-MM-dd')}.csv`)}>
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
            <Button size="sm" variant="ghost" className="text-xs text-blue-400 hover:text-blue-300 gap-1 h-8"
              onClick={() => setShowAdd(!showAdd)}>
              <Plus className="h-3.5 w-3.5" /> Add
            </Button>
            <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="h-5 w-5" /></button>
          </div>
        </div>

        {showAdd && (
          <div className="px-5 py-4 border-b border-gray-800 bg-gray-800/40 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Add Manual Report</p>
            <input className="w-full bg-gray-700 border border-gray-600 rounded-md px-2 py-1.5 text-sm text-white placeholder:text-gray-500" placeholder="Shoot Title *" value={addForm.shoot_title} onChange={e => setAddForm({...addForm, shoot_title: e.target.value})} />
            <input className="w-full bg-gray-700 border border-gray-600 rounded-md px-2 py-1.5 text-sm text-white placeholder:text-gray-500" placeholder="Operator Name" value={addForm.operator_name} onChange={e => setAddForm({...addForm, operator_name: e.target.value})} />
            <textarea className="w-full bg-gray-700 border border-gray-600 rounded-md px-2 py-1.5 text-sm text-white placeholder:text-gray-500 resize-none" placeholder="Notes" rows={2} value={addForm.notes} onChange={e => setAddForm({...addForm, notes: e.target.value})} />
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                <input type="checkbox" checked={addForm.had_issues} onChange={e => setAddForm({...addForm, had_issues: e.target.checked})} className="rounded" />
                Had Issues
              </label>
              <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 gap-1 ml-auto" disabled={!addForm.shoot_title || saving}
                onClick={async () => { setSaving(true); await onAdd({ ...addForm, shoot_date: format(date, 'yyyy-MM-dd') }); setAddForm({ shoot_title: '', operator_name: '', had_issues: false, notes: '' }); setShowAdd(false); setSaving(false); }}>
                <Save className="h-3 w-3" /> {saving ? 'Saving...' : 'Save'}
              </Button>
            </div>
          </div>
        )}

        <div className="flex-1 divide-y divide-gray-800">
          {reports.map(r => (
            <div key={r.id} className="px-5 py-4">
              {editingId === r.id ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Editing Report</p>
                  <input className="w-full bg-gray-700 border border-gray-600 rounded-md px-2 py-1.5 text-sm text-white" placeholder="Shoot Title" value={editForm.shoot_title || ''} onChange={e => setEditForm({...editForm, shoot_title: e.target.value})} />
                  <input className="w-full bg-gray-700 border border-gray-600 rounded-md px-2 py-1.5 text-sm text-white" placeholder="Operator Name" value={editForm.operator_name || ''} onChange={e => setEditForm({...editForm, operator_name: e.target.value})} />
                  <textarea className="w-full bg-gray-700 border border-gray-600 rounded-md px-2 py-1.5 text-sm text-white resize-none" placeholder="Notes" rows={3} value={editForm.notes || ''} onChange={e => setEditForm({...editForm, notes: e.target.value})} />
                  <textarea className="w-full bg-gray-700 border border-gray-600 rounded-md px-2 py-1.5 text-sm text-white font-mono resize-none" placeholder="Slack Message (optional)" rows={3} value={editForm.slack_message || ''} onChange={e => setEditForm({...editForm, slack_message: e.target.value})} />
                  <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                    <input type="checkbox" checked={!!editForm.had_issues} onChange={e => setEditForm({...editForm, had_issues: e.target.checked})} />
                    Had Issues
                  </label>
                  <div className="flex gap-2">
                    <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 gap-1" disabled={saving}
                      onClick={async () => { setSaving(true); await onEdit(r.id, editForm); setEditingId(null); setSaving(false); }}>
                      <Save className="h-3 w-3" /> {saving ? 'Saving...' : 'Save'}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-500" onClick={() => setEditingId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {r.had_issues ? <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" /> : <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />}
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-white">{r.shoot_title}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{r.operator_name || r.operator_email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Badge className={r.had_issues ? 'bg-red-500/20 text-red-400 border-red-500/30 text-xs' : 'bg-green-500/20 text-green-400 border-green-500/30 text-xs'}>
                        {r.had_issues ? 'Issues' : 'Clean'}
                      </Badge>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-500 hover:text-blue-400"
                        onClick={() => { setEditingId(r.id); setEditForm({ shoot_title: r.shoot_title, operator_name: r.operator_name || '', notes: r.notes || '', slack_message: r.slack_message || '', had_issues: !!r.had_issues }); setExpanded(null); }}>
                        <span className="text-xs">✏️</span>
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-600 hover:text-red-400" onClick={() => onDelete(r.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {(r.notes || r.slack_message) && (
                    <button onClick={() => setExpanded(expanded === r.id ? null : r.id)}
                      className="mt-2 ml-6 text-xs text-blue-400 hover:text-blue-300 transition-colors">
                      {expanded === r.id ? 'Hide details' : 'View details'}
                    </button>
                  )}
                  {expanded === r.id && (
                    <div className="ml-6 mt-2 space-y-3">
                      {r.notes && (
                        <div className="bg-gray-800/60 rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-1">Notes:</p>
                          <p className="text-sm text-gray-300">{r.notes}</p>
                        </div>
                      )}
                      {r.slack_message && (
                        <div className="bg-gray-800/60 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-1">
                            <p className="text-xs text-gray-500">Slack Message:</p>
                            <CopyBtn text={r.slack_message} />
                          </div>
                          <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">{r.slack_message}</pre>
                        </div>
                      )}
                      {r.completed_at && <p className="text-xs text-gray-500">Completed: {new Date(r.completed_at).toLocaleString()}</p>}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Reports() {
  const { isAdmin } = useApp();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [allExpanded, setAllExpanded] = useState(false);

  const { data: reports = [] } = useQuery({
    queryKey: ['shootReports'],
    queryFn: () => base44.entities.ShootReport.list('-created_date', 500),
  });

  const handleDeleteReport = async (id) => {
    await base44.entities.ShootReport.delete(id);
    queryClient.invalidateQueries({ queryKey: ['shootReports'] });
  };

  const handleEditReport = async (id, data) => {
    await base44.entities.ShootReport.update(id, data);
    queryClient.invalidateQueries({ queryKey: ['shootReports'] });
  };

  const handleAddReport = async (data) => {
    await base44.entities.ShootReport.create({ ...data, operator_email: '', operator_name: data.operator_name || '' });
    queryClient.invalidateQueries({ queryKey: ['shootReports'] });
  };

  const monthStr = format(currentMonth, 'yyyy-MM');
  const monthLabel = format(currentMonth, 'MMMM yyyy');

  const monthReports = reports.filter(r => {
    const d = r.shoot_date || r.created_date?.slice(0, 10) || '';
    return d.startsWith(monthStr);
  });

  // Yearly chart
  const yearChartData = useMemo(() => {
    const yearNum = currentMonth.getFullYear();
    const months = eachMonthOfInterval({
      start: startOfYear(new Date(yearNum, 0, 1)),
      end: endOfYear(new Date(yearNum, 0, 1)),
    });
    return months.map(monthDate => {
      const mk = format(monthDate, 'yyyy-MM');
      const count = reports.filter(r => {
        const d = r.shoot_date || r.created_date?.slice(0, 10) || '';
        return d.startsWith(mk);
      }).length;
      const issues = reports.filter(r => {
        const d = r.shoot_date || r.created_date?.slice(0, 10) || '';
        return d.startsWith(mk) && r.had_issues;
      }).length;
      return { month: format(monthDate, 'MMM'), count, issues, isCurrentMonth: mk === monthStr };
    });
  }, [reports, monthStr]);

  const yearTotal = yearChartData.reduce((s, d) => s + d.count, 0);

  // Calendar grid
  const byDay = {};
  monthReports.forEach(r => {
    const d = r.shoot_date || r.created_date?.slice(0, 10) || '';
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(r);
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPad = getDay(monthStart);

  const dayReports = selectedDay ? (byDay[format(selectedDay, 'yyyy-MM-dd')] || []) : [];

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-950 text-white p-6 flex items-center justify-center">
        <p className="text-gray-500">Access restricted.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">Shoot Reports</h1>
            <p className="text-gray-400 text-sm mt-1">{monthReports.length} reports in {monthLabel}</p>
          </div>
          <Button onClick={() => downloadCSV(buildCSV(monthReports), `Reports_${format(currentMonth, 'yyyy-MM')}.csv`)}
            variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2">
            <Download className="h-4 w-4" /> Export Month
          </Button>
        </div>

        {/* Yearly chart */}
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-5">
            <div className="mb-4">
              <p className="text-sm text-gray-400">{currentMonth.getFullYear()} — Total Reports</p>
              <p className="text-2xl font-bold text-white">{yearTotal} reports</p>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={yearChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                <Tooltip
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#9ca3af' }}
                />
                <Bar dataKey="count" name="Reports" radius={[4, 4, 0, 0]}>
                  {yearChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.isCurrentMonth ? '#3b82f6' : '#374151'} />
                  ))}
                </Bar>
                <Bar dataKey="issues" name="Issues" fill="#ef4444" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2 px-1">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#374151]" /><span className="text-xs text-gray-400">Reports</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#3b82f6]" /><span className="text-xs text-gray-400">Current Month</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-red-500" /><span className="text-xs text-gray-400">Issues</span></div>
            </div>
          </CardContent>
        </Card>

        {/* Month nav */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-gray-800"
            onClick={() => { setCurrentMonth(subMonths(currentMonth, 1)); setSelectedDay(null); }}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{monthLabel}</h2>
          </div>
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-gray-800"
            onClick={() => { setCurrentMonth(addMonths(currentMonth, 1)); setSelectedDay(null); }}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-white">{monthReports.length}</p>
              <p className="text-xs text-gray-400 mt-0.5">Total Reports</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-green-400">{monthReports.filter(r => !r.had_issues).length}</p>
              <p className="text-xs text-gray-400 mt-0.5">Clean</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-red-400">{monthReports.filter(r => r.had_issues).length}</p>
              <p className="text-xs text-gray-400 mt-0.5">With Issues</p>
            </CardContent>
          </Card>
        </div>

        {/* Calendar grid */}
        <Card className="bg-gray-900 border-gray-800">
          <div className="grid grid-cols-7 border-b border-gray-800">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
              <div key={d} className="py-2 text-center text-xs font-medium text-gray-500">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {Array.from({ length: startPad }).map((_, i) => (
              <div key={`pad-${i}`} className="border-r border-b border-gray-800/50 min-h-[80px] bg-gray-950/30" />
            ))}
            {days.map((day, idx) => {
              const dayStr = format(day, 'yyyy-MM-dd');
              const dayRep = byDay[dayStr] || [];
              const hasAny = dayRep.length > 0;
              const hasIssues = dayRep.some(r => r.had_issues);
              const isSelected = selectedDay && format(selectedDay, 'yyyy-MM-dd') === dayStr;
              const colPos = (startPad + idx) % 7;
              const isLastCol = colPos === 6;
              return (
                <div key={dayStr}
                  onClick={() => hasAny && setSelectedDay(isSelected ? null : day)}
                  className={`min-h-[80px] border-b border-gray-800/50 p-2 flex flex-col transition-colors
                    ${!isLastCol ? 'border-r border-gray-800/50' : ''}
                    ${hasAny ? 'cursor-pointer' : ''}
                    ${isSelected ? 'bg-blue-950/30 border-blue-800/40' : hasAny ? 'hover:bg-gray-800/40' : ''}
                  `}>
                  <span className={`text-xs font-semibold mb-1 w-6 h-6 flex items-center justify-center rounded-full
                    ${format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>
                    {format(day, 'd')}
                  </span>
                  {hasAny && (
                    <div className="flex flex-col gap-1 mt-0.5">
                      {dayRep.slice(0, 3).map((r, i) => (
                        <div key={i} className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-xs leading-tight
                          ${r.had_issues ? 'bg-red-900/40 text-red-300' : 'bg-green-900/30 text-green-300'}`}>
                          {r.had_issues ? <AlertCircle className="h-2.5 w-2.5 flex-shrink-0" /> : <CheckCircle2 className="h-2.5 w-2.5 flex-shrink-0" />}
                          <span className="truncate" style={{ maxWidth: '80px' }}>{r.shoot_title}</span>
                        </div>
                      ))}
                      {dayRep.length > 3 && <span className="text-xs text-gray-500 pl-1">+{dayRep.length - 3} more</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>

        {/* Legend */}
        <div className="flex items-center gap-4 px-1">
          <div className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-green-400" /><span className="text-xs text-gray-500">Clean shoot</span></div>
          <div className="flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5 text-red-400" /><span className="text-xs text-gray-500">Issues reported</span></div>
          <span className="text-xs text-gray-600">· Click a day to view details</span>
        </div>

        {/* Daily shoot summaries — one copy-ready message per day */}
        {monthReports.length > 0 && (
          <div>
            <p className="text-sm font-semibold text-gray-300 mb-3">Daily Shoot Summaries</p>
            <div className="space-y-2">
              {Object.keys(byDay).sort().map(dayStr => (
                <DailyShootSummary
                  key={dayStr}
                  date={new Date(dayStr + 'T12:00:00')}
                  reports={byDay[dayStr]}
                />
              ))}
            </div>
          </div>
        )}

        {/* Monthly report list — collapsed by default */}
        {monthReports.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setAllExpanded(e => !e)}
              className="w-full flex items-center gap-2 text-left mb-1"
            >
              <ChevronDown className={`h-4 w-4 text-gray-500 transition-transform ${allExpanded ? '' : '-rotate-90'}`} />
              <p className="text-sm font-semibold text-gray-300">All Reports — {monthLabel}</p>
              <span className="text-xs text-gray-500">({monthReports.length})</span>
            </button>
            {allExpanded && (
              <div className="space-y-2 pl-6 pt-2">
                {[...monthReports].sort((a, b) => (a.shoot_date || '').localeCompare(b.shoot_date || '')).map(r => (
                  <div key={r.id} className={`rounded-lg p-3 border flex items-start justify-between gap-3
                    ${r.had_issues ? 'border-red-800/40 bg-red-950/10' : 'border-gray-800 bg-gray-900'}`}>
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {r.had_issues ? <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" /> : <CheckCircle2 className="h-4 w-4 text-green-400 flex-shrink-0 mt-0.5" />}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate">{r.shoot_title}</p>
                        <p className="text-xs text-gray-500">{r.shoot_date} · {r.operator_name || r.operator_email || 'Unknown'}</p>
                        {r.notes && <p className="text-xs text-gray-400 mt-1 italic truncate">{r.notes}</p>}
                      </div>
                    </div>
                    <Badge className={r.had_issues ? 'bg-red-500/20 text-red-400 border-red-500/30 text-xs flex-shrink-0' : 'bg-green-500/20 text-green-400 border-green-500/30 text-xs flex-shrink-0'}>
                      {r.had_issues ? 'Issues' : 'Clean'}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedDay && dayReports.length > 0 && (
        <DayPanel
          date={selectedDay}
          reports={dayReports}
          onClose={() => setSelectedDay(null)}
          onDelete={handleDeleteReport}
          onAdd={handleAddReport}
          onEdit={handleEditReport}
        />
      )}
    </div>
  );
}