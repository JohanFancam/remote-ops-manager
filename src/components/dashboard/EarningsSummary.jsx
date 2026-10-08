import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Download, ChevronRight } from 'lucide-react';
import {
  getAllOperatorsEarnings,
  exportSummaryPDF,
  DEFAULT_BASE_RATE,
  DEFAULT_ADDITIONAL_RATE,
  DEFAULT_POSTPONED_RATE,
} from '../utils/earningsUtils';
import { formatZAR } from '../../utils/shootStatus';
import OperatorDetailModal from './OperatorDetailModal';

// ADDED: user prop to allow the component to filter for a specific operator
export default function EarningsSummary({
  shoots = [],
  users = [],
  user,
  appSettings = [],
}) {
  const [selectedOperator, setSelectedOperator] = useState(null);

  const baseRate = parseFloat(appSettings.find(s => s.key === 'base_rate')?.value) || DEFAULT_BASE_RATE;
  const additionalRate = parseFloat(appSettings.find(s => s.key === 'additional_rate')?.value) || DEFAULT_ADDITIONAL_RATE;
  const postponedRate = parseFloat(appSettings.find(s => s.key === 'postponed_rate')?.value) || DEFAULT_POSTPONED_RATE;

  let operators = getAllOperatorsEarnings(shoots, users, baseRate, additionalRate, postponedRate);

  // NEW: Filter for specific operator if they aren't an admin
  // Base44 typically sets user.role. This checks if we should limit the view.
  if (user && user.role !== 'admin') {
    const safeEmail = user.email?.toLowerCase()?.trim();
    operators = operators.filter(op => op.email?.toLowerCase()?.trim() === safeEmail);
  }

  const grandTotal = operators.reduce((s, o) => s + o.total, 0);
  const handleExport = () => exportSummaryPDF(operators, 'Earnings Summary');

  return (
    <>
      <Card className="bg-slate-900 border-slate-800 mt-8">
        <CardHeader className="border-b border-slate-800 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-slate-100 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              {user?.role === 'admin' ? 'Operator Earnings Summary' : 'My Monthly Summary'}
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-slate-500">Total Earnings (ZAR)</p>
                <p className="text-lg font-bold text-emerald-400">{formatZAR(grandTotal)}</p>
              </div>
              <Button onClick={handleExport} size="sm" className="bg-orange-500 hover:bg-orange-400">
                <Download className="h-4 w-4 mr-1" /> PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {operators.length === 0 ? (
            <p className="text-slate-500 text-sm p-6 text-center">No earnings data found.</p>
          ) : (
            <div>
              <div className="grid grid-cols-4 px-5 py-2 text-xs text-slate-500 uppercase tracking-wider border-b border-slate-800">
                <span>Operator</span>
                <span className="text-center">Shoots</span>
                <span className="text-center">Additional</span>
                <span className="text-right">Earnings</span>
              </div>
              <div className="divide-y divide-gray-800">
                {operators.map(op => (
                  <button
                    key={op.email}
                    onClick={() => setSelectedOperator(op)}
                    className="w-full grid grid-cols-4 px-5 py-4 hover:bg-slate-800/60 transition-colors text-left items-center"
                  >
                    <div>
                      <p className="font-medium text-slate-100">{op.name}</p>
                      <p className="text-xs text-slate-500">{op.email}</p>
                    </div>
                    <div className="text-center text-slate-100 font-semibold">{op.shootCount}</div>
                    <div className="text-center text-amber-400 text-sm">
                      {op.breakdown.filter(b => b.isAdditional).length || '—'}
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-emerald-400 font-bold">{formatZAR(op.total)}</span>
                      <ChevronRight className="h-4 w-4 text-gray-600" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <OperatorDetailModal operator={selectedOperator} onClose={() => setSelectedOperator(null)} />
    </>
  );
}
