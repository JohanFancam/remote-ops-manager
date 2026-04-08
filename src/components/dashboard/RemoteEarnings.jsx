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

  // 1. FETCH DATA DIRECTLY (Prevents issues if the parent isn't passing props)
  const { data: allShoots = [], isLoading: loadingShoots, refetch } = useQuery({
    queryKey: ['my-shoots-earnings'],
    queryFn: () => base44.entities.Shoot.list('-date', 1000).catch(() => []),
  });

  const { data: appSettings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list().catch(() => []),
  });

  const { data: paymentRecords = [] } = useQuery({
    queryKey: ['paymentRecords'],
    queryFn: () => base44.entities.PaymentRecord.list('-created_date', 1000).catch(() => []),
  });

  const baseRate = parseFloat(appSettings.find(s => s.key === 'base_rate')?.value) || 1000;
  const additionalRate = parseFloat(appSettings.find(s => s.key === 'additional_rate')?.value) || 250;

  // 2. AGGRESSIVE FILTERING: Look for ANY match (Email, ID, or Name)
  const myShootsForMonth = useMemo(() => {
    const safeEmail = user?.email?.toLowerCase()?.trim();
    const safeName = user?.full_name?.toLowerCase()?.trim();
    const safeId = user?.id;

    return allShoots.filter(s => {
      // Date Check (Handle / and -)
      const normalizedDate = s.date?.replaceAll('/', '-');
      const isCorrectMonth = normalizedDate?.includes(monthStr);

      // Assignment Check
      const isAssignedToMe = 
        (s.operator_email?.toLowerCase()?.trim() === safeEmail) ||
        (s.operator_id === safeId) ||
        (s.operator_name?.toLowerCase()?.trim() === safeName);

      return isCorrectMonth && isAssignedToMe;
    });
  }, [allShoots, user, monthStr]);

  // 3. CALCULATION
  const { total, breakdown } = calculateOperatorEarnings(
    myShootsForMonth, 
    user?.email?.toLowerCase()?.trim(), 
    baseRate, 
    additionalRate
  );

  // 4. APPLY OVERRIDES
  const adjustedBreakdown = breakdown.map(item => {
    const rec = paymentRecords.find(r => 
      r.shoot_id === item.shoot?.id && 
      r.operator_email?.toLowerCase() === user?.email?.toLowerCase()
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
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="border-b border-gray-800 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-green-400" />
            My Earnings Summary
          </CardTitle>
          <div className="flex gap-2">
            <Button onClick={() => refetch()} size="icon" variant="ghost" className="h-8 w-8 text-gray-400">
              <RefreshCw className={`h-4 w-4 ${loadingShoots ? 'animate-spin' : ''}`} />
            </Button>
            <Button onClick={() => exportOperatorPDF({ name: user?.full_name, total: adjustedTotal, breakdown: adjustedBreakdown })} size="sm" className="bg-blue-700 h-8">
              <Download className="h-4 w-4 mr-1" /> PDF
            </Button>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 bg-gray-800/50 rounded-md p-1">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400" onClick={() => goMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs font-bold text-white uppercase tracking-wider">{format(currentMonth, 'MMMM yyyy')}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400" onClick={() => goMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-gray-800 rounded-lg p-2 text-center border border-gray-700">
            <p className="text-xl font-bold text-green-400">R{adjustedTotal.toLocaleString()}</p>
            <p className="text-[10px] text-gray-500 uppercase">Earned</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-2 text-center border border-gray-700">
            <p className="text-xl font-bold text-white">{adjustedBreakdown.filter(b => !b.isAdditional).length}</p>
            <p className="text-[10px] text-gray-500 uppercase">Std</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-2 text-center border border-gray-700">
            <p className="text-xl font-bold text-yellow-500">{adjustedBreakdown.filter(b => b.isAdditional).length}</p>
            <p className="text-[10px] text-gray-500 uppercase">Add</p>
          </div>
        </div>

        {adjustedBreakdown.length > 0 ? (
          <div className="space-y-2">
            {adjustedBreakdown.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between bg-gray-800/30 p-2 rounded-md border border-gray-800">
                <div className="flex items-center gap-2">
                  <Camera className="h-3 w-3 text-blue-400" />
                  <div className="leading-tight">
                    <p className="text-xs text-white font-medium">{item.shoot?.title || 'Game'}</p>
                    <p className="text-[10px] text-gray-500">{item.date}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-green-400">R{item.amount}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 border-2 border-dashed border-gray-800 rounded-lg">
            <p className="text-gray-600 text-xs">No assigned shoots found for this month.</p>
            <p className="text-[9px] text-gray-700 mt-1 uppercase tracking-tighter">Identity: {user?.email}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}