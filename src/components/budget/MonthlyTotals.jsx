import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function MonthlyTotals({ incomes, expenses, investments }) {
  const totalIncome = incomes.reduce((sum, i) => sum + (i.amount || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalSaved = investments.reduce((sum, i) => sum + (i.amount_saved || 0), 0);
  const netBalance = totalIncome - totalExpenses - totalSaved;
  
  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="bg-slate-800 text-white rounded-t-lg py-3">
        <CardTitle className="text-base font-semibold">
          END OF MONTH TOTALS
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y divide-slate-100">
          <div className="flex justify-between px-4 py-3 hover:bg-slate-50">
            <span className="text-sm font-medium">Total Income</span>
            <span className="text-sm font-bold text-green-600">R {totalIncome.toLocaleString()}</span>
          </div>
          <div className="flex justify-between px-4 py-3 hover:bg-slate-50">
            <span className="text-sm font-medium">Total Expenses</span>
            <span className="text-sm font-bold text-red-600">R {totalExpenses.toLocaleString()}</span>
          </div>
          <div className="flex justify-between px-4 py-3 hover:bg-slate-50">
            <span className="text-sm font-medium">Total Saved</span>
            <span className="text-sm font-bold text-blue-600">R {totalSaved.toLocaleString()}</span>
          </div>
        </div>
        <div className={cn(
          "flex justify-between px-4 py-3 rounded-b-lg",
          netBalance >= 0 ? "bg-green-600" : "bg-red-600"
        )}>
          <span className="text-sm font-semibold text-white">NET BALANCE</span>
          <span className="font-bold text-white">R {netBalance.toLocaleString()}</span>
        </div>
      </CardContent>
    </Card>
  );
}