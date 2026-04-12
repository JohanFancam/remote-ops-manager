import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Camera, Download, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { calculateOperatorEarnings, exportOperatorPDF } from '../utils/earningsUtils';

export default function RemoteEarnings({ user }) {
  const [expanded, setExpanded] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
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

  // Apply payment record overrides
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
    return { ...item, amount, isAdditional };
  });

  const adjustedTotal = adjustedBreakdown.reduce((s, b) => s + b.amount, 0);
  const mainShoots = adjustedBreakdown.filter(b => !b.isAdditional);
  const additionalShoots = adjustedBreakdown.filter(b => b.isAdditional);

  return (
    <Card className="bg-gray-900 border-gray-800 mt-8">
      <CardHeader className="border-b border-gray-800 pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-400" />
            My Earnings Summary
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-white" onClick={() => goMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-gray-300 w-24 text-center">{format(currentMonth, 'MMM yyyy')}</span>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-white" onClick={() => goMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" className="border-green-700/50 text-green-400 hover:bg-green-900/30 gap-1.5 text-xs h-7"
              onClick={() => exportOperatorPDF({ name: user?.full_name || user?.email, email: user?.email, total: adjustedTotal, breakdown: adjustedBreakdown, month: format(currentMonth, 'MMMM yyyy') })}>
              <Download className="h-3 w-3" /> PDF
            </Button>
            <Button size="sm" variant="outline" className="border-green-700/50 text-green-400 hover:bg-green-900/30 gap-1.5 text-xs h-7"
              onClick={() => {
                if (adjustedBreakdown.length === 0) return;
                const monthLabel = format(currentMonth, 'MMMM yyyy');
                const lines = [`📅 *My Schedule — ${monthLabel}*`, ''];
                adjustedBreakdown
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .forEach(item => {
                    const title = item.shoot?.title || 'Game';
                    const date = format(new Date(item.date + 'T12:00:00'), 'EEE, MMM d');
                    const time = item.shoot?.game_time ? ` @ ${item.shoot.game_time}` : '';
                    const rigType = item.shoot?.rig_type_override || '';
                    const typeLabel = rigType ? ` [${rigType}]` : '';
                    lines.push(`• *${title}*${typeLabel}`);
                    lines.push(`  📆 ${date}${time}`);
                    lines.push('');
                  });
                lines.push(`💰 *Total: R${adjustedTotal.toLocaleString()}*`);
                window.open(`https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`, '_blank');
              }}>
              <MessageCircle className="h-3 w-3" /> WhatsApp
            </Button>
            <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white gap-1.5 text-xs ml-1"
              onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Less' : 'Details'}
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-400">R{adjustedTotal.toLocaleString()}</p>
            <p className="text-xs text-gray-400">Total Earned</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <Camera className="h-5 w-5 text-blue-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">{mainShoots.length}</p>
            <p className="text-xs text-gray-400">Main Shoots</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-yellow-400">{additionalShoots.length}</p>
            <p className="text-xs text-gray-400">Additional</p>
          </div>
        </div>

        {expanded && (
          <div className="space-y-3">
            {adjustedBreakdown.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No shoots assigned for {format(currentMonth, 'MMMM yyyy')}.</p>
            ) : (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wider">Shoots This Month</p>
                  <Button size="sm" variant="ghost" className="h-6 text-xs text-blue-400 hover:text-blue-300 gap-1 px-2"
                    onClick={() => exportOperatorPDF({ name: user?.full_name || user?.email, email: user?.email, total: adjustedTotal, breakdown: adjustedBreakdown })}>
                    <Download className="h-3 w-3" /> PDF
                  </Button>
                </div>
                <div className="space-y-1">
                  {adjustedBreakdown.sort((a, b) => a.date.localeCompare(b.date)).map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-gray-800/40 rounded px-3 py-2">
                      <div>
                        <p className="text-sm text-white font-medium">{item.shoot?.title || 'Game'}</p>
                        <p className="text-xs text-gray-400">
                          {format(new Date(item.date + 'T12:00:00'), 'EEE, MMM d')}
                          {item.shoot?.game_time && ` · ${item.shoot.game_time}`}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-green-400">R{item.amount.toLocaleString()}</p>
                        {item.isAdditional && (
                          <Badge className="text-xs bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Additional</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}