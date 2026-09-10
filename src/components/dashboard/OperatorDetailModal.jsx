import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Camera } from 'lucide-react';
import { format } from 'date-fns';
import { exportOperatorPDF } from '../utils/earningsUtils';
import { formatZAR, formatDateZA } from '../../utils/shootStatus';
import { shortenTitle } from '../utils/scheduleUtils';

export default function OperatorDetailModal({ operator, onClose }) {
  if (!operator) return null;

  const handleExport = () => exportOperatorPDF(operator);

  // Group breakdown by month
  const byMonth = {};
  operator.breakdown.forEach(item => {
    const month = item.date ? item.date.substring(0, 7) : 'Unknown';
    if (!byMonth[month]) byMonth[month] = [];
    byMonth[month].push(item);
  });

  return (
    <Dialog open={!!operator} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-800 text-slate-100 max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-slate-100 text-xl">{operator.name}</DialogTitle>
          <p className="text-slate-400 text-sm">{operator.email}</p>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 my-4">
          <div className="bg-slate-800 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-slate-100">{operator.shootCount}</p>
            <p className="text-xs text-slate-400 mt-0.5">Paid Shoots</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-emerald-400">{formatZAR(operator.total)}</p>
            <p className="text-xs text-slate-400 mt-0.5">Total Earnings</p>
          </div>
          <div className="bg-slate-800 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-400">
              {operator.breakdown.filter(b => b.isAdditional).length}
            </p>
            <p className="text-xs text-slate-400 mt-0.5">Additional Shoots</p>
          </div>
        </div>

        {/* Breakdown by month */}
        <div className="space-y-4">
          {Object.entries(byMonth).sort(([a], [b]) => b.localeCompare(a)).map(([month, items]) => {
            const monthTotal = items.reduce((s, i) => s + i.amount, 0);
            return (
              <div key={month}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-400">
                    {month ? format(new Date(month + '-01'), 'MMMM yyyy') : 'Unknown'}
                  </h3>
                  <span className="text-sm font-bold text-slate-100">{formatZAR(monthTotal)}</span>
                </div>
                <div className="bg-slate-800 rounded-lg divide-y divide-gray-700">
                  {items.map((item, idx) => (
                    <div key={idx} className={`px-3 py-2.5 flex items-center justify-between ${item.isCancelled ? 'opacity-80' : ''}`}>
                      <div className="flex items-center gap-2">
                        <Camera className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-slate-100">{shortenTitle(item.shoot?.title) || item.shoot?.title || 'Unnamed Shoot'}</p>
                          <p className="text-xs text-slate-500">{formatDateZA(item.date)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.isCancelled && (
                          <Badge className="bg-red-950/40 text-red-400 border-red-800 text-xs">Cancelled</Badge>
                        )}
                        {item.isPostponed && (
                          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">Postponed</Badge>
                        )}
                        {item.isAdditional && (
                          <Badge className="bg-yellow-500/20 text-amber-400 border-yellow-500/30 text-xs">+2nd</Badge>
                        )}
                        <span className={`text-sm font-semibold ${
                          item.isCancelled ? 'text-red-400' :
                          item.isPostponed ? 'text-amber-300' :
                          item.isAdditional ? 'text-amber-400' : 'text-emerald-400'
                        }`}>
                          {item.isCancelled ? 'Cancelled' : formatZAR(item.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-800">
          <div>
            <p className="text-xs text-slate-500">Rates in ZAR · Postponed = R250 · Cancelled = no pay</p>
          </div>
          <Button onClick={handleExport} className="bg-blue-600 hover:bg-blue-600">
            <Download className="h-4 w-4 mr-2" /> Export PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
