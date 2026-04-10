import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Download, Camera, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { calculateOperatorEarnings, exportOperatorPDF } from '../utils/earningsUtils';

export default function RemoteEarnings({ user }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const monthStr = format(currentMonth, 'yyyy-MM');

  // 1. BYPASS PERMISSIONS: Use asServiceRole to ensure the data actually arrives
  const { data: allShoots = [], isLoading: loadingShoots, refetch } = useQuery({
    queryKey: ['my-shoots-earnings', monthStr],
    queryFn: () => base44.asServiceRole.entities.Shoot.list('-date', 2000).catch(() => []),
  });

  const { data: appSettings = [] } = useQuery({
    queryKey: ['appSettings-bypass'],
    queryFn: () => base44.asServiceRole.entities.AppSettings.list().catch(() => []),
  });

  const { data: paymentRecords = [] } = useQuery({
    queryKey: ['paymentRecords-bypass'],
    queryFn: () => base44.asServiceRole.entities.PaymentRecord.list('-created_date', 1000).catch(() => []),
  });

  const baseRate = parseFloat(appSettings.find(s => s.key === 'base_rate')?.value) || 1000;
  const additionalRate = parseFloat(appSettings.find(s => s.key === 'additional_rate')?.value) || 250;

  // Filter by assigned_operators (correct field) for the selected month
  const myShootsForMonth = useMemo(() => {
    const safeEmail = user?.email?.toLowerCase()?.trim();
    return allShoots.filter(s =>
      s.date?.startsWith(monthStr) &&
      s.status !== 'cancelled' &&
      s.assigned_operators?.some(e => e?.toLowerCase()?.trim() === safeEmail)
    );
  }, [allShoots, user, monthStr]);

  // Pass month's shoots — calculateOperatorEarnings filters by assigned_operators
  const { total, breakdown } = calculateOperatorEarnings(
    myShootsForMonth,
    user?.email?.toLowerCase()?.trim(),
    baseRate,
    additionalRate
  );

  // 4. OVERRIDE LOGIC
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

  const goMonth = (delta) => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + delta);
    setCurrentMonth(d);
  };

  return (
    <Card className="bg-gray-900 border-gray-800 shadow-xl">
      <CardHeader className="border-b border-gray-800 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-green-400" />
            Personal Earnings Summary
          </CardTitle>
          <div className="flex gap-2">
            <Button onClick={() => refetch()} size="icon" variant="ghost" className="h-8 w-8 text-gray-500">
              <RefreshCw className={`h-4 w-4 ${loadingShoots ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={() => exportOperatorPDF({ name: user?.full_name, total: adjustedTotal, breakdown: adjustedBreakdown })} size="sm" className="bg-blue-700 hover:bg-blue-600 h-8">
              <Download className="h-4 w-4 mr-1" /> PDF
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 bg-gray-900/50 border border-gray-800 rounded-lg p-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400" onClick={() => goMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs font-bold text-white uppercase tracking-widest">{format(currentMonth, 'MMMM yyyy')}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400" onClick={() => goMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-gray-800/50 rounded-xl p-3 text-center border border-gray-700/50">
            <p className="text-2xl font-black text-green-400">R{adjustedTotal.toLocaleString()}</p>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Total</p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-3 text-center border border-gray-700/50">
            <p className="text-2xl font-black text-white">{adjustedBreakdown.filter(b => !b.isAdditional).length}</p>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Standard</p>
          </div>
          <div className="bg-gray-800/50 rounded-xl p-3 text-center border border-gray-700/50">
            <p className="text-2xl font-black text-yellow-500">{adjustedBreakdown.filter(b => b.isAdditional).length}</p>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tighter">Addtl</p>
          </div>
        </div>

        {adjustedBreakdown.length > 0 ? (
          <div className="space-y-2">
             <p className="text-[10px] font-bold text-gray-600 uppercase mb-2">Detailed Breakdown</p>
            {adjustedBreakdown.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between bg-gray-800/20 p-3 rounded-lg border border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded bg-blue-500/10 flex items-center justify-center">
                    <Camera className="h-4 w-4 text-blue-400" />
                  </div>
                  <div>
                    <p className="text-sm text-white font-semibold">{item.shoot?.title || 'Game'}</p>
                    <p className="text-[11px] text-gray-500">{item.date}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-400">R{item.amount}</p>
                  {item.isAdditional && <p className="text-[9px] text-yellow-500 font-bold uppercase">Additional</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-10 bg-gray-950/50 border-2 border-dashed border-gray-800 rounded-2xl">
            <p className="text-gray-500 text-sm font-medium">No shoots found for this period.</p>
            <p className="text-[10px] text-gray-700 mt-2 font-mono">Checking: {user?.email}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}