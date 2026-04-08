import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Download, ChevronRight } from 'lucide-react';
import { getAllOperatorsEarnings, exportSummaryPDF } from '../utils/earningsUtils';
import OperatorDetailModal from './OperatorDetailModal';

// ADDED: user prop to allow the component to filter for a specific operator
export default function EarningsSummary({ shoots = [], users = [], user }) {
  const [selectedOperator, setSelectedOperator] = useState(null);

  let operators = getAllOperatorsEarnings(shoots, users);

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
      <Card className="bg-gray-900 border-gray-800 mt-8">
        <CardHeader className="border-b border-gray-800 pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-400" />
              {user?.role === 'admin' ? 'Operator Earnings Summary' : 'My Monthly Summary'}
            </CardTitle>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs text-gray-500">Total Earnings</p>
                <p className="text-lg font-bold text-green-400">R {grandTotal.toLocaleString('en-ZA')}</p>
              </div>
              <Button onClick={handleExport} size="sm" className="bg-blue-700 hover:bg-blue-600">
                <Download className="h-4 w-4 mr-1" /> PDF
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {operators.length === 0 ? (
            <p className="text-gray-500 text-sm p-6 text-center">No earnings data found.</p>
          ) : (
            <div>
              <div className="grid grid-cols-4 px-5 py-2 text-xs text-gray-500 uppercase tracking-wider border-b border-gray-800">
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
                    className="w-full grid grid-cols-4 px-5 py-4 hover:bg-gray-800/60 transition-colors text-left items-center"
                  >
                    <div>
                      <p className="font-medium text-white">{op.name}</p>
                      <p className="text-xs text-gray-500">{op.email}</p>
                    </div>
                    <div className="text-center text-white font-semibold">{op.shootCount}</div>
                    <div className="text-center text-yellow-400 text-sm">
                      {op.breakdown.filter(b => b.isAdditional).length || '—'}
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-green-400 font-bold">R {op.total.toLocaleString('en-ZA')}</span>
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