import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Wallet, PiggyBank, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from '../ThemeProvider';

export default function SummaryCards({ totalIncome, totalExpenses, totalInvestments, totalDebt = 0 }) {
  const theme = useTheme();
  const netBalance = totalIncome - totalExpenses - totalInvestments;
  
  const cards = [
    {
      title: 'Total Income',
      value: totalIncome,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: theme.name === 'dark' ? 'bg-green-900/30' : 'bg-green-50',
      borderColor: 'border-green-200'
    },
    {
      title: 'Total Expenses',
      value: totalExpenses,
      icon: TrendingDown,
      color: 'text-red-600',
      bgColor: theme.name === 'dark' ? 'bg-red-900/30' : 'bg-red-50',
      borderColor: 'border-red-200'
    },
    {
      title: 'Total Saved',
      value: totalInvestments,
      icon: PiggyBank,
      color: 'text-blue-600',
      bgColor: theme.name === 'dark' ? 'bg-blue-900/30' : 'bg-blue-50',
      borderColor: 'border-blue-200'
    },
    {
      title: 'Net Balance',
      value: netBalance,
      icon: Wallet,
      color: netBalance >= 0 ? 'text-emerald-600' : 'text-red-600',
      bgColor: netBalance >= 0 
        ? (theme.name === 'dark' ? 'bg-emerald-900/30' : 'bg-emerald-50')
        : (theme.name === 'dark' ? 'bg-red-900/30' : 'bg-red-50'),
      borderColor: netBalance >= 0 ? 'border-emerald-200' : 'border-red-200'
    }
  ];
  
  if (totalDebt > 0) {
    cards.push({
      title: 'Total Debt',
      value: totalDebt,
      icon: CreditCard,
      color: 'text-purple-600',
      bgColor: theme.name === 'dark' ? 'bg-purple-900/30' : 'bg-purple-50',
      borderColor: 'border-purple-200'
    });
  }
  
  return (
    <div className={`grid grid-cols-2 ${totalDebt > 0 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-4`}
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