import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  Check, X, FileText, Edit2, Save, RefreshCw, Clock, CheckCircle2
} from 'lucide-react';
import { format, startOfYear, endOfYear, eachMonthOfInterval } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { getOperatorMonthlySummary } from '../components/utils/earningsUtils';
import { getOperatorStandbyEarnings } from '../components/utils/standbyEarnings';

function OperatorRow({ op, shoots, pendingShoots, paymentRecords, month, onSaveFee, onSaveNote, onToggleAdditional, onApprove, onReject, baseRate, additionalRate, standbyDays = [], standbyRate = 500 }) {
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editFee, setEditFee] = useState('');
  const [note, setNote] = useState('');
  const [editingNote, setEditingNote] = useState(null);

  const opRecords = paymentRecords.filter(r => r.operator_email === op.email && r.period_month === month);
  const getRecord = (shoot) => opRecords.find(r => r.shoot_id === shoot.id);

  const { total, breakdown, activeCount: activeShootCount, cancelledCount } = useMemo(
    () => getOperatorMonthlySummary(shoots, op.email, baseRate, additionalRate, opRecords),
    [shoots, op.email, baseRate, additionalRate, opRecords]
  );
  const sortedBreakdown = useMemo(() => [...breakdown].sort((a, b) => a.date.localeCompare(b.date)), [breakdown]);
  const hasPending = pendingShoots.length > 0;

  const standbyEarnings = useMemo(
    () => getOperatorStandbyEarnings(standbyDays, op.email, month, standbyRate),
    [standbyDays, op.email, month, standbyRate]
  );
  const grandTotal = total + standbyEarnings.total;
  const roleLabel = op.role === 'operator_standby' ? 'Remote Operator/Standby'
    : op.role === 'standby' ? 'Standby'
    : op.role === 'accounts' ? 'Accounts'
    : op.role === 'admin' ? 'Admin'
    : 'Remote Operator';
  const roleBadge = op.role === 'operator_standby'
    ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
    : op.role === 'standby'
    ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
    : 'bg-gray-700 text-gray-300 border-gray-600';

  const handleSaveFee = async (shoot) => {
    const rec = getRecord(shoot);
    await onSaveFee({ shoot, email: op.email, name: op.full_name, month, override_fee: parseFloat(editFee), existingId: rec?.id });
    setEditingId(null);
  };

  const handleSaveNote = async (shoot) => {
    const rec = getRecord(shoot);
    await onSaveNote({ shoot, email: op.email, name: op.full_name, month, notes: note, existingId: rec?.id });
    setEditingNote(null);
    setNote('');
  };

  const handleToggleAdditional = async (shoot) => {
    const rec = getRecord(shoot);
    const current = breakdown.find(b => b.shoot?.id === shoot.id)?.isAdditional ?? false;
    await onToggleAdditional({ shoot, email: op.email, name: op.full_name, month, is_additional: !current, existingId: rec?.id });
  };

  return (
    <div className={`rounded-xl border transition-colors ${
      hasPending ? 'border-yellow-800/40 bg-yellow-950/10' : 'border-gray-800 bg-gray-900'
    }`}>
      <button className="w-full flex items-center gap-4 p-4 text-left" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-white">{op.full_name || op.email}</p>
            <Badge className={`text-xs border ${roleBadge}`}>{roleLabel}</Badge>
            {op.inactive && <Badge className="text-xs bg-gray-700 text-gray-400 border-gray-600">Not in use</Badge>}
          </div>
          <p className="text-xs text-gray-500">{op.email}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {hasPending && (
            <span className="flex items-center gap-1 text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full">
              <Clock className="h-3 w-3" /> {pendingShoots.length} pending
            </span>
          )}
          <div className="text-right">
            <p className="text-sm text-gray-400">
              {activeShootCount} shoot{activeShootCount !== 1 ? 's' : ''}
              {cancelledCount > 0 && <span className="text-gray-600"> · {cancelledCount} cancelled</span>}
              {standbyEarnings.count > 0 && <span className="text-purple-400"> · {standbyEarnings.count} standby</span>}
            </p>
            <p className="font-mono font-bold text-white">R{grandTotal.toFixed(2)}</p>
          </div>
          {expanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-800 pt-3 space-y-3">
          {/* Pending approval section */}
          {hasPending && (
            <div className="bg-yellow-950/20 border border-yellow-800/40 rounded-xl p-3 space-y-2">
              <p className="text-xs font-semibold text-yellow-400 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="h-3 w-3" /> Pending Approval ({pendingShoots.length})
              </p>
              {pendingShoots.map(shoot => (
                <div key={shoot.id} className="flex items-center justify-between gap-2 bg-gray-900/60 rounded-lg px-3 py-2 border border-yellow-800/20">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{shoot.title}</p>
                    <p className="text-xs text-gray-500">{shoot.date}{shoot.game_time ? ` · ${shoot.game_time}` : ''}</p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="sm" className="h-7 text-xs bg-green-700 hover:bg-green-600 gap-1 px-2" onClick={() => onApprove(shoot, op.email)}>
                      <Check className="h-3 w-3" /> Approve
                    </Button>
                    <Button size="sm" className="h-7 text-xs bg-red-800 hover:bg-red-700 gap-1 px-2" onClick={() => onReject(shoot, op.email)}>
                      <X className="h-3 w-3" /> Decline
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {sortedBreakdown.length > 0 && (
            <p className="text-xs font-semibold text-green-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3" /> Approved Shoots ({activeShootCount}){cancelledCount > 0 && <span className="text-gray-500 normal-case"> · {cancelledCount} cancelled</span>}
            </p>
          )}

          {sortedBreakdown.length === 0 && !hasPending && <p className="text-gray-500 text-sm text-center py-4">No shoots this month.</p>}
          {sortedBreakdown.length === 0 && hasPending && <p className="text-gray-500 text-sm text-center py-2">No approved shoots yet.</p>}

          {standbyEarnings.days.length > 0 && (
            <div className="mt-3 border-t border-purple-900/40 pt-3">
              <p className="text-xs font-semibold text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <CheckCircle2 className="h-3 w-3" /> Standby Days ({standbyEarnings.days.length})
              </p>
              <div className="space-y-1.5">
                {standbyEarnings.days.map(d => (
                  <div key={d.date} className="flex items-center justify-between rounded-lg p-3 border border-purple-900/40 bg-purple-950/10">
                    <div>
                      <p className="text-sm font-medium text-white">Standby Coverage</p>
                      <p className="text-xs text-gray-500">{d.date}</p>
                    </div>
                    <span className="font-mono font-bold text-white">R{d.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sortedBreakdown.map(item => {
            const shoot = item.shoot;
            if (!shoot) return null;
            const rec = getRecord(shoot);
            const fee = item.amount;
            const additional = item.isAdditional;
            const isCancelled = !!item.isCancelled;
            const hasOverrideFee = item.override_fee != null && !isCancelled;
            const hasManualAdditional = item.manual_additional === true;
            return (
              <div key={shoot.id} className={`rounded-lg p-3 border bg-gray-800/40 ${isCancelled ? 'border-gray-700 opacity-60' : 'border-gray-800'}`}>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isCancelled ? 'text-gray-400 line-through' : 'text-white'}`}>{shoot.title}</p>
                    <p className="text-xs text-gray-500">{shoot.date}{shoot.game_time ? ` · ${shoot.game_time}` : ''}</p>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {isCancelled && <Badge className="text-xs bg-gray-700 text-gray-300 border-gray-600">Cancelled</Badge>}
                      {additional && !isCancelled && <Badge className="text-xs bg-orange-500/20 text-orange-400 border-orange-500/30">Additional</Badge>}
                      {hasOverrideFee && <Badge className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">Fee Override</Badge>}
                      {hasManualAdditional && <Badge className="text-xs bg-purple-500/20 text-purple-400 border-purple-500/30">Manual</Badge>}
                    </div>
                    {isCancelled && shoot.cancellation_reason && <p className="text-xs text-gray-500 mt-1 italic">Reason: {shoot.cancellation_reason}</p>}
                    {rec?.notes && <p className="text-xs text-gray-400 mt-1 italic">{rec.notes}</p>}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {editingId === shoot.id ? (
                      <>
                        <Input type="number" value={editFee} onChange={e => setEditFee(e.target.value)}
                          className="bg-gray-700 border-gray-600 text-white h-7 w-24 text-sm" placeholder="Fee (R)" />
                        <Button size="sm" className="h-7 bg-blue-600 hover:bg-blue-700 text-xs px-2" onClick={() => handleSaveFee(shoot)}>
                          <Save className="h-3 w-3" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-gray-400 text-xs px-2" onClick={() => setEditingId(null)}>
                          <X className="h-3 w-3" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <span className={`font-mono font-bold ${isCancelled ? 'text-gray-500' : 'text-white'}`}>R{fee.toFixed(2)}</span>
                        {!isCancelled && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-white p-0"
                          onClick={() => { setEditingId(shoot.id); setEditFee(String(fee)); }}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
                  <button
                    className={`text-xs px-2 py-1 rounded border transition-colors ${additional
                      ? 'border-orange-700 text-orange-400 bg-orange-950/30 hover:bg-orange-950/60'
                      : 'border-gray-700 text-gray-500 hover:text-gray-300 hover:border-gray-600'}`}
                    onClick={() => handleToggleAdditional(shoot)}
                    title="Toggle additional shoot rate">
                    {additional ? '⚡ Mark as Standard' : '+ Mark as Additional'}
                  </button>
                  {editingNote === shoot.id ? (
                    <div className="flex gap-2 flex-1">
                      <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Add note..."
                        className="bg-gray-700 border-gray-600 text-white h-7 text-xs flex-1" />
                      <Button size="sm" className="h-7 text-xs bg-blue-600 hover:bg-blue-700 px-2" onClick={() => handleSaveNote(shoot)}>Save</Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs px-2 text-gray-400" onClick={() => setEditingNote(null)}>Cancel</Button>
                    </div>
                  ) : (
                    <button className="text-xs text-gray-600 hover:text-gray-400 flex items-center gap-1"
                      onClick={() => { setEditingNote(shoot.id); setNote(rec?.notes || ''); }}>
                      <FileText className="h-3 w-3" /> {rec?.notes ? 'Edit note' : 'Add note'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Accounts() {
  const { isAdmin } = useApp();
  const queryClient = useQueryClient();
  const canView = isAdmin;

  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'));

  const { data: shoots = [] } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list('-date', 2000),
  });

  const { data: pendingUsers = [] } = useQuery({
    queryKey: ['pendingUsers'],
    queryFn: () => base44.entities.PendingUser.list(),
  });

  const { data: paymentRecords = [] } = useQuery({
    queryKey: ['paymentRecords'],
    queryFn: () => base44.entities.PaymentRecord.list('-created_date', 2000),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    staleTime: 5 * 60_000,
  });

  const { data: appSettings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const { data: standbyDays = [] } = useQuery({
    queryKey: ['standbyDays'],
    queryFn: () => base44.entities.StandbyDay.list('-start_date', 500),
  });

  const baseRate = parseFloat(appSettings.find(s => s.key === 'base_rate')?.value) || 1000;
  const additionalRate = parseFloat(appSettings.find(s => s.key === 'additional_rate')?.value) || 250;
  const standbyRate = parseFloat(appSettings.find(s => s.key === 'standby_rate')?.value) || 500;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['paymentRecords'] });
    queryClient.invalidateQueries({ queryKey: ['shoots'] });
    queryClient.invalidateQueries({ queryKey: ['pendingUsers'] });
  };

  const goMonth = (delta) => {
    const [y, m] = filterMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setFilterMonth(format(d, 'yyyy-MM'));
  };

  const monthShoots = shoots.filter(s => s.date?.startsWith(filterMonth) && s.status !== 'cancelled');
  const displayMonthShoots = shoots.filter(s => s.date?.startsWith(filterMonth));
  const monthPendingShoots = shoots.filter(s => s.date?.startsWith(filterMonth) && s.status !== 'cancelled' && s.pending_operators?.length > 0);

  const remoteUsers = useMemo(() => {
    // Combine admin emails from both PendingUser and platform User entities
    const adminEmails = new Set([
      ...pendingUsers.filter(u => u.role === 'admin').map(u => u.email),
      ...users.filter(u => u.role === 'admin').map(u => u.email),
    ]);
    // Only consider emails that exist in PendingUser or User as valid operators
    const validEmails = new Set([
      ...pendingUsers.map(u => u.email),
      ...users.map(u => u.email),
    ]);
    const knownUsers = pendingUsers
      .filter(u => u.role === 'user' || u.role === 'standby' || u.role === 'operator_standby')
      .map(u => ({ email: u.email, full_name: u.full_name || u.email, role: u.role || 'user', inactive: u.inactive || false }));
    const knownEmails = new Set(knownUsers.map(u => u.email));
    const nameMap = {};
    paymentRecords.forEach(r => { if (r.operator_email && r.operator_name) nameMap[r.operator_email] = r.operator_name; });
    const extraEmails = new Set();
    shoots.forEach(s => {
      (s.assigned_operators || []).forEach(e => { if (e && !knownEmails.has(e) && !adminEmails.has(e) && validEmails.has(e)) extraEmails.add(e); });
      (s.pending_operators || []).forEach(e => { if (e && !knownEmails.has(e) && !adminEmails.has(e) && validEmails.has(e)) extraEmails.add(e); });
    });
    const extraUsers = [...extraEmails].map(email => ({
      email,
      full_name: nameMap[email] || email,
      role: (pendingUsers.find(p => p.email === email)?.role) || (users.find(u => u.email === email)?.role) || 'user',
    }));
    return [...knownUsers, ...extraUsers];
  }, [pendingUsers, shoots, paymentRecords, users]);

  const summaryRows = useMemo(() => {
    return remoteUsers.map(op => {
      const opShoots = monthShoots.filter(s => s.assigned_operators?.includes(op.email));
      const opPending = monthPendingShoots.filter(s => s.pending_operators?.includes(op.email));
      const standbyCount = op.role === 'operator_standby'
        ? getOperatorStandbyEarnings(standbyDays, op.email, filterMonth, standbyRate).count
        : 0;
      return { ...op, name: op.full_name || op.email, shoots: opShoots.length, pending: opPending.length, standbyCount };
    }).filter(op => op.shoots > 0 || op.pending > 0 || op.standbyCount > 0);
  }, [remoteUsers, monthShoots, monthPendingShoots, filterMonth, standbyDays, standbyRate]);

  const totalPending = summaryRows.reduce((s, r) => s + r.pending, 0);
  const totalShoots = summaryRows.reduce((s, r) => s + r.shoots, 0);

  // Shoots per operator chart data
  const operatorChartData = useMemo(() => {
    return summaryRows
      .filter(r => r.shoots > 0)
      .sort((a, b) => b.shoots - a.shoots)
      .map(r => ({ name: r.name.split(' ')[0], shoots: r.shoots, pending: r.pending }));
  }, [summaryRows]);

  // Yearly total shoots chart
  const yearChartData = useMemo(() => {
    const yearNum = parseInt(filterMonth.split('-')[0]);
    const months = eachMonthOfInterval({
      start: startOfYear(new Date(yearNum, 0, 1)),
      end: endOfYear(new Date(yearNum, 0, 1)),
    });
    return months.map(monthDate => {
      const monthKey = format(monthDate, 'yyyy-MM');
      const count = shoots.filter(s => s.date?.startsWith(monthKey) && s.status !== 'cancelled').length;
      return { month: format(monthDate, 'MMM'), count, isCurrentMonth: monthKey === filterMonth };
    });
  }, [shoots, filterMonth]);

  const yearTotal = yearChartData.reduce((s, d) => s + d.count, 0);

  const upsertRecord = async ({ shoot, email, name, month, existingId, ...fields }) => {
    const base = {
      operator_email: email, operator_name: name, period_month: month,
      shoot_id: shoot.id, shoot_title: shoot.title, shoot_date: shoot.date,
    };
    if (existingId) {
      await base44.entities.PaymentRecord.update(existingId, { ...base, ...fields });
    } else {
      await base44.entities.PaymentRecord.create({ ...base, ...fields });
    }
    refresh();
  };

  const handleApprove = async (shoot, email) => {
    const newPending = (shoot.pending_operators || []).filter(e => e !== email);
    const newAssigned = [...(shoot.assigned_operators || []), email];
    await base44.entities.Shoot.update(shoot.id, { pending_operators: newPending, assigned_operators: newAssigned });

    // If this is a paired shoot, also approve the partner (where auto_assigned_for includes email)
    const autoAssignWindowMinutes = (() => {
      const raw = appSettings.find(s => s.key === 'auto_assign_window_hours')?.value;
      return (raw ? Number(raw) : 2) * 60;
    })();
    const shootMins = shoot.game_time ? shoot.game_time.split(':').map(Number).reduce((h, m) => h * 60 + m) : 19 * 60;
    const partner = shoots.find(s =>
      s.id !== shoot.id &&
      s.date === shoot.date &&
      (s.auto_assigned_for || []).includes(email) &&
      (s.pending_operators || []).includes(email) &&
      Math.abs((s.game_time ? s.game_time.split(':').map(Number).reduce((h, m) => h * 60 + m) : 19 * 60) - shootMins) <= autoAssignWindowMinutes
    );
    if (partner) {
      await base44.entities.Shoot.update(partner.id, {
        pending_operators: (partner.pending_operators || []).filter(e => e !== email),
        assigned_operators: [...(partner.assigned_operators || []), email],
      });
    }
    refresh();
  };

  const handleReject = async (shoot, email) => {
    const newPending = (shoot.pending_operators || []).filter(e => e !== email);
    await base44.entities.Shoot.update(shoot.id, { pending_operators: newPending });

    // Also remove from paired shoot if pending there too
    const autoAssignWindowMinutes = (() => {
      const raw = appSettings.find(s => s.key === 'auto_assign_window_hours')?.value;
      return (raw ? Number(raw) : 2) * 60;
    })();
    const shootMins = shoot.game_time ? shoot.game_time.split(':').map(Number).reduce((h, m) => h * 60 + m) : 19 * 60;
    const partner = shoots.find(s =>
      s.id !== shoot.id &&
      s.date === shoot.date &&
      (s.auto_assigned_for || []).includes(email) &&
      (s.pending_operators || []).includes(email) &&
      Math.abs((s.game_time ? s.game_time.split(':').map(Number).reduce((h, m) => h * 60 + m) : 19 * 60) - shootMins) <= autoAssignWindowMinutes
    );
    if (partner) {
      await base44.entities.Shoot.update(partner.id, {
        pending_operators: (partner.pending_operators || []).filter(e => e !== email),
        auto_assigned_for: (partner.auto_assigned_for || []).filter(e => e !== email),
      });
    }
    refresh();
  };

  if (!canView) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
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
            <h1 className="text-2xl font-bold text-white">Pending / Approve</h1>
            <p className="text-gray-400 text-sm mt-0.5">Review self-assignments and approve pending shoots</p>
          </div>
          <Button onClick={refresh} variant="ghost" size="icon" className="text-gray-500 hover:text-white h-9 w-9">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Yearly shoots chart */}
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-5">
            <div className="mb-4">
              <p className="text-sm text-gray-400">{filterMonth.split('-')[0]} — Total Shoots</p>
              <p className="text-2xl font-bold text-white">{yearTotal} shoots</p>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={yearChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                <Tooltip
                  formatter={(v) => [v, 'Shoots']}
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#9ca3af' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {yearChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.isCurrentMonth ? '#3b82f6' : '#374151'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Month navigator */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-gray-800" onClick={() => goMonth(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{format(new Date(filterMonth + '-01'), 'MMMM yyyy')}</h2>
            {totalPending > 0 && (
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 gap-1">
                <Clock className="h-3 w-3" /> {totalPending} pending
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-gray-800" onClick={() => goMonth(1)}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Shoots per operator chart */}
        {operatorChartData.length > 0 && (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-5">
              <p className="text-sm text-gray-400 mb-3">Shoots per Operator — {format(new Date(filterMonth + '-01'), 'MMMM yyyy')}</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={operatorChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                  <Tooltip
                    formatter={(v) => [v, 'Shoots']}
                    contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#9ca3af' }}
                  />
                  <Bar dataKey="shoots" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-5">
              <p className="text-gray-400 text-sm">Total Shoots</p>
              <p className="text-2xl font-bold text-white mt-1">{totalShoots}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-5">
              <p className="text-gray-400 text-sm">Operators Active</p>
              <p className="text-2xl font-bold text-white mt-1">{summaryRows.length}</p>
            </CardContent>
          </Card>
          <Card className={`border-gray-800 col-span-2 md:col-span-1 ${totalPending > 0 ? 'bg-yellow-950/20 border-yellow-800/40' : 'bg-gray-900'}`}>
            <CardContent className="p-5">
              <p className={`text-sm ${totalPending > 0 ? 'text-yellow-400' : 'text-gray-400'}`}>Pending Approvals</p>
              <p className={`text-2xl font-bold mt-1 ${totalPending > 0 ? 'text-yellow-400' : 'text-white'}`}>{totalPending}</p>
            </CardContent>
          </Card>
        </div>

        {/* Operator rows */}
        {summaryRows.length === 0 ? (
          <div className="text-center py-16 text-gray-500">No operator activity for this month.</div>
        ) : (
          <div className="space-y-3">
            {summaryRows.map(op => (
              <OperatorRow
                key={op.email}
                op={op}
                shoots={displayMonthShoots}
                pendingShoots={monthPendingShoots
                  .filter(s => s.pending_operators?.includes(op.email))
                  .sort((a, b) => a.date.localeCompare(b.date))}
                paymentRecords={paymentRecords}
                month={filterMonth}
                onSaveFee={(args) => upsertRecord(args)}
                onSaveNote={(args) => upsertRecord(args)}
                onToggleAdditional={(args) => upsertRecord(args)}
                onApprove={handleApprove}
                onReject={handleReject}
                baseRate={baseRate}
                additionalRate={additionalRate}
                standbyDays={standbyDays}
                standbyRate={standbyRate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}