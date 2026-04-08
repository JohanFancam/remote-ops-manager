import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Download, Camera, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { calculateOperatorEarnings, exportOperatorPDF } from '../utils/earningsUtils';

export default function RemoteEarnings({ shoots = [], user }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const monthStr = format(currentMonth, 'yyyy-MM');

  // Fetch App Settings for rates
  const { data: appSettings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list().catch(() => []),
  });

  // Fetch Payment Records - Increased limit to ensure we don't miss history
  const { data: paymentRecords = [] } = useQuery({
    queryKey: ['paymentRecords'],
    queryFn: () => base44.entities.PaymentRecord.list('-created_date', 5000).catch(() => []),
  });

  const baseRate = parseFloat(appSettings.find(s => s.key === 'base_rate')?.value) || 1000;
  const additionalRate = parseFloat(appSettings.find(s => s.key === 'additional_rate')?.value) || 250;

  // 1. IMPROVED: Month filtering that handles multiple date formats (ISO, YYYY/MM/DD, etc)
  const monthShoots = shoots.filter(s => {
    if (!s.date) return false;
    const cleanDate = s.date.replaceAll('/', '-');
    return cleanDate.includes(monthStr);
  });

  // 2. IMPROVED: Case-insensitive and trimmed email matching
  const userEmail = user?.email?.toLowerCase()?.trim();
  
  const opRecords = paymentRecords.filter(r => 
    r.operator_email?.toLowerCase()?.trim() === userEmail && 
    r.period_month === monthStr
  );

  // 3. Fallback Calculation if utility fails or data is slightly mismatched
  let { total, breakdown } = calculateOperatorEarnings(
    monthShoots, 
    userEmail, 
    baseRate, 
    additionalRate
  );

  // 4. APPLY ADMIN OVERRIDES
  const adjustedBreakdown = breakdown.map(item => {
    // Try to find a manual payment record matching this specific shoot
    const rec = opRecords.find(r => r.shoot_id === item.shoot?.id);
    let amount = item.amount;
    let isAdditional = item.isAdditional;

    if (rec?.override_fee != null) { 
      amount = Number(rec.override_fee); 
    }
    if (rec?.is_additional != null) {
      isAdditional = rec.is_additional;
      // If override exists use it, otherwise use the standard rate for the type
      amount = rec.override_fee != null ? Number(rec.override_fee) : (isAdditional ? additionalRate : baseRate);
    }
    return { ...item, amount, isAdditional };
  });

  // Final totals
  const adjustedTotal = adjustedBreakdown.reduce((s, b) => s + b.amount, 0);
  const mainCount = adjustedBreakdown.filter(b => !b.isAdditional).length;
  const additionalCount = adjustedBreakdown.filter(b => b.isAdditional).length;

  const goMonth = (delta) => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + delta);
    setCurrentMonth(d);
  };

  const handleExport = () => {
    exportOperatorPDF({
      name: user?.full_name || user?.email,
      email: user?.email,
      total: adjustedTotal,
      breakdown: adjustedBreakdown,
      shootCount: adjustedBreakdown.length,
    });
  };

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="border-b border-gray-800 pb-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-400" />
            My Earnings
          </CardTitle>
          <Button onClick={handleExport} size="sm" className="bg-blue-700 hover:bg-blue-600">
            <Download className="h-4 w-4 mr-1" /> PDF
          </Button>
        </div>
        <div className="flex items-center justify-between mt-3">
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white" onClick={() => goMonth(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold text-white">{format(currentMonth, 'MMMM yyyy')}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white" onClick={() => goMonth(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-400">R{adjustedTotal.toLocaleString('en-ZA')}</p>
            <p className="text-xs text-gray-400 mt-0.5">Total Earned</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-white">{mainCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">Standard</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-yellow-400">{additionalCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">Additional</p>
          </div>
        </div>

        {adjustedBreakdown.length > 0 ? (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Breakdown</p>
            <div className="bg-gray-800 rounded-lg divide-y divide-gray-700 max-h-64 overflow-y-auto">
              {adjustedBreakdown.slice().reverse().map((item, idx) => (
                <div key={idx} className="px-3 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-white">{item.shoot?.title || 'Unnamed Shoot'}</p>
                      <p className="text-xs text-gray-500">{item.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.isAdditional && (
                      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">Additional</Badge>
                    )}
                    <span className={`text-sm font-bold ${item.isAdditional ? 'text-yellow-400' : 'text-green-400'}`}>
                      R{Number(item.amount).toLocaleString('en-ZA')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">No shoots recorded for {format(currentMonth, 'MMMM')}.</p>
            <p className="text-[10px] text-gray-700 mt-2">Check: {user?.email}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}