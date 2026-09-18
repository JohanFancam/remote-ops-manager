import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft, ChevronRight, Download, TrendingUp, Users,
  DollarSign, CheckCircle2, Circle, RefreshCw, ChevronDown
} from 'lucide-react';
import { format, startOfYear, endOfYear, eachMonthOfInterval } from 'date-fns';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import {
  DEFAULT_BASE_RATE,
  DEFAULT_ADDITIONAL_RATE,
  DEFAULT_POSTPONED_RATE,
  operatorAssignedCost,
} from '../components/utils/earningsUtils';
import { formatZAR } from '../utils/shootStatus';

function exportCSV(rows, month) {
  const header = 'Operator,Amount (ZAR)\n';
  const body = rows
    .map((r) => `"${r.name}",${r.total.toFixed(2)}`)
    .join('\n');
  const blob = new Blob([header + body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Crew_costs_${month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function money(amount) {
  return formatZAR(amount, { withSpace: false });
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
  const [exportMonthOpen, setExportMonthOpen] = useState(false);

  const { data: shoots = [] } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list('-date', 2000),
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const availableMonths = useMemo(() => {
    const months = new Set();
    shoots.forEach((s) => { if (s.date) months.add(s.date.substring(0, 7)); });
    return [...months].sort().reverse();
  }, [shoots]);

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

  const rates = useMemo(() => ({
    baseRate: parseFloat(appSettings.find((s) => s.key === 'base_rate')?.value) || DEFAULT_BASE_RATE,
    additionalRate: parseFloat(appSettings.find((s) => s.key === 'additional_rate')?.value) || DEFAULT_ADDITIONAL_RATE,
    postponedRate: parseFloat(appSettings.find((s) => s.key === 'postponed_rate')?.value) || DEFAULT_POSTPONED_RATE,
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
    const knownUsers = pendingUsers
      .filter((u) => u.role === 'user' || u.role === 'standby')
      .map((u) => ({ email: u.email, full_name: u.full_name || u.email, inactive: u.inactive || false }));
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

  const monthSummaryRows = useMemo(() => {
    const monthShoots = shoots.filter((s) => s.date?.startsWith(filterMonth));
    return remoteUsers.map((op) => {
      const opShoots = monthShoots.filter((s) => s.assigned_operators?.includes(op.email));
      const opRecords = paymentRecords.filter((r) => r.operator_email === op.email && r.period_month === filterMonth);
      const { total } = operatorAssignedCost(opShoots, opRecords, rates);
      const monthRec = paymentRecords.find((r) =>
        r.operator_email === op.email && r.period_month === filterMonth && !r.shoot_id
      );
      return {
        email: op.email,
        name: op.full_name || op.email,
        total,
        paid: monthRec?.paid === true,
        paidDate: monthRec?.paid_date || null,
        inactive: !!op.inactive,
        shoots: opShoots.length,
      };
    }).filter((op) => op.shoots > 0).sort((a, b) => b.total - a.total);
  }, [remoteUsers, shoots, paymentRecords, filterMonth, rates]);

  const grandTotal = monthSummaryRows.reduce((s, r) => s + r.total, 0);
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
        if (opShoots.length === 0) return;
        const opRecords = paymentRecords.filter((r) => r.operator_email === op.email && r.period_month === monthKey);
        total += operatorAssignedCost(opShoots, opRecords, rates).total;
      });
      return {
        month: format(monthDate, 'MMM'),
        monthKey,
        total,
        isCurrentMonth: monthKey === filterMonth,
      };
    });
  }, [shoots, remoteUsers, paymentRecords, filterMonth, rates]);

  const yearTotal = yearChartData.reduce((s, d) => s + d.total, 0);

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
              Monthly crew costs — same fees as Pending / Approve
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <Button onClick={refresh} variant="ghost" size="icon" className="text-slate-500 hover:text-slate-100 h-9 w-9" title="Refresh data">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <div className="relative">
              <Button
                onClick={() => exportCSV(monthSummaryRows, filterMonth)}
                className="bg-green-700 hover:bg-green-600 gap-2 text-sm rounded-r-none"
              >
                <Download className="h-4 w-4" />
                Export {format(new Date(`${filterMonth}-01`), 'MMM yyyy')}
              </Button>
              <Button
                onClick={() => setExportMonthOpen(!exportMonthOpen)}
                className="bg-green-700 hover:bg-green-600 text-sm px-2 rounded-l-none border-l border-green-600"
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${exportMonthOpen ? 'rotate-180' : ''}`} />
              </Button>
              {exportMonthOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-slate-800 border border-slate-800 rounded-lg shadow-xl z-20 py-1 max-h-60 overflow-y-auto">
                  {availableMonths.map((m) => (
                    <button
                      key={m}
                      onClick={() => {
                        const monthShoots = shoots.filter((s) => s.date?.startsWith(m));
                        const rows = remoteUsers.map((op) => {
                          const opShoots = monthShoots.filter((s2) => s2.assigned_operators?.includes(op.email));
                          const opRecords = paymentRecords.filter((r) => r.operator_email === op.email && r.period_month === m);
                          const { total } = operatorAssignedCost(opShoots, opRecords, rates);
                          return { name: op.full_name || op.email, total, shoots: opShoots.length };
                        }).filter((op) => op.shoots > 0);
                        setFilterMonth(m);
                        setExportMonthOpen(false);
                        exportCSV(rows, m);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-700 transition-colors ${m === filterMonth ? 'text-emerald-400 font-medium' : 'text-slate-400'}`}
                    >
                      {format(new Date(`${m}-01`), 'MMMM yyyy')}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
                <Bar dataKey="total" name="Cost" radius={[4, 4, 0, 0]}>
                  {yearChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.isCurrentMonth ? '#3b82f6' : '#374151'} />
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

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-blue-400" />
                <p className="text-slate-400 text-sm">This month</p>
              </div>
              <p className="text-2xl font-bold text-slate-100">{money(grandTotal)}</p>
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
          <Card className="bg-slate-900 border-slate-800 col-span-2 md:col-span-1">
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
              </div>
              <div className="divide-y divide-gray-800">
                {monthSummaryRows.map((row) => (
                  <div
                    key={row.email}
                    className={`px-5 py-4 flex items-center justify-between gap-3 ${row.inactive ? 'opacity-40' : ''} ${row.paid ? 'bg-emerald-950/30' : ''}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-100 truncate">{row.name}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="font-mono font-bold text-slate-100 text-sm">{money(row.total)}</span>
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
                <span className="font-mono font-bold text-slate-100">{money(grandTotal)}</span>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

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
