import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useHousehold } from '../components/HouseholdContext';
import { useTheme } from '../components/ThemeProvider';
import MonthSelector from '../components/budget/MonthSelector';
import SummaryCards from '../components/dashboard/SummaryCards';
import ExpenseChart from '../components/dashboard/ExpenseChart';
import BudgetProgress from '../components/dashboard/BudgetProgress';
import MonthlyTrend from '../components/dashboard/MonthlyTrend';

export default function Dashboard() {
  const { householdId, isLoading: loadingHousehold, getCurrentMonth, features } = useHousehold();
  const theme = useTheme();
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [viewMode, setViewMode] = useState('month');
  
  const { data: incomes = [], isLoading: loadingIncomes } = useQuery({
    queryKey: ['incomes', householdId, selectedMonth],
    queryFn: () => base44.entities.Income.filter({ household_id: householdId, month: selectedMonth }),
    enabled: !!householdId,
  });
  
  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ['expenses', householdId, selectedMonth],
    queryFn: () => base44.entities.Expense.filter({ household_id: householdId, month: selectedMonth }),
    enabled: !!householdId,
  });
  
  const { data: investments = [] } = useQuery({
    queryKey: ['investments', householdId, selectedMonth],
    queryFn: () => base44.entities.Investment.filter({ household_id: householdId, month: selectedMonth }),
    enabled: !!householdId && features.investments,
  });
  
  const { data: categories = [] } = useQuery({
    queryKey: ['categories', householdId, selectedMonth],
    queryFn: () => base44.entities.BudgetCategory.filter({ household_id: householdId, month: selectedMonth }),
    enabled: !!householdId,
  });

  const { data: purchases = [] } = useQuery({
    queryKey: ['purchases', householdId, selectedMonth],
    queryFn: () => base44.entities.Purchase.filter({ household_id: householdId, month: selectedMonth }),
    enabled: !!householdId,
  });

  const { data: unforeseenExpenses = [] } = useQuery({
    queryKey: ['unforeseenExpenses', householdId, selectedMonth],
    queryFn: () => base44.entities.UnforeseenExpense.filter({ household_id: householdId, month: selectedMonth }),
    enabled: !!householdId && features.unforeseen_expenses,
  });

  const { data: debts = [] } = useQuery({
    queryKey: ['debts', householdId],
    queryFn: () => base44.entities.Debt.filter({ household_id: householdId }),
    enabled: !!householdId && features.debt,
  });
  
  // Get data for past 6 months for trends
  const { data: allIncomes = [] } = useQuery({
    queryKey: ['allIncomes', householdId],
    queryFn: () => base44.entities.Income.filter({ household_id: householdId }),
    enabled: !!householdId,
  });
  
  const { data: allExpenses = [] } = useQuery({
    queryKey: ['allExpenses', householdId],
    queryFn: () => base44.entities.Expense.filter({ household_id: householdId }),
    enabled: !!householdId,
  });
  
  const isLoading = loadingHousehold || loadingIncomes || loadingExpenses;
  
  if (isLoading) {
    return (
      <div className={`min-h-screen ${theme.bg} flex items-center justify-center`}>
        <Loader2 className={`h-8 w-8 animate-spin ${theme.textMuted}`} />
      </div>
    );
  }
  
  const fixedExpenses = expenses.filter(e => e.is_fixed);
  const totalIncome = incomes.reduce((sum, i) => sum + (i.amount || 0), 0);
  const totalExpenses = fixedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalPurchases = purchases.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalUnforeseen = unforeseenExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalInvestments = investments.reduce((sum, i) => sum + (i.amount_saved || 0), 0);
  const totalDebt = debts.reduce((sum, d) => sum + (d.current_amount || 0), 0);
  
  return (
    <div className={`min-h-screen ${theme.bg}`}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <h1 className={`text-2xl font-bold ${theme.text}`}>Dashboard</h1>
          <div className="flex items-center gap-4">
            <Tabs value={viewMode} onValueChange={setViewMode}>
              <TabsList className={theme.cardBg}>
                <TabsTrigger value="month">Month</TabsTrigger>
                <TabsTrigger value="year">Year</TabsTrigger>
              </TabsList>
            </Tabs>
            <MonthSelector 
              selectedMonth={selectedMonth} 
              onMonthChange={setSelectedMonth}
            />
          </div>
        </div>
        
        <SummaryCards 
          totalIncome={totalIncome}
          totalExpenses={totalExpenses + totalPurchases + totalUnforeseen}
          totalInvestments={totalInvestments}
          totalDebt={totalDebt}
        />
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <ExpenseChart 
            expenses={[...fixedExpenses, ...purchases]}
          />
          <BudgetProgress 
            categories={categories}
            expenses={purchases}
          />
        </div>
        
        <div className="mt-6">
          <MonthlyTrend 
            incomes={allIncomes}
            expenses={allExpenses}
            selectedMonth={selectedMonth}
          />
        </div>
      </div>
    </div>
  );
}