import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, Calculator } from "lucide-react";
import { useTheme } from '../ThemeProvider';

export default function BudgetCalculations({ 
  bankBalance = 0, 
  totalIncome = 0, 
  totalExpenses = 0, 
  totalPurchases = 0,
  totalUnforeseen = 0,
  totalInvestments = 0
}) {
  const theme = useTheme();
  
  // Monthly budget = Income - Fixed Expenses - Investments
  const monthlyBudget = totalIncome - totalExpenses - totalInvestments;
  
  // Available to spend = Monthly Budget - Purchases - Unforeseen
  const availableToSpend = monthlyBudget - totalPurchases - totalUnforeseen;
  
  // Expected bank balance = Current Bank Balance - Unpaid Expenses - Remaining Purchases Budget
  const expectedBalance = bankBalance + totalIncome - totalExpenses - totalPurchases - totalUnforeseen - totalInvestments;
  
  const items = [
    {
      label: 'Monthly Budget',
      value: monthlyBudget,
      icon: Calculator,
      description: 'Income - Expenses - Investments',
      color: monthlyBudget >= 0 ? 'text-emerald-600' : 'text-red-600'
    },
    {
      label: 'Available to Spend',
      value: availableToSpend,
      icon: Wallet,
      description: 'Budget - Purchases - Unforeseen',
      color: availableToSpend >= 0 ? 'text-blue-600' : 'text-red-600'
    },
    {
      label: 'Expected Balance',
      value: expectedBalance,
      icon: expectedBalance >= bankBalance ? TrendingUp : TrendingDown,
      description: 'Projected end-of-month balance',
      color: expectedBalance >= 0 ? 'text-emerald-600' : 'text-red-600'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {items.map((item) => (
        <Card key={item.label} className={`border-0 shadow-md ${theme.cardBg}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-xs ${theme.textMuted} uppercase font-medium`}>{item.label}</p>
                <p className={`text-2xl font-bold ${item.color}`}>
                  R {item.value.toLocaleString()}
                </p>
                <p className={`text-xs ${theme.textMuted} mt-1`}>{item.description}</p>
              </div>
              <div className={`p-3 rounded-full ${theme.headerBg}`}>
                <item.icon className={`h-6 w-6 ${item.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}