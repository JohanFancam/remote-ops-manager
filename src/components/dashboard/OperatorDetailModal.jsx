import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Camera } from 'lucide-react';
import { format } from 'date-fns';
import { exportOperatorPDF } from '../utils/earningsUtils';

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
      <DialogContent className="bg-white border-zinc-200 text-zinc-900 max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-zinc-900 text-xl">{operator.name}</DialogTitle>
          <p className="text-zinc-500 text-sm">{operator.email}</p>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 my-4">
          <div className="bg-zinc-100 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-zinc-900">{operator.shootCount}</p>
            <p className="text-xs text-zinc-500 mt-0.5">Total Shoots</p>
          </div>
          <div className="bg-zinc-100 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-emerald-700">R {operator.total.toLocaleString('en-ZA')}</p>
            <p className="text-xs text-zinc-500 mt-0.5">Total Earnings</p>
          </div>
          <div className="bg-zinc-100 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-teal-700">
              {operator.breakdown.filter(b => b.isAdditional).length}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">Additional Shoots</p>
          </div>
        </div>

        {/* Breakdown by month */}
        <div className="space-y-4">
          {Object.entries(byMonth).sort(([a], [b]) => b.localeCompare(a)).map(([month, items]) => {
            const monthTotal = items.reduce((s, i) => s + i.amount, 0);
            return (
              <div key={month}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-zinc-600">
                    {month ? format(new Date(month + '-01'), 'MMMM yyyy') : 'Unknown'}
                  </h3>
                  <span className="text-sm font-bold text-zinc-900">R {monthTotal.toLocaleString('en-ZA')}</span>
                </div>
                <div className="bg-zinc-100 rounded-lg divide-y divide-gray-700">
                  {items.map((item, idx) => (
                    <div key={idx} className="px-3 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Camera className="h-3.5 w-3.5 text-teal-700 flex-shrink-0" />
                        <div>
                          <p className="text-sm text-zinc-900">{item.shoot?.title || 'Unnamed Shoot'}</p>
                          <p className="text-xs text-zinc-400">{item.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {item.isAdditional && (
                          <Badge className="bg-yellow-500/20 text-amber-700 border-yellow-500/30 text-xs">+2nd</Badge>
                        )}
                        <span className={`text-sm font-semibold ${item.isAdditional ? 'text-amber-700' : 'text-emerald-700'}`}>
                          R {item.amount.toLocaleString('en-ZA')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-between items-center mt-4 pt-4 border-t border-zinc-200">
          <div>
            <p className="text-xs text-zinc-400">Rate: R1,000 per shoot · R250 for additional same-day</p>
          </div>
          <Button onClick={handleExport} className="bg-teal-700 hover:bg-teal-700">
            <Download className="h-4 w-4 mr-2" /> Export PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}