import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft, ChevronRight, Download, TrendingUp, Users,
  DollarSign, Calendar, CheckCircle2, Circle, StickyNote, X, Clock
} from 'lucide-react';
import { format, startOfYear, endOfYear, eachMonthOfInterval } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend } from 'recharts';
import { getAdditionalShootIds } from '../components/utils/earningsUtils';

function exportCSV(rows, month) {
  const header = 'Operator,Email,Shoots,Amount (ZAR),Paid,Paid Date,Note\n';
  const body = rows
    .map(r => `"${r.name}","${r.email}",${r.shoots},${r.total.toFixed(2)},${r.paid ? 'Yes' : 'No'},"${r.paidDate || ''}","${r.note || ''}"`)
    .join('\n');
  const blob = new Blob([header + body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Earnings_${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function LiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="text-right">
      <p className="text-lg font-mono font-bold text-white">{format(now, 'HH:mm:ss')}</p>
      <p className="text-xs text-gray-400">{format(now, 'EEEE, d MMMM yyyy')}</p>
    </div>
  );
}

export default function AccountsDashboard() {
  const { user, isAccounts, isAdmin } = useApp();
  const canView = isAccounts || isAdmin;
  const queryClient = useQueryClient();

  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [noteEditing, setNoteEditing] = useState(null); // email being edited
  const [noteInput, setNoteInput] = useState('');
  const [saving, setSaving] = useState(null); // email currently saving
  const [datePickerFor, setDatePickerFor] = useState(null); // email awaiting date choice
  const [customDate, setCustomDate] = useState('');

  const { data: shoots = [] } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list('-date', 2000),
  });

  const { data: pendingUsers = [] } = useQuery({
    queryKey: ['pendingUsers'],
    queryFn: () => base44.entities.PendingUser.list(),
  });

  const { data: paymentRecords = [], refetch: refetchPayments } = useQuery({
    queryKey: ['paymentRecords'],
    queryFn: () => base44.entities.PaymentRecord.list('-created_date', 3000),
  });

  // Real-time sync — any accounts user's changes (paid toggle, notes) update all viewers instantly
  useEffect(() => {
    const unsub = base44.entities.PaymentRecord.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['paymentRecords'] });
    });
    return unsub;
  }, [queryClient]);

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: appSettings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const baseRate = parseFloat(appSettings.find(s => s.key === 'base_rate')?.value) || 1000;
  const additionalRate = parseFloat(appSettings.find(s => s.key === 'additional_rate')?.value) || 250;

  const goMonth = (delta) => {
    const [y, m] = filterMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setFilterMonth(format(d, 'yyyy-MM'));
  };

  const remoteUsers = useMemo(() => {
    // Build a complete set of admin emails from BOTH PendingUser and User entities
    const adminEmails = new Set([
      ...pendingUsers.filter(u => u.role === 'admin' || u.role === 'standby' || u.role === 'accounts').map(u => u.email?.trim().toLowerCase()),
      ...allUsers.filter(u => u.role === 'admin' || u.role === 'accounts').map(u => u.email?.trim().toLowerCase()),
    ]);

    // Only include role=user remote operators from PendingUser
    const knownUsers = pendingUsers
      .filter(u => u.role === 'user')
      .map(u => ({ email: u.email, full_name: u.full_name || u.email, inactive: !!u.inactive }));
    const knownEmails = new Set(knownUsers.map(u => u.email?.trim().toLowerCase()));

    const nameMap = {};
    paymentRecords.forEach(r => { if (r.operator_email && r.operator_name) nameMap[r.operator_email] = r.operator_name; });

    // Extra emails found in shoots but not in PendingUser — only add if not admin
    const extraEmails = new Set();
    shoots.forEach(s => {
      (s.assigned_operators || []).forEach(e => {
        if (!e) return;
        const lower = e.trim().toLowerCase();
        if (!knownEmails.has(lower) && !adminEmails.has(lower)) extraEmails.add(e);
      });
    });
    const extraUsers = [...extraEmails].map(email => ({ email, full_name: nameMap[email] || email, inactive: false }));
    return [...knownUsers, ...extraUsers];
  }, [pendingUsers, allUsers, shoots, paymentRecords]);

  function calcFee(shoot, opRecords, autoAdditionalIds) {
    const rec = opRecords.find(r => r.shoot_id === shoot.id);
    if (rec?.override_fee != null) return rec.override_fee;
    const isAdd = rec?.is_additional != null ? rec.is_additional : autoAdditionalIds.has(shoot.id);
    return isAdd ? additionalRate : baseRate;
  }

  // Get or create the single month-level payment record for an operator
  function getMonthRecord(email) {
    return paymentRecords.find(r =>
      r.operator_email === email &&
      r.period_month === filterMonth &&
      !r.shoot_id // month-level record has no shoot_id
    );
  }

  const handleTogglePaid = (row) => {
    if (!row.paid) {
      // Marking as paid — ask for date
      setCustomDate(format(new Date(), 'yyyy-MM-dd'));
      setDatePickerFor(row);
    } else {
      // Marking as unpaid — do it immediately
      confirmTogglePaid(row, null);
    }
  };

  const confirmTogglePaid = async (row, paidDate) => {
    setDatePickerFor(null);
    setSaving(row.email);
    const existing = getMonthRecord(row.email);
    const newPaid = !row.paid;

    if (existing) {
      await base44.entities.PaymentRecord.update(existing.id, {
        paid: newPaid,
        paid_date: newPaid ? paidDate : null,
      });
    } else {
      await base44.entities.PaymentRecord.create({
        operator_email: row.email,
        operator_name: row.name,
        period_month: filterMonth,
        paid: newPaid,
        paid_date: newPaid ? paidDate : null,
        base_fee: row.total,
      });
    }
    setSaving(null);
    queryClient.invalidateQueries({ queryKey: ['paymentRecords'] });
  };

  const handleSaveNote = async (row) => {
    setSaving(row.email);
    const existing = getMonthRecord(row.email);
    if (existing) {
      await base44.entities.PaymentRecord.update(existing.id, { notes: noteInput });
    } else {
      await base44.entities.PaymentRecord.create({
        operator_email: row.email,
        operator_name: row.name,
        period_month: filterMonth,
        paid: false,
        notes: noteInput,
        base_fee: row.total,
      });
    }
    setSaving(null);
    setNoteEditing(null);
    setNoteInput('');
    queryClient.invalidateQueries({ queryKey: ['paymentRecords'] });
  };

  const monthSummaryRows = useMemo(() => {
    const monthShoots = shoots.filter(s => s.date?.startsWith(filterMonth) && s.status !== 'cancelled');
    return remoteUsers.map(op => {
      const opShoots = monthShoots.filter(s => s.assigned_operators?.includes(op.email));
      const opRecords = paymentRecords.filter(r => r.operator_email === op.email && r.period_month === filterMonth);

      const byDate = {};
      opShoots.forEach(s => { if (!byDate[s.date]) byDate[s.date] = []; byDate[s.date].push(s); });
      const autoAdditionalIds = new Set();
      Object.values(byDate).forEach(dayShots => getAdditionalShootIds(dayShots).forEach(id => autoAdditionalIds.add(id)));

      const total = opShoots.reduce((sum, sh) => sum + calcFee(sh, opRecords, autoAdditionalIds), 0);

      // Paid status comes from the month-level record
      const monthRec = getMonthRecord(op.email);
      const paid = monthRec?.paid === true;
      const paidDate = monthRec?.paid_date || null;
      const note = monthRec?.notes || '';

      return { email: op.email, name: op.full_name || op.email, shoots: opShoots.length, total, paid, paidDate, note, inactive: !!op.inactive };
    }).filter(op => op.shoots > 0);
  }, [remoteUsers, shoots, paymentRecords, filterMonth, baseRate, additionalRate]);

  const grandTotal = monthSummaryRows.reduce((s, r) => s + r.total, 0);
  const paidCount = monthSummaryRows.filter(r => r.paid).length;

  const yearChartData = useMemo(() => {
    const yearNum = parseInt(filterMonth.split('-')[0]);
    const months = eachMonthOfInterval({
      start: startOfYear(new Date(yearNum, 0, 1)),
      end: endOfYear(new Date(yearNum, 0, 1)),
    });
    return months.map(monthDate => {
      const monthKey = format(monthDate, 'yyyy-MM');
      const monthShoots = shoots.filter(s => s.date?.startsWith(monthKey) && s.status !== 'cancelled');
      let total = 0;
      let paidTotal = 0;
      let activeOps = 0;
      let paidOps = 0;
      remoteUsers.forEach(op => {
        const opShoots = monthShoots.filter(s => s.assigned_operators?.includes(op.email));
        if (opShoots.length === 0) return;
        activeOps++;
        const opRecords = paymentRecords.filter(r => r.operator_email === op.email && r.period_month === monthKey);
        const byDate = {};
        opShoots.forEach(s => { if (!byDate[s.date]) byDate[s.date] = []; byDate[s.date].push(s); });
        const autoAdditionalIds = new Set();
        Object.values(byDate).forEach(dayShots => getAdditionalShootIds(dayShots).forEach(id => autoAdditionalIds.add(id)));
        const opTotal = opShoots.reduce((sum, sh) => sum + calcFee(sh, opRecords, autoAdditionalIds), 0);
        total += opTotal;
        const monthRec = paymentRecords.find(r => r.operator_email === op.email && r.period_month === monthKey && !r.shoot_id);
        if (monthRec?.paid) { paidOps++; paidTotal += opTotal; }
      });
      const allPaid = activeOps > 0 && paidOps === activeOps;
      return { month: format(monthDate, 'MMM'), monthKey, total, paidTotal, isCurrentMonth: monthKey === filterMonth, allPaid, activeOps };
    });
  }, [shoots, remoteUsers, paymentRecords, filterMonth, baseRate, additionalRate]);

  const yearTotal = yearChartData.reduce((s, d) => s + d.total, 0);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload?.length) {
      const total = payload.find(p => p.dataKey === 'total')?.value || 0;
      const paid = payload.find(p => p.dataKey === 'paidTotal')?.value || 0;
      const outstanding = total - paid;
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm space-y-1">
          <p className="text-gray-400 font-medium">{label}</p>
          <p className="text-white">Total: <span className="font-bold">R{total.toLocaleString('en-ZA')}</span></p>
          <p className="text-green-400">Paid: <span className="font-bold">R{paid.toLocaleString('en-ZA')}</span></p>
          {outstanding > 0 && <p className="text-yellow-400">Outstanding: <span className="font-bold">R{outstanding.toLocaleString('en-ZA')}</span></p>}
        </div>
      );
    }
    return null;
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
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-gray-400 text-sm mt-0.5">Standard: R{baseRate} · Additional: R{additionalRate}</p>
          </div>
          <div className="flex items-center gap-4 flex-wrap justify-end">
            <LiveClock />
            <Button
              onClick={() => exportCSV(monthSummaryRows, filterMonth)}
              className="bg-green-700 hover:bg-green-600 gap-2 text-sm"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Year chart */}
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div>
                <p className="text-sm text-gray-400 flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" /> {filterMonth.split('-')[0]} Yearly Spend
                </p>
                <p className="text-2xl font-bold text-white">R{yearTotal.toLocaleString('en-ZA')}</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={yearChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%" barGap={2}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={v => v === 0 ? '' : `R${(v / 1000).toFixed(0)}k`} width={42} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" name="Total Spend" radius={[4, 4, 0, 0]}>
                  {yearChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.isCurrentMonth ? '#3b82f6' : '#374151'} />
                  ))}
                </Bar>
                <Bar dataKey="paidTotal" name="Paid" radius={[4, 4, 0, 0]}>
                  {yearChartData.map((entry, i) => (
                    <Cell key={i} fill="#16a34a" fillOpacity={0.85} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2 px-1">
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#374151]" /><span className="text-xs text-gray-400">Total Spend</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-[#3b82f6]" /><span className="text-xs text-gray-400">Current Month</span></div>
              <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-green-700" /><span className="text-xs text-gray-400">Paid</span></div>
            </div>
          </CardContent>
        </Card>

        {/* Month navigator */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-gray-800" onClick={() => goMonth(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{format(new Date(filterMonth + '-01'), 'MMMM yyyy')}</h2>
            {paidCount > 0 && paidCount === monthSummaryRows.length && (
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 gap-1">
                <CheckCircle2 className="h-3 w-3" /> Fully Paid
              </Badge>
            )}
            {paidCount > 0 && paidCount < monthSummaryRows.length && (
              <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 gap-1">
                <Clock className="h-3 w-3" /> {paidCount}/{monthSummaryRows.length} Paid
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-gray-800" onClick={() => goMonth(1)}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Monthly summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-blue-400" />
                <p className="text-gray-400 text-sm">Month Total</p>
              </div>
              <p className="text-2xl font-bold text-white">R{grandTotal.toLocaleString('en-ZA')}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-purple-400" />
                <p className="text-gray-400 text-sm">Operators</p>
              </div>
              <p className="text-2xl font-bold text-white">{monthSummaryRows.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800 col-span-2 md:col-span-1">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <Calendar className="h-4 w-4 text-green-400" />
                <p className="text-gray-400 text-sm">Paid Out</p>
              </div>
              <p className="text-2xl font-bold text-green-400">{paidCount} / {monthSummaryRows.length}</p>
            </CardContent>
          </Card>
        </div>

        {/* Operator earnings table */}
        {monthSummaryRows.length === 0 ? (
          <div className="text-center py-16 text-gray-500">No operator activity for this month.</div>
        ) : (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-0">
              <div className="px-5 py-3 border-b border-gray-800">
                <p className="text-sm font-semibold text-gray-300">Operator Breakdown</p>
              </div>
              <div className="divide-y divide-gray-800">
                {monthSummaryRows
                  .sort((a, b) => b.total - a.total)
                  .map(row => (
                  <div key={row.email} className={`px-5 py-4 space-y-2 ${row.inactive ? 'opacity-40' : ''}`}>
                    {/* Main row */}
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-white truncate">{row.name}</p>
                          {row.inactive && <span className="text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded-full flex-shrink-0">Inactive</span>}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{row.email}</p>
                        {row.paidDate && row.paid && (
                          <p className="text-xs text-green-500 mt-0.5">Paid on {format(new Date(row.paidDate + 'T12:00:00'), 'd MMM yyyy')}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
                        <span className="text-xs text-gray-400">{row.shoots} shoot{row.shoots !== 1 ? 's' : ''}</span>
                        <span className="font-mono font-bold text-white text-sm">R{row.total.toLocaleString('en-ZA')}</span>

                        {/* Note button */}
                        <button
                          onClick={() => {
                            if (noteEditing === row.email) {
                              setNoteEditing(null);
                            } else {
                              setNoteEditing(row.email);
                              setNoteInput(row.note || '');
                            }
                          }}
                          className="text-gray-500 hover:text-yellow-400 transition-colors"
                          title="Add note (accounts only)"
                        >
                          <StickyNote className="h-4 w-4" />
                        </button>

                        {/* Paid toggle */}
                        <button
                          onClick={() => handleTogglePaid(row)}
                          disabled={saving === row.email}
                          className="flex items-center gap-1.5 text-sm font-medium transition-colors disabled:opacity-50"
                          title={row.paid ? 'Mark as unpaid' : 'Mark as paid'}
                        >
                          {row.paid
                            ? <CheckCircle2 className="h-5 w-5 text-green-400" />
                            : <Circle className="h-5 w-5 text-gray-500 hover:text-green-400" />
                          }
                          <Badge className={row.paid
                            ? 'bg-green-500/20 text-green-400 border-green-500/30'
                            : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                          }>
                            {row.paid ? 'Paid' : 'Unpaid'}
                          </Badge>
                        </button>
                      </div>
                    </div>

                    {/* Note inline */}
                    {row.note && noteEditing !== row.email && (
                      <div className="flex items-start gap-2 bg-yellow-950/20 border border-yellow-800/30 rounded px-3 py-2">
                        <StickyNote className="h-3.5 w-3.5 text-yellow-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-yellow-300">{row.note}</p>
                      </div>
                    )}

                    {/* Note editor */}
                    {noteEditing === row.email && (
                      <div className="flex gap-2 items-end flex-wrap">
                        <textarea
                          value={noteInput}
                          onChange={e => setNoteInput(e.target.value)}
                          placeholder="Add a private note (accounts only)..."
                          className="flex-1 min-w-[200px] bg-gray-800 border border-gray-700 text-white text-xs rounded-md px-3 py-2 resize-none h-16 placeholder:text-gray-600 focus:outline-none focus:border-yellow-600"
                        />
                        <div className="flex gap-2">
                          <Button size="sm" className="bg-yellow-700 hover:bg-yellow-600 text-xs h-8"
                            onClick={() => handleSaveNote(row)} disabled={saving === row.email}>
                            {saving === row.email ? 'Saving...' : 'Save'}
                          </Button>
                          <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white h-8"
                            onClick={() => setNoteEditing(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-700 bg-gray-800/40">
                <span className="text-sm font-semibold text-gray-300">Total</span>
                <span className="font-mono font-bold text-white">R{grandTotal.toLocaleString('en-ZA')}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

    {/* Date picker modal */}
    {datePickerFor && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
          <h3 className="text-white font-semibold text-base">Mark as Paid — {datePickerFor.name}</h3>
          <p className="text-gray-400 text-sm">Choose the payment date:</p>

          <div className="space-y-2">
            <button
              onClick={() => confirmTogglePaid(datePickerFor, format(new Date(), 'yyyy-MM-dd'))}
              className="w-full text-left px-4 py-3 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30 transition-colors text-sm font-medium"
            >
              ✓ Use today — {format(new Date(), 'd MMMM yyyy')}
            </button>

            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customDate}
                onChange={e => setCustomDate(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500"
              />
              <Button
                onClick={() => customDate && confirmTogglePaid(datePickerFor, customDate)}
                disabled={!customDate}
                className="bg-green-700 hover:bg-green-600 text-sm shrink-0"
              >
                Use this date
              </Button>
            </div>
          </div>

          <Button variant="ghost" className="w-full text-gray-500 hover:text-white" onClick={() => setDatePickerFor(null)}>
            Cancel
          </Button>
        </div>
      </div>
    )}
    </div>
  );
}