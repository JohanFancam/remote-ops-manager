import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Camera } from 'lucide-react';
import { format } from 'date-fns';
import { exportOperatorPDF } from '../../lib/earningsUtils';

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
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">{operator.name}</DialogTitle>
          <p className="text-gray-400 text-sm">{operator.email}</p>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 my-4">
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-white">{operator.shootCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">Total Shoots</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-400">R {operator.total.toLocaleString('en-ZA')}</p>
            <p className="text-xs text-gray-400 mt-0.5">Total Earnings</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-400">
              {operator.breakdown.filter(b => b.isAdditional).length}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">Additional Shoots</p>
          </div>
        </div>

        {/* Breakdown by month */}
        <div className="space-y-4">
          {Object.entries(byMonth).sort(([a], [b]) => b.localeCompare(a)).map(([month, items]) => {
            const monthTotal = items.reduce((s, i) => s + i.amount, 0);
            return (
              <div key={month}>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-300">
                    {month ? format(new Date(month + '-01'), 'MMMM yyyy') : 'Unknown'}
                  </h3>
                  <span className="text-sm font-bold text-white">R {monthTotal.toLocaleString('en-ZA')}</span>
                </div>
                <div className="bg-gray-800 rounded-lg divide-y divide-gray-700">
                  {items.map((item, idx) => (
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
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">+2nd</Badge>
                        )}
                        <span className={`text-sm font-semibold ${item.isAdditional ? 'text-yellow-400' : 'text-green-400'}`}>
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

        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-700">
          <div>
            <p className="text-xs text-gray-500">Rate: R1,000 per shoot · R250 for additional same-day</p>
          </div>
          <Button onClick={handleExport} className="bg-blue-700 hover:bg-blue-600">
            <Download className="h-4 w-4 mr-2" /> Export PDF
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}