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
  Download, Check, X, FileText, Edit2, Save, RefreshCw, Clock, CheckCircle2
} from 'lucide-react';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import { getAdditionalShootIds } from '../components/utils/earningsUtils';

function exportPDF(rows, month, baseRate, additionalRate) {
  const doc = new jsPDF();
  doc.setFontSize(16); doc.setFont('helvetica', 'bold');
  doc.text('Remote Ops — Accounts Summary', 20, 20);
  doc.setFontSize(11); doc.setFont('helvetica', 'normal');
  doc.text(`Month: ${month}   |   Standard: R${baseRate}  Additional: R${additionalRate}`, 20, 30);
  doc.setFontSize(8); doc.setTextColor(120, 120, 120);
  doc.text(`Generated: ${new Date().toLocaleDateString('en-ZA')}`, 20, 38);
  let y = 52;
  doc.setTextColor(0, 0, 0);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(9);
  doc.text('Operator', 20, y); doc.text('Shoots', 90, y); doc.text('Amount (ZAR)', 130, y); doc.text('Status', 175, y);
  doc.setDrawColor(180, 180, 180); doc.line(20, y + 3, 190, y + 3); y += 10;
  doc.setFont('helvetica', 'normal');
  rows.forEach(r => {
    if (y > 270) { doc.addPage(); y = 20; }
    doc.text((r.name || r.email).substring(0, 35), 20, y);
    doc.text(String(r.shoots), 90, y);
    doc.text(`R${r.total.toFixed(2)}`, 130, y);
    doc.text(r.paid ? 'PAID' : 'UNPAID', 175, y);
    y += 9;
  });
  doc.line(20, y + 2, 190, y + 2); y += 8;
  doc.setFont('helvetica', 'bold');
  const grand = rows.reduce((s, r) => s + r.total, 0);
  doc.text('TOTAL', 20, y);
  doc.text(`R${grand.toFixed(2)}`, 130, y);
  doc.save(`Accounts_${month}.pdf`);
}

