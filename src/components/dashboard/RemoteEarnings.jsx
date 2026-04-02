import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Download, Camera, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { calculateOperatorEarnings, exportOperatorPDF } from '../utils/earningsUtils';

export default function RemoteEarnings({ shoots, user }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const monthStr = format(currentMonth, 'yyyy-MM');

  const { data: appSettings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const { data: paymentRecords = [] } = useQuery({
    queryKey: ['paymentRecords'],
    queryFn: () => base44.entities.PaymentRecord.list('-created_date', 2000),
  });

  const baseRate = parseFloat(appSettings.find(s => s.key === 'base_rate')?.value) || 1000;
  const additionalRate = parseFloat(appSettings.find(s => s.key === 'additional_rate')?.value) || 250;

  // Filter shoots for selected month
  const monthShoots = shoots.filter(s => s.date?.startsWith(monthStr));
  const opRecords = paymentRecords.filter(r => r.operator_email === user?.email && r.period_month === monthStr);

  const { total, breakdown } = calculateOperatorEarnings(monthShoots, user?.email, baseRate, additionalRate);

  // Apply any admin override fees or manual additional flags from PaymentRecord
  const adjustedBreakdown = breakdown.map(item => {
    const rec = opRecords.find(r => r.shoot_id === item.shoot?.id);
    let amount = item.amount;
    let isAdditional = item.isAdditional;
    if (rec?.override_fee != null) { amount = rec.override_fee; }
    if (rec?.is_additional != null) {
      isAdditional = rec.is_additional;
      amount = rec.override_fee != null ? rec.override_fee : (isAdditional ? additionalRate : baseRate);
    }
    return { ...item, amount, isAdditional };
  });

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
        {/* Month navigation */}
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
                      <p className="text-sm text-white">{item.shoot?.title || 'Unnamed'}</p>
                      <p className="text-xs text-gray-500">{item.date}{item.shoot?.game_time ? ` · ${item.shoot.game_time}` : ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.isAdditional && (
                      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">Additional</Badge>
                    )}
                    <span className={`text-sm font-bold ${item.isAdditional ? 'text-yellow-400' : 'text-green-400'}`}>
                      R{item.amount.toLocaleString('en-ZA')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-2">R{baseRate} standard · R{additionalRate} additional (within 2hrs)</p>
          </div>
        ) : (
          <p className="text-gray-500 text-sm text-center py-4">No shoots assigned this month.</p>
        )}
      </CardContent>
    </Card>
  );
}