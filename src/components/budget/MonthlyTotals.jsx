import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTheme } from '../ThemeProvider';

export default function MonthlyTotals({ incomes, expenses, investments, unforeseenExpenses = [], purchases = [] }) {
  const theme = useTheme();
  const totalIncome = incomes.reduce((sum, i) => sum + (i.amount || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalSaved = investments.reduce((sum, i) => sum + (i.amount_saved || 0), 0);
  const totalUnforeseen = unforeseenExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalPurchases = purchases.reduce((sum, p) => sum + (p.amount || 0), 0);
  
  // Monthly Budget = Income - Expenses - Investments - Unforeseen
  const monthlyBudget = totalIncome - totalExpenses - totalSaved - totalUnforeseen;
  // Budget Remaining = Monthly Budget - Purchases
  const budgetRemaining = monthlyBudget - totalPurchases;
  
  return (
    <Card className={`border-0 shadow-md ${theme.cardBg}`}>
      <CardHeader className={`${theme.cardHeader} text-white rounded-t-lg py-3`}>
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
          {totalUnforeseen > 0 && (
            <div className="flex justify-between px-4 py-3 hover:bg-slate-50">
              <span className="text-sm font-medium">Unforeseen Expenses</span>
              <span className="text-sm font-bold text-amber-600">R {totalUnforeseen.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between px-4 py-3 bg-blue-50 font-semibold">
            <span className="text-sm">Monthly Budget Available</span>
            <span className="text-sm text-blue-700">R {monthlyBudget.toLocaleString()}</span>
          </div>
          <div className="flex justify-between px-4 py-3 hover:bg-slate-50">
            <span className="text-sm font-medium">Purchases</span>
            <span className="text-sm font-bold text-purple-600">R {totalPurchases.toLocaleString()}</span>
          </div>
        </div>
        <div className={cn(
          "flex justify-between px-4 py-3 rounded-b-lg",
          budgetRemaining >= 0 ? "bg-green-600" : "bg-red-600"
        )}>
          <span className="text-sm font-semibold text-white">REMAINING BUDGET</span>
          <span className="font-bold text-white">R {budgetRemaining.toLocaleString()}</span>
        </div>
      </CardContent>
    </Card>
  );
}