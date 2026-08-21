import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Camera, Download, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import { calculateOperatorEarnings, exportOperatorPDF } from '../components/utils/earningsUtils';

export default function Earnings() {
  const { user } = useApp();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [expandedShoot, setExpandedShoot] = useState(null);
  const monthStr = format(currentMonth, 'yyyy-MM');

  const goMonth = (delta) => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + delta);
    setCurrentMonth(d);
  };

  const { data: allShoots = [] } = useQuery({
    queryKey: ['shoots-earnings'],
    queryFn: () => base44.entities.Shoot.list('-date', 2000),
  });

  const { data: appSettings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const { data: paymentRecords = [] } = useQuery({
    queryKey: ['paymentRecords'],
    queryFn: () => base44.entities.PaymentRecord.list('-created_date', 1000),
  });

  const baseRate = parseFloat(appSettings.find(s => s.key === 'base_rate')?.value) || 1000;
  const additionalRate = parseFloat(appSettings.find(s => s.key === 'additional_rate')?.value) || 250;

  const myShootsForMonth = useMemo(() => {
    const safeEmail = user?.email?.toLowerCase()?.trim();
    return allShoots.filter(s =>
      s.date?.startsWith(monthStr) &&
      s.status !== 'cancelled' &&
      s.assigned_operators?.some(e => e?.toLowerCase()?.trim() === safeEmail)
    );
  }, [allShoots, user, monthStr]);

  const { breakdown } = calculateOperatorEarnings(myShootsForMonth, user?.email, baseRate, additionalRate);

  const adjustedBreakdown = breakdown.map(item => {
    const rec = paymentRecords.find(r =>
      r.shoot_id === item.shoot?.id &&
      r.operator_email?.toLowerCase()?.trim() === user?.email?.toLowerCase()?.trim()
    );
    let amount = item.amount;
    let isAdditional = item.isAdditional;
    if (rec?.override_fee != null) amount = Number(rec.override_fee);
    if (rec?.is_additional != null) {
      isAdditional = rec.is_additional;
      amount = rec.override_fee != null ? Number(rec.override_fee) : (isAdditional ? additionalRate : baseRate);
    }
    const paid = rec?.paid || false;
    return { ...item, amount, isAdditional, paid };
  }).sort((a, b) => a.date.localeCompare(b.date));

  const adjustedTotal = adjustedBreakdown.reduce((s, b) => s + b.amount, 0);
  const paidTotal = adjustedBreakdown.filter(b => b.paid).reduce((s, b) => s + b.amount, 0);
  const mainShoots = adjustedBreakdown.filter(b => !b.isAdditional);
  const additionalShoots = adjustedBreakdown.filter(b => b.isAdditional);

  const handleExport = () => {
    exportOperatorPDF({
      name: user?.full_name || user?.email,
      email: user?.email,
      total: adjustedTotal,
      breakdown: adjustedBreakdown,
      month: format(currentMonth, 'MMMM yyyy'),
    });
  };

  return (
    <div className="min-h-screen bg-slate-800 text-slate-100 p-4 md:p-6">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-emerald-400" />
              My Earnings
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">{user?.full_name || user?.email}</p>
          </div>
          <Button
            onClick={handleExport}
            className="bg-green-700 hover:bg-green-600 gap-2 text-sm"
            disabled={adjustedBreakdown.length === 0}
          >
            <Download className="h-4 w-4" /> PDF
          </Button>
        </div>

        {/* Month navigator */}
        <div className="flex items-center justify-center gap-4 mb-5">
          <Button size="icon" variant="ghost" className="h-9 w-9 text-slate-400 hover:text-slate-100 hover:bg-slate-800" onClick={() => goMonth(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="text-lg font-semibold text-slate-100 w-36 text-center">{format(currentMonth, 'MMMM yyyy')}</span>
          <Button size="icon" variant="ghost" className="h-9 w-9 text-slate-400 hover:text-slate-100 hover:bg-slate-800" onClick={() => goMonth(1)}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-emerald-400">R{adjustedTotal.toLocaleString()}</p>
              <p className="text-xs text-slate-400 mt-1">Total Earned</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-slate-100">{mainShoots.length}</p>
              <p className="text-xs text-slate-400 mt-1">Main Shoots</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-amber-400">{additionalShoots.length}</p>
              <p className="text-xs text-slate-400 mt-1">Additional</p>
            </CardContent>
          </Card>
        </div>

        {/* Paid summary */}
        {paidTotal > 0 && (
          <div className="bg-emerald-950/40 border border-green-800/40 rounded-xl px-4 py-3 mb-4 flex items-center justify-between">
            <span className="text-sm text-green-300">Paid so far</span>
            <span className="text-lg font-bold text-emerald-400">R{paidTotal.toLocaleString()}</span>
          </div>
        )}

        {/* Shoot list */}
        {adjustedBreakdown.length === 0 ? (
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-12 text-center">
              <Camera className="h-10 w-10 text-gray-700 mx-auto mb-3" />
              <p className="text-slate-500">No shoots for {format(currentMonth, 'MMMM yyyy')}.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {adjustedBreakdown.map((item, idx) => {
              const isExpanded = expandedShoot === idx;
              return (
                <Card key={idx} className="bg-slate-900 border-slate-800 overflow-hidden">
                  <button
                    className="w-full text-left px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    onClick={() => setExpandedShoot(isExpanded ? null : idx)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate">{item.shoot?.title || 'Game'}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {format(new Date(item.date + 'T12:00:00'), 'EEE, MMM d')}
                        {item.shoot?.game_time && ` · ${item.shoot.game_time}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-3 flex-shrink-0">
                      <div className="text-right">
                        <p className="text-sm font-bold text-emerald-400">R{item.amount.toLocaleString()}</p>
                        {item.paid && <p className="text-xs text-green-600">Paid</p>}
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <CardContent className="px-4 pb-4 pt-0 border-t border-slate-800 space-y-2">
                      <div className="flex flex-wrap gap-2 mt-3">
                        {item.isAdditional && (
                          <Badge className="text-xs bg-yellow-500/20 text-amber-400 border-yellow-500/30">Additional Shoot</Badge>
                        )}
                        {item.paid
                          ? <Badge className="text-xs bg-green-500/20 text-emerald-400 border-green-500/30">Paid</Badge>
                          : <Badge className="text-xs bg-slate-700/60 text-slate-400 border-slate-800">Pending Payment</Badge>
                        }
                      </div>
                      {item.shoot?.location && (
                        <p className="text-xs text-slate-400">📍 {item.shoot.location}</p>
                      )}
                      {item.shoot?.client && (
                        <p className="text-xs text-slate-400">🏟️ {item.shoot.client}</p>
                      )}
                      <div className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2 mt-2">
                        <span className="text-xs text-slate-400">Fee</span>
                        <span className="text-sm font-bold text-emerald-400">R{item.amount.toLocaleString()}</span>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}