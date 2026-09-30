import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft, ChevronRight, Download, TrendingUp, Users,
  DollarSign, CheckCircle2, Circle, RefreshCw, X, Clock
} from 'lucide-react';
import { format, startOfYear, endOfYear, eachMonthOfInterval } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import {
  DEFAULT_BASE_RATE,
  DEFAULT_ADDITIONAL_RATE,
  DEFAULT_POSTPONED_RATE,
  DEFAULT_STANDBY_RATE,
  operatorAssignedCost,
  operatorProjectedCost,
  operatorStandbyCost,
  isAwaitingApproval,
} from '../components/utils/earningsUtils';
import { formatZAR } from '../utils/shootStatus';

function money(amount) {
  return formatZAR(amount, { withSpace: false });
}

function csvCell(value) {
  const s = String(value ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function downloadCsv(filename, tableRows) {
  const bom = '\uFEFF';
  const text = bom + tableRows.map((row) => row.map(csvCell).join(',')).join('\n');
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function monthsInRange(from, to) {
  let start = from;
  let end = to;
  if (start > end) [start, end] = [end, start];
  const out = [];
  let [y, m] = start.split('-').map(Number);
  const [ey, em] = end.split('-').map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

function yearMonths(year) {
  return monthsInRange(`${year}-01`, `${year}-12`);
}

export default function AccountsDashboard() {
  const { isAccounts, isAdmin } = useApp();
  const canMarkPaid = isAccounts;
  const canView = isAccounts || isAdmin;
  const queryClient = useQueryClient();

  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [saving, setSaving] = useState(null);
  const [datePickerFor, setDatePickerFor] = useState(null);
  const [customDate, setCustomDate] = useState('');
  const [exportOpen, setExportOpen] = useState(false);
  const [exportMode, setExportMode] = useState('month'); // month | year | range
  const [rangeFrom, setRangeFrom] = useState(`${format(new Date(), 'yyyy')}-01`);
  const [rangeTo, setRangeTo] = useState(format(new Date(), 'yyyy-MM'));

  const { data: shoots = [] } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list('-date', 2000),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const availableMonths = useMemo(() => {
    const months = new Set();
    shoots.forEach((s) => { if (s.date) months.add(s.date.substring(0, 7)); });
    months.add(filterMonth);
    return [...months].sort();
  }, [shoots, filterMonth]);

  const monthBounds = useMemo(() => {
    if (!availableMonths.length) {
      const y = format(new Date(), 'yyyy');
      return { min: `${y}-01`, max: `${y}-12` };
    }
    return { min: availableMonths[0], max: availableMonths[availableMonths.length - 1] };
  }, [availableMonths]);

  const rangeMonthOptions = useMemo(() => {
    const year = filterMonth.slice(0, 4);
    const start = [monthBounds.min, `${year}-01`].sort()[0];
    const end = [monthBounds.max, `${year}-12`].sort()[1];
    return monthsInRange(start, end);
  }, [monthBounds, filterMonth]);

  const { data: pendingUsers = [] } = useQuery({
    queryKey: ['pendingUsers'],
    queryFn: () => base44.entities.PendingUser.list(),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const { data: paymentRecords = [] } = useQuery({
    queryKey: ['paymentRecords'],
    queryFn: () => base44.entities.PaymentRecord.list('-created_date', 3000),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  useEffect(() => {
    const unsubPayments = base44.entities.PaymentRecord.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['paymentRecords'] });
    });
    const unsubShoots = base44.entities.Shoot.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['shoots'] });
    });
    const unsubPending = base44.entities.PendingUser.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['pendingUsers'] });
    });
    return () => {
      unsubPayments();
      unsubShoots();
      unsubPending();
    };
  }, [queryClient]);

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
    queryFn: () => base44.entities.StandbyDay.list('-date', 500),
  });

  const rates = useMemo(() => ({
    baseRate: parseFloat(appSettings.find((s) => s.key === 'base_rate')?.value) || DEFAULT_BASE_RATE,
    additionalRate: parseFloat(appSettings.find((s) => s.key === 'additional_rate')?.value) || DEFAULT_ADDITIONAL_RATE,
    postponedRate: parseFloat(appSettings.find((s) => s.key === 'postponed_rate')?.value) || DEFAULT_POSTPONED_RATE,
    standbyRate: parseFloat(appSettings.find((s) => s.key === 'standby_rate')?.value) || DEFAULT_STANDBY_RATE,
  }), [appSettings]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['shoots'] });
    queryClient.invalidateQueries({ queryKey: ['pendingUsers'] });
    queryClient.invalidateQueries({ queryKey: ['paymentRecords'] });
  };

  const goMonth = (delta) => {
    const [y, m] = filterMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setFilterMonth(format(d, 'yyyy-MM'));
  };

  const remoteUsers = useMemo(() => {
    const adminEmails = new Set([
      ...pendingUsers.filter((u) => u.role === 'admin').map((u) => u.email),
      ...users.filter((u) => u.role === 'admin').map((u) => u.email),
    ]);
    const validEmails = new Set([
      ...pendingUsers.map((u) => u.email),
      ...users.map((u) => u.email),
    ]);
    const knownUsers = users
      .filter((u) => u.role === 'user' || u.role === 'standby')
      .map((u) => {
        const pending = pendingUsers.find((p) => String(p.email || '').toLowerCase() === String(u.email || '').toLowerCase());
        return {
          email: u.email,
          full_name: pending?.full_name || u.full_name || u.email,
          inactive: u.inactive || pending?.inactive || false,
          role: u.role,
        };
      });
    const knownEmails = new Set(knownUsers.map((u) => u.email));
    const nameMap = {};
    paymentRecords.forEach((r) => {
      if (r.operator_email && r.operator_name) nameMap[r.operator_email] = r.operator_name;
    });
    const extraEmails = new Set();
    shoots.forEach((s) => {
      (s.assigned_operators || []).forEach((e) => {
        if (e && !knownEmails.has(e) && !adminEmails.has(e) && validEmails.has(e)) extraEmails.add(e);
      });
      (s.pending_operators || []).forEach((e) => {
        if (e && !knownEmails.has(e) && !adminEmails.has(e) && validEmails.has(e)) extraEmails.add(e);
      });
    });
    const extraUsers = [...extraEmails].map((email) => ({
      email,
      full_name: nameMap[email] || email,
      inactive: false,
    }));
    return [...knownUsers, ...extraUsers];
  }, [pendingUsers, shoots, paymentRecords, users]);

  function getMonthRecord(email, monthKey = filterMonth) {
    return paymentRecords.find((r) =>
      r.operator_email === email
      && r.period_month === monthKey
      && !r.shoot_id
    );
  }

  const operatorCostsForMonth = useCallback((monthKey) => {
    const monthShoots = shoots.filter((s) => s.date?.startsWith(monthKey));
    return remoteUsers.map((op) => {
      const opShoots = monthShoots.filter((s) => s.assigned_operators?.includes(op.email));
      const opPending = monthShoots.filter((s) =>
        isAwaitingApproval(s) && (s.pending_operators || []).includes(op.email)
      );
      const opRecords = paymentRecords.filter((r) => r.operator_email === op.email && r.period_month === monthKey);
      const { total: shootTotal } = operatorAssignedCost(opShoots, opRecords, rates);
      const projection = operatorProjectedCost(opShoots, opPending, opRecords, rates);
      const standby = op.role === 'standby'
        ? operatorStandbyCost(standbyDays, op.email, monthKey, rates.standbyRate)
        : { count: 0, total: 0 };
      const monthRec = paymentRecords.find((r) =>
        r.operator_email === op.email && r.period_month === monthKey && !r.shoot_id
      );
      return {
        email: op.email,
        name: op.full_name || op.email,
        total: shootTotal + standby.total,
        projectedTotal: projection.projected + standby.total,
        pendingAdd: projection.pendingAdd,
        paid: monthRec?.paid === true,
        paidDate: monthRec?.paid_date || null,
        inactive: !!op.inactive,
        shoots: opShoots.length,
        pending: opPending.length,
        standbyCount: standby.count,
      };
    }).filter((op) => op.shoots > 0 || op.standbyCount > 0 || op.pending > 0)
      .sort((a, b) => (b.projectedTotal - a.projectedTotal) || (b.total - a.total));
  }, [remoteUsers, shoots, paymentRecords, rates, standbyDays]);

  const monthSummaryRows = useMemo(
    () => operatorCostsForMonth(filterMonth),
    [operatorCostsForMonth, filterMonth]
  );

  const grandTotal = monthSummaryRows.reduce((s, r) => s + r.total, 0);
  const projectedGrand = monthSummaryRows.reduce((s, r) => s + r.projectedTotal, 0);
  const pendingAddTotal = monthSummaryRows.reduce((s, r) => s + r.pendingAdd, 0);
  const pendingCount = monthSummaryRows.reduce((s, r) => s + r.pending, 0);
  const paidCount = monthSummaryRows.filter((r) => r.paid).length;
  const paidTotal = monthSummaryRows.filter((r) => r.paid).reduce((s, r) => s + r.total, 0);

  const yearChartData = useMemo(() => {
    const yearNum = parseInt(filterMonth.split('-')[0], 10);
    const months = eachMonthOfInterval({
      start: startOfYear(new Date(yearNum, 0, 1)),
      end: endOfYear(new Date(yearNum, 0, 1)),
    });
    return months.map((monthDate) => {
      const monthKey = format(monthDate, 'yyyy-MM');
      const monthShoots = shoots.filter((s) => s.date?.startsWith(monthKey));
      let total = 0;
      remoteUsers.forEach((op) => {
        const opShoots = monthShoots.filter((s) => s.assigned_operators?.includes(op.email));
        const opRecords = paymentRecords.filter((r) => r.operator_email === op.email && r.period_month === monthKey);
        total += operatorAssignedCost(opShoots, opRecords, rates).total;
        if (op.role === 'standby') {
          total += operatorStandbyCost(standbyDays, op.email, monthKey, rates.standbyRate).total;
        }
      });
      return {
        month: format(monthDate, 'MMM'),
        monthKey,
        total,
        isCurrentMonth: monthKey === filterMonth,
      };
    });
  }, [shoots, remoteUsers, paymentRecords, filterMonth, rates, standbyDays]);

  const yearTotal = yearChartData.reduce((s, d) => s + d.total, 0);

  const exportMonths = useMemo(() => {
    const year = filterMonth.slice(0, 4);
    if (exportMode === 'month') return [filterMonth];
    if (exportMode === 'year') return yearMonths(year);
    return monthsInRange(rangeFrom || `${year}-01`, rangeTo || filterMonth);
  }, [exportMode, filterMonth, rangeFrom, rangeTo]);

  const exportPreview = useMemo(() => {
    let total = 0;
    let operators = 0;
    exportMonths.forEach((monthKey) => {
      const rows = operatorCostsForMonth(monthKey);
      operators += rows.length;
      total += rows.reduce((s, r) => s + r.total, 0);
    });
    return { months: exportMonths.length, total, operators };
  }, [exportMonths, operatorCostsForMonth]);

  const openExport = () => {
    const year = filterMonth.slice(0, 4);
    setExportMode('month');
    setRangeFrom(`${year}-01`);
    setRangeTo(filterMonth);
    setExportOpen(true);
  };

  const handleDownloadExport = () => {
    const monthKeys = exportMonths;
    const detail = [['Month', 'Operator', 'Amount (ZAR)', 'Paid']];
    const monthTotals = [['Month', 'Month total (ZAR)']];
    const byOperator = new Map();
    let grand = 0;

    monthKeys.forEach((monthKey) => {
      const rows = operatorCostsForMonth(monthKey);
      const monthLabel = format(new Date(`${monthKey}-01`), 'MMMM yyyy');
      let monthTotal = 0;
      rows.forEach((r) => {
        detail.push([monthLabel, r.name, r.total.toFixed(2), r.paid ? 'Yes' : 'No']);
        monthTotal += r.total;
        const prev = byOperator.get(r.name) || { total: 0, email: r.email };
        byOperator.set(r.name, { total: prev.total + r.total, email: r.email });
      });
      monthTotals.push([monthLabel, monthTotal.toFixed(2)]);
      grand += monthTotal;
    });

    const operatorTotals = [['Operator', 'Period total (ZAR)']];
    [...byOperator.entries()]
      .sort((a, b) => b[1].total - a[1].total)
      .forEach(([name, info]) => {
        operatorTotals.push([name, info.total.toFixed(2)]);
      });

    const table = [
      ...detail,
      [],
      ...monthTotals,
      [],
      ...operatorTotals,
      [],
      ['Grand total', grand.toFixed(2)],
    ];

    const first = monthKeys[0] || filterMonth;
    const last = monthKeys[monthKeys.length - 1] || first;
    const fullYear = monthKeys.length === 12
      && first.endsWith('-01')
      && last.endsWith('-12')
      && first.slice(0, 4) === last.slice(0, 4);
    const filename = monthKeys.length <= 1
      ? `Crew_costs_${first}.csv`
      : fullYear
        ? `Crew_costs_${first.slice(0, 4)}.csv`
        : `Crew_costs_${first}_to_${last}.csv`;
    downloadCsv(filename, table);
    setExportOpen(false);
  };

  const handleTogglePaid = (row) => {
    if (!row.paid) {
      setCustomDate(format(new Date(), 'yyyy-MM-dd'));
      setDatePickerFor(row);
    } else {
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

  const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    const total = payload.find((p) => p.dataKey === 'total')?.value || 0;
    return (
      <div className="bg-slate-800 border border-slate-800 rounded-lg px-3 py-2 text-sm">
        <p className="text-slate-400 font-medium">{label}</p>
        <p className="text-slate-100">Cost: <span className="font-bold">{money(total)}</span></p>
      </div>
    );
  };

  if (!canView) {
    return (
      <div className="min-h-screen bg-slate-800 flex items-center justify-center">
        <p className="text-slate-500">Access restricted.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-800 text-slate-100 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Dashboard</h1>
            <p className="text-slate-400 text-sm mt-0.5">
              Monthly crew costs — same fees as Pending / Approve. Pending assignments show a projection until they are approved.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Button onClick={refresh} variant="ghost" size="icon" className="text-slate-500 hover:text-slate-100 h-9 w-9" title="Refresh data">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={openExport} className="bg-green-700 hover:bg-green-600 gap-2 text-sm">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        <Card className="bg-slate-900 border-slate-800">
          <CardContent className="p-5">
            <div className="flex items-end justify-between mb-4 flex-wrap gap-2">
              <div>
                <p className="text-sm text-slate-400 flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4" /> {filterMonth.split('-')[0]} monthly totals
                </p>
                <p className="text-2xl font-bold text-slate-100">{money(yearTotal)}</p>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={yearChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis
                  tick={{ fill: '#9ca3af', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => (v === 0 ? '' : `R${(v / 1000).toFixed(0)}k`)}
                  width={42}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="total" name="Cost" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {yearChartData.map((entry) => (
                    <Cell key={entry.monthKey} fill={entry.isCurrentMonth ? '#3b82f6' : '#374151'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {yearChartData.map((entry) => (
                <button
                  key={entry.monthKey}
                  type="button"
                  onClick={() => setFilterMonth(entry.monthKey)}
                  className={`rounded-lg border px-2 py-2 text-left transition-colors ${
                    entry.isCurrentMonth
                      ? 'border-blue-700 bg-blue-950/40'
                      : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                  }`}
                >
                  <p className="text-[11px] text-slate-500">{entry.month}</p>
                  <p className="text-sm font-semibold text-slate-100 tabular-nums">{money(entry.total)}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-100 hover:bg-slate-800" onClick={() => goMonth(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold">{format(new Date(`${filterMonth}-01`), 'MMMM yyyy')}</h2>
          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-slate-100 hover:bg-slate-800" onClick={() => goMonth(1)}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-blue-400" />
                <p className="text-slate-400 text-sm">This month</p>
              </div>
              <p className="text-2xl font-bold text-slate-100">{money(grandTotal)}</p>
              <p className="text-xs text-slate-500 mt-1">Approved assignments</p>
            </CardContent>
          </Card>
          <Card className={`border-slate-800 ${pendingCount ? 'bg-amber-950/20 border-amber-800/40' : 'bg-slate-900'}`}>
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <Clock className="h-4 w-4 text-amber-400" />
                <p className="text-slate-400 text-sm">After pending</p>
              </div>
              <p className="text-2xl font-bold text-slate-100">{money(projectedGrand)}</p>
              <p className="text-xs text-amber-300/80 mt-1">
                {pendingCount
                  ? `+${money(pendingAddTotal)} from ${pendingCount} pending`
                  : 'No pending shoots'}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="h-4 w-4 text-sky-400" />
                <p className="text-slate-400 text-sm">Year to date</p>
              </div>
              <p className="text-2xl font-bold text-slate-100">{money(yearTotal)}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-4 w-4 text-purple-400" />
                <p className="text-slate-400 text-sm">Operators paid</p>
              </div>
              <p className="text-2xl font-bold text-slate-100">
                {paidCount} / {monthSummaryRows.length}
              </p>
              {paidTotal > 0 && (
                <p className="text-xs text-emerald-400 mt-1">{money(paidTotal)} paid</p>
              )}
            </CardContent>
          </Card>
        </div>

        {monthSummaryRows.length === 0 ? (
          <div className="text-center py-16 text-slate-500">No crew costs for this month.</div>
        ) : (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-0">
              <div className="px-5 py-3 border-b border-slate-800">
                <p className="text-sm font-semibold text-slate-400">Operator totals</p>
                <p className="text-xs text-slate-500 mt-0.5">
                  Confirmed amount first. After pending is what they would earn if every pending shoot is approved.
                </p>
              </div>
              <div className="divide-y divide-gray-800">
                {monthSummaryRows.map((row) => (
                  <div
                    key={row.email}
                    className={`px-5 py-4 flex items-center justify-between gap-3 ${row.inactive ? 'opacity-40' : ''} ${row.paid ? 'bg-emerald-950/30' : ''} ${row.pending ? 'bg-amber-950/10' : ''}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-100 truncate">{row.name}</p>
                      <p className="text-xs text-slate-500">
                        {row.shoots} shoot{row.shoots === 1 ? '' : 's'}
                        {row.standbyCount ? ` · ${row.standbyCount} standby` : ''}
                        {row.pending ? ` · ${row.pending} pending` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <span className="font-mono font-bold text-slate-100 text-sm">{money(row.total)}</span>
                        {row.pending > 0 && (
                          <p className="text-xs text-amber-300 mt-0.5">
                            After pending {money(row.projectedTotal)}
                            {row.pendingAdd ? ` (+${money(row.pendingAdd)})` : ''}
                          </p>
                        )}
                      </div>
                      {canMarkPaid ? (
                        <button
                          onClick={() => handleTogglePaid(row)}
                          disabled={saving === row.email}
                          className="flex items-center gap-1.5 text-sm font-medium transition-colors disabled:opacity-50"
                          title={row.paid ? 'Mark as unpaid' : 'Mark as paid'}
                        >
                          {row.paid
                            ? <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                            : <Circle className="h-5 w-5 text-slate-500 hover:text-emerald-400" />
                          }
                          <Badge className={row.paid
                            ? 'bg-green-500/20 text-emerald-400 border-green-500/30'
                            : 'bg-yellow-500/20 text-amber-400 border-yellow-500/30'
                          }>
                            {row.paid ? 'Paid' : 'Unpaid'}
                          </Badge>
                        </button>
                      ) : (
                        <Badge className={row.paid
                          ? 'bg-green-500/20 text-emerald-400 border-green-500/30'
                          : 'bg-yellow-500/20 text-amber-400 border-yellow-500/30'
                        }>
                          {row.paid ? 'Paid' : 'Unpaid'}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between px-5 py-3 border-t border-slate-800 bg-slate-800/40">
                <span className="text-sm font-semibold text-slate-400">Month total</span>
                <div className="text-right">
                  <span className="font-mono font-bold text-slate-100">{money(grandTotal)}</span>
                  {pendingCount > 0 && (
                    <p className="text-xs text-amber-300 mt-0.5">After pending {money(projectedGrand)}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {exportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md space-y-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-slate-100 font-semibold text-base">Export earnings</h3>
                <p className="text-slate-400 text-sm mt-1">
                  Download a CSV of operator totals for one month, the whole year, or a range of months.
                </p>
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-slate-100" onClick={() => setExportOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <label className={`flex items-start gap-3 rounded-lg border px-3 py-3 cursor-pointer ${exportMode === 'month' ? 'border-blue-700 bg-blue-950/30' : 'border-slate-800 hover:border-slate-700'}`}>
                <input
                  type="radio"
                  name="export-mode"
                  className="mt-1 accent-blue-500"
                  checked={exportMode === 'month'}
                  onChange={() => setExportMode('month')}
                />
                <span>
                  <span className="block text-sm text-slate-100">This month</span>
                  <span className="block text-xs text-slate-500">{format(new Date(`${filterMonth}-01`), 'MMMM yyyy')}</span>
                </span>
              </label>
              <label className={`flex items-start gap-3 rounded-lg border px-3 py-3 cursor-pointer ${exportMode === 'year' ? 'border-blue-700 bg-blue-950/30' : 'border-slate-800 hover:border-slate-700'}`}>
                <input
                  type="radio"
                  name="export-mode"
                  className="mt-1 accent-blue-500"
                  checked={exportMode === 'year'}
                  onChange={() => setExportMode('year')}
                />
                <span>
                  <span className="block text-sm text-slate-100">This year</span>
                  <span className="block text-xs text-slate-500">January – December {filterMonth.slice(0, 4)}</span>
                </span>
              </label>
              <label className={`flex items-start gap-3 rounded-lg border px-3 py-3 cursor-pointer ${exportMode === 'range' ? 'border-blue-700 bg-blue-950/30' : 'border-slate-800 hover:border-slate-700'}`}>
                <input
                  type="radio"
                  name="export-mode"
                  className="mt-1 accent-blue-500"
                  checked={exportMode === 'range'}
                  onChange={() => setExportMode('range')}
                />
                <span className="flex-1">
                  <span className="block text-sm text-slate-100">Choose months</span>
                  <span className="block text-xs text-slate-500 mb-2">Any from–to range</span>
                  <div className="grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
                    <div>
                      <p className="text-[11px] text-slate-500 mb-1">From</p>
                      <select
                        value={rangeFrom}
                        onChange={(e) => {
                          setExportMode('range');
                          setRangeFrom(e.target.value);
                        }}
                        className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg px-2 py-2 focus:outline-none focus:border-blue-500"
                      >
                        {rangeMonthOptions.map((m) => (
                          <option key={m} value={m}>{format(new Date(`${m}-01`), 'MMMM yyyy')}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500 mb-1">To</p>
                      <select
                        value={rangeTo}
                        onChange={(e) => {
                          setExportMode('range');
                          setRangeTo(e.target.value);
                        }}
                        className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-lg px-2 py-2 focus:outline-none focus:border-blue-500"
                      >
                        {rangeMonthOptions.map((m) => (
                          <option key={m} value={m}>{format(new Date(`${m}-01`), 'MMMM yyyy')}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </span>
              </label>
            </div>

            <p className="text-xs text-slate-400">
              {exportPreview.months} month{exportPreview.months === 1 ? '' : 's'} · {money(exportPreview.total)}
              {exportPreview.operators ? ` · ${exportPreview.operators} operator row${exportPreview.operators === 1 ? '' : 's'}` : ''}
            </p>

            <div className="flex gap-2">
              <Button
                onClick={handleDownloadExport}
                disabled={!exportMonths.length}
                className="flex-1 bg-green-700 hover:bg-green-600 gap-2"
              >
                <Download className="h-4 w-4" />
                Download CSV
              </Button>
              <Button variant="ghost" className="text-slate-400 hover:text-slate-100" onClick={() => setExportOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
      {datePickerFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <h3 className="text-slate-100 font-semibold text-base">Mark as Paid — {datePickerFor.name}</h3>
            <p className="text-slate-400 text-sm">Choose the payment date:</p>
            <div className="space-y-2">
              <button
                onClick={() => confirmTogglePaid(datePickerFor, format(new Date(), 'yyyy-MM-dd'))}
                className="w-full text-left px-4 py-3 rounded-lg bg-blue-950/40 border border-blue-800 text-blue-400 hover:bg-blue-600/30 transition-colors text-sm font-medium"
              >
                Use today — {format(new Date(), 'd MMMM yyyy')}
              </button>
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-800 text-slate-100 text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-blue-500"
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
            <Button variant="ghost" className="w-full text-slate-500 hover:text-slate-100" onClick={() => setDatePickerFor(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
