import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Download, Camera } from 'lucide-react';
import { calculateOperatorEarnings, exportOperatorPDF } from '../utils/earningsUtils';

export default function RemoteEarnings({ shoots, user }) {
  const { total, breakdown } = calculateOperatorEarnings(shoots, user?.email);

  const handleExport = () => {
    exportOperatorPDF({
      name: user?.full_name || user?.email,
      email: user?.email,
      total,
      breakdown,
      shootCount: breakdown.length,
    });
  };

  const mainCount = breakdown.filter(b => !b.isAdditional).length;
  const additionalCount = breakdown.filter(b => b.isAdditional).length;

  return (
    <Card className="bg-gray-900 border-gray-800">
      <CardHeader className="border-b border-gray-800 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-400" />
            My Earnings
          </CardTitle>
          <Button onClick={handleExport} size="sm" className="bg-blue-700 hover:bg-blue-600">
            <Download className="h-4 w-4 mr-1" /> Download PDF
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-green-400">R {total.toLocaleString('en-ZA')}</p>
            <p className="text-xs text-gray-400 mt-0.5">Total Earned</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-white">{mainCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">Main Shoots</p>
          </div>
          <div className="bg-gray-800 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-yellow-400">{additionalCount}</p>
            <p className="text-xs text-gray-400 mt-0.5">Additional</p>
          </div>
        </div>

        {breakdown.length > 0 && (
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Breakdown</p>
            <div className="bg-gray-800 rounded-lg divide-y divide-gray-700 max-h-64 overflow-y-auto">
              {breakdown.slice().reverse().map((item, idx) => (
                <div key={idx} className="px-3 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-white">{item.shoot?.title || 'Unnamed'}</p>
                      <p className="text-xs text-gray-500">{item.date}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.isAdditional && (
                      <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-xs">+2nd</Badge>
                    )}
                    <span className={`text-sm font-bold ${item.isAdditional ? 'text-yellow-400' : 'text-green-400'}`}>
                      R {item.amount.toLocaleString('en-ZA')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-2">R1,000 per shoot · R250 for additional same-day shoots</p>
          </div>
        )}

        {breakdown.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-4">No earnings data yet. Get assigned to shoots!</p>
        )}
      </CardContent>
    </Card>
  );
}