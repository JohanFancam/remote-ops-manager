import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, PiggyBank } from "lucide-react";
import { cn } from "@/lib/utils";

export default function SummaryCards({ incomes, expenses, investments }) {
  const totalIncome = incomes.reduce((sum, i) => sum + (i.amount || 0), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalSaved = investments.reduce((sum, i) => sum + (i.amount_saved || 0), 0);
  const netBalance = totalIncome - totalExpenses - totalSaved;
  
  const cards = [
    {
      title: 'Total Income',
      value: totalIncome,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      title: 'Total Expenses',
      value: totalExpenses,
      icon: TrendingDown,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200'
    },
    {
      title: 'Total Saved',
      value: totalSaved,
      icon: PiggyBank,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      title: 'Net Balance',
      value: netBalance,
      icon: Wallet,
      color: netBalance >= 0 ? 'text-emerald-600' : 'text-red-600',
      bgColor: netBalance >= 0 ? 'bg-emerald-50' : 'bg-red-50',
      borderColor: netBalance >= 0 ? 'border-emerald-200' : 'border-red-200'
    }
  ];
  
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title} className={cn("border-0 shadow-md", card.bgColor, card.borderColor, "border")}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">{card.title}</span>
              <card.icon className={cn("h-5 w-5", card.color)} />
            </div>
            <div className={cn("text-xl lg:text-2xl font-bold", card.color)}>
              R {card.value.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}