function exportCSV(rows, month) {
  const header = 'Operator,Email,Shoots,Amount (ZAR),Paid\n';
  const body = rows.map(r => `"${r.name}","${r.email}",${r.shoots},${r.total.toFixed(2)},${r.paid ? 'Yes' : 'No'}`).join('\n');
  const blob = new Blob([header + body], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `Accounts_${month}.csv`; a.click();
}

function OperatorRow({ op, shoots, pendingShoots, paymentRecords, month, onSaveFee, onTogglePaid, onSaveNote, onToggleAdditional, onApprove, onReject, baseRate, additionalRate }) {
  const [expanded, setExpanded] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editFee, setEditFee] = useState('');
  const [note, setNote] = useState('');
  const [editingNote, setEditingNote] = useState(null);

  const opShoots = shoots
    .filter(s => s.assigned_operators?.includes(op.email))
    .sort((a, b) => {
      const dc = a.date.localeCompare(b.date);
      return dc !== 0 ? dc : (a.game_time || '').localeCompare(b.game_time || '');
    });

  const opRecords = paymentRecords.filter(r => r.operator_email === op.email && r.period_month === month);
  const getRecord = (shoot) => opRecords.find(r => r.shoot_id === shoot.id);

  const shootsByDate = useMemo(() => {
    const byDate = {};
    opShoots.forEach(s => {
      if (!byDate[s.date]) byDate[s.date] = [];
      byDate[s.date].push(s);
    });
    return byDate;
  }, [opShoots]);

  const autoAdditionalIds = useMemo(() => {
    const ids = new Set();
    Object.values(shootsByDate).forEach(dayShots => {
      getAdditionalShootIds(dayShots).forEach(id => ids.add(id));
    });
    return ids;
  }, [shootsByDate]);

  const isAdditional = (shoot) => {
    const rec = getRecord(shoot);
    if (rec?.is_additional != null) return rec.is_additional;
    return autoAdditionalIds.has(shoot.id);
  };

  const getFee = (shoot) => {
    const rec = getRecord(shoot);
    if (rec?.override_fee != null) return rec.override_fee;
    return isAdditional(shoot) ? additionalRate : baseRate;
  };

  const total = opShoots.reduce((s, sh) => s + getFee(sh), 0);
  const allPaid = opShoots.length > 0 && opShoots.every(sh => getRecord(sh)?.paid === true);

  const handleSaveFee = async (shoot) => {
    const rec = getRecord(shoot);
    await onSaveFee({ shoot, email: op.email, name: op.full_name, month, override_fee: parseFloat(editFee), existingId: rec?.id });
    setEditingId(null);
  };

  const handleTogglePaid = async (shoot) => {
    const rec = getRecord(shoot);
    await onTogglePaid({ shoot, email: op.email, name: op.full_name, month, paid: !rec?.paid, existingId: rec?.id });
  };

  const handleToggleAllPaid = async () => {
    for (const shoot of opShoots) {
      const rec = getRecord(shoot);
      await onTogglePaid({ shoot, email: op.email, name: op.full_name, month, paid: !allPaid, existingId: rec?.id });
    }
  };

  const handleSaveNote = async (shoot) => {
    const rec = getRecord(shoot);
    await onSaveNote({ shoot, email: op.email, name: op.full_name, month, notes: note, existingId: rec?.id });
    setEditingNote(null);
    setNote('');
  };

  const handleToggleAdditional = async (shoot) => {
    const rec = getRecord(shoot);
    const current = isAdditional(shoot);
    await onToggleAdditional({ shoot, email: op.email, name: op.full_name, month, is_additional: !current, existingId: rec?.id });
  };

  const hasPending = pendingShoots.length > 0;

  return (
    <div className={`rounded-xl border transition-colors ${
      allPaid ? 'border-green-800/60 bg-green-950/10'
      : hasPending ? 'border-yellow-800/40 bg-gray-900'
      : 'border-gray-800 bg-gray-900'
    }`}>
      <button className="w-full flex items-center gap-4 p-4 text-left" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-white">{op.full_name || op.email}</p>
          <p className="text-xs text-gray-500">{op.email}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {hasPending && (
            <span className="flex items-center gap-1 text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full">
              <Clock className="h-3 w-3" /> {pendingShoots.length} pending
            </span>
          )}
          <div className="text-right">
            <p className="text-sm text-gray-400">{opShoots.length} shoot{opShoots.length !== 1 ? 's' : ''}</p>
            <p className="font-mono font-bold text-white">R{total.toFixed(2)}</p>
          </div>
          <Badge className={allPaid ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'}>
            {allPaid ? 'Paid' : 'Unpaid'}
          </Badge>
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

          {/* Approved shoots */}
          {opShoots.length > 0 && (
            <p className="text-xs font-semibold text-green-400 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3" /> Approved Shoots ({opShoots.length})
            </p>
          )}

          {opShoots.length > 0 && (
            <div className="flex justify-end">
              <Button size="sm" onClick={handleToggleAllPaid}
                className={allPaid ? 'bg-gray-700 hover:bg-gray-600 text-xs' : 'bg-green-700 hover:bg-green-600 text-xs'}>
                {allPaid ? 'Mark All Unpaid' : 'Mark All Paid'}
              </Button>
            </div>
          )}

          {opShoots.length === 0 && !hasPending && <p className="text-gray-500 text-sm text-center py-4">No shoots this month.</p>}
          {opShoots.length === 0 && hasPending && <p className="text-gray-500 text-sm text-center py-2">No approved shoots yet.</p>}

          {opShoots.map(shoot => {
            const rec = getRecord(shoot);
            const fee = getFee(shoot);
            const isPaid = rec?.paid === true;
            const additional = isAdditional(shoot);
            const hasOverrideFee = rec?.override_fee != null;
            const hasManualAdditional = rec?.is_additional != null;
            return (
              <div key={shoot.id} className={`rounded-lg p-3 border ${isPaid ? 'border-green-800/40 bg-green-950/10' : 'border-gray-800 bg-gray-800/40'}`}>
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate">{shoot.title}</p>
                    <p className="text-xs text-gray-500">{shoot.date}{shoot.game_time ? ` · ${shoot.game_time}` : ''}</p>
                    <div className="flex gap-1 flex-wrap mt-1">
                      {additional && <Badge className="text-xs bg-orange-500/20 text-orange-400 border-orange-500/30">Additional</Badge>}
                      {hasOverrideFee && <Badge className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30">Fee Override</Badge>}
                      {hasManualAdditional && <Badge className="text-xs bg-purple-500/20 text-purple-400 border-purple-500/30">Manual</Badge>}
                    </div>
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
                        <span className="font-mono font-bold text-white">R{fee.toFixed(2)}</span>
                        <Button size="sm" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-white p-0"
                          onClick={() => { setEditingId(shoot.id); setEditFee(String(fee)); }}>
                          <Edit2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                    <Button size="sm" onClick={() => handleTogglePaid(shoot)}
                      className={`h-7 text-xs px-2 ${isPaid ? 'bg-gray-700 hover:bg-gray-600' : 'bg-green-700 hover:bg-green-600'}`}>
                      {isPaid ? <X className="h-3 w-3" /> : <Check className="h-3 w-3" />}
                    </Button>
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
  const { user, isAdmin } = useApp();
  const queryClient = useQueryClient();
  const canView = isAdmin;

  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'));

  const { data: shoots = [] } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list('-date', 1000),
  });

  const { data: pendingUsers = [] } = useQuery({
    queryKey: ['pendingUsers'],
    queryFn: () => base44.entities.PendingUser.list(),
  });

  const { data: paymentRecords = [] } = useQuery({
    queryKey: ['paymentRecords'],
    queryFn: () => base44.entities.PaymentRecord.list('-created_date', 2000),
  });

  const { data: appSettings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const baseRate = parseFloat(appSettings.find(s => s.key === 'base_rate')?.value) || 1000;
  const additionalRate = parseFloat(appSettings.find(s => s.key === 'additional_rate')?.value) || 250;

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
  // Pending shoots this month (operator in pending_operators, not yet assigned)
  const monthPendingShoots = shoots.filter(s => s.date?.startsWith(filterMonth) && s.status !== 'cancelled' && s.pending_operators?.length > 0);

  // Build operator list from PendingUser (non-admin) + any emails seen in shoots not already covered
  const remoteUsers = useMemo(() => {
    const knownUsers = pendingUsers
      .filter(u => u.role !== 'admin')
      .map(u => ({ email: u.email, full_name: u.full_name || u.email }));
    const knownEmails = new Set(knownUsers.map(u => u.email));

    // Collect all operator emails seen across all shoots
    const extraEmails = new Set();
    shoots.forEach(s => {
      (s.assigned_operators || []).forEach(e => { if (e && !knownEmails.has(e)) extraEmails.add(e); });
      (s.pending_operators || []).forEach(e => { if (e && !knownEmails.has(e)) extraEmails.add(e); });
    });

    // Try to resolve names from payment records
    const nameMap = {};
    paymentRecords.forEach(r => { if (r.operator_email && r.operator_name) nameMap[r.operator_email] = r.operator_name; });

    const extraUsers = [...extraEmails].map(email => ({ email, full_name: nameMap[email] || email }));
    return [...knownUsers, ...extraUsers];
  }, [pendingUsers, shoots, paymentRecords]);

  const summaryRows = useMemo(() => {
    return remoteUsers.map(op => {
      const opShoots = monthShoots.filter(s => s.assigned_operators?.includes(op.email));
      const opPending = monthPendingShoots.filter(s => s.pending_operators?.includes(op.email));
      const opRecords = paymentRecords.filter(r => r.operator_email === op.email && r.period_month === filterMonth);

      const byDate = {};
      opShoots.forEach(s => { if (!byDate[s.date]) byDate[s.date] = []; byDate[s.date].push(s); });
      const autoAdditionalIds = new Set();
      Object.values(byDate).forEach(dayShots => getAdditionalShootIds(dayShots).forEach(id => autoAdditionalIds.add(id)));

      const total = opShoots.reduce((sum, sh) => {
        const rec = opRecords.find(r => r.shoot_id === sh.id);
        if (rec?.override_fee != null) return sum + rec.override_fee;
        const additional = rec?.is_additional != null ? rec.is_additional : autoAdditionalIds.has(sh.id);
        return sum + (additional ? additionalRate : baseRate);
      }, 0);

      const allPaid = opShoots.length > 0 && opShoots.every(sh => opRecords.find(r => r.shoot_id === sh.id)?.paid === true);
      return { ...op, name: op.full_name || op.email, shoots: opShoots.length, pending: opPending.length, total, paid: allPaid };
    }).filter(op => op.shoots > 0 || op.pending > 0);
  }, [remoteUsers, monthShoots, monthPendingShoots, paymentRecords, filterMonth, baseRate, additionalRate]);

  const grandTotal = summaryRows.reduce((s, r) => s + r.total, 0);
  const paidCount = summaryRows.filter(r => r.paid).length;
  const totalPending = summaryRows.reduce((s, r) => s + r.pending, 0);

  const upsertRecord = async ({ shoot, email, name, month, existingId, ...fields }) => {
    const base = {
      operator_email: email,
      operator_name: name,
      period_month: month,
      shoot_id: shoot.id,
      shoot_title: shoot.title,
      shoot_date: shoot.date,
    };
    if (existingId) {
      await base44.entities.PaymentRecord.update(existingId, { ...base, ...fields });
    } else {
      await base44.entities.PaymentRecord.create({ ...base, ...fields });
    }
    refresh();
  };

  const handleSaveFee = (args) => upsertRecord(args);
  const handleTogglePaid = (args) => upsertRecord(args);
  const handleSaveNote = (args) => upsertRecord(args);
  const handleToggleAdditional = (args) => upsertRecord(args);

  const handleApprove = async (shoot, email) => {
    const newPending = (shoot.pending_operators || []).filter(e => e !== email);
    const newAssigned = [...(shoot.assigned_operators || []), email];
    await base44.entities.Shoot.update(shoot.id, {
      pending_operators: newPending,
      assigned_operators: newAssigned,
    });
    refresh();
  };

  const handleReject = async (shoot, email) => {
    const newPending = (shoot.pending_operators || []).filter(e => e !== email);
    await base44.entities.Shoot.update(shoot.id, { pending_operators: newPending });
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
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold">Accounts</h1>
            <p className="text-gray-400 text-sm mt-0.5">Operator earnings — Standard: R{baseRate} · Additional: R{additionalRate}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={() => exportPDF(summaryRows, filterMonth, baseRate, additionalRate)} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2 h-9 text-xs">
              <FileText className="h-4 w-4" /> PDF
            </Button>
            <Button onClick={() => exportCSV(summaryRows, filterMonth)} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 gap-2 h-9 text-xs">
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button onClick={refresh} variant="ghost" size="icon" className="text-gray-500 hover:text-white h-9 w-9">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Month nav */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-gray-800" onClick={() => goMonth(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-xl font-semibold">{format(new Date(filterMonth + '-01'), 'MMMM yyyy')}</h2>
          <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-gray-800" onClick={() => goMonth(1)}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-5">
              <p className="text-gray-400 text-sm">Total Payout</p>
              <p className="text-2xl font-bold text-white mt-1">R{grandTotal.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-5">
              <p className="text-gray-400 text-sm">Operators</p>
              <p className="text-2xl font-bold text-white mt-1">{summaryRows.length}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-5">
              <p className="text-gray-400 text-sm">Paid</p>
              <p className="text-2xl font-bold text-green-400 mt-1">{paidCount} / {summaryRows.length}</p>
            </CardContent>
          </Card>
          <Card className={`border-gray-800 ${totalPending > 0 ? 'bg-yellow-950/20 border-yellow-800/40' : 'bg-gray-900'}`}>
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
                shoots={monthShoots}
                pendingShoots={monthPendingShoots
                  .filter(s => s.pending_operators?.includes(op.email))
                  .sort((a, b) => a.date.localeCompare(b.date))}
                paymentRecords={paymentRecords}
                month={filterMonth}
                onSaveFee={handleSaveFee}
                onTogglePaid={handleTogglePaid}
                onSaveNote={handleSaveNote}
                onToggleAdditional={handleToggleAdditional}
                onApprove={handleApprove}
                onReject={handleReject}
                baseRate={baseRate}
                additionalRate={additionalRate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}