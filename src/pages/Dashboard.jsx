import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useHousehold } from '../components/HouseholdContext';
import MonthSelector from '../components/budget/MonthSelector';
import SummaryCards from '../components/dashboard/SummaryCards';
import ExpenseChart from '../components/dashboard/ExpenseChart';
import MonthlyTrend from '../components/dashboard/MonthlyTrend';
import BudgetProgress from '../components/dashboard/BudgetProgress';

export default function Dashboard() {
  const { householdId, isLoading: loadingHousehold } = useHousehold();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [viewMode, setViewMode] = useState('month'); // 'month' or 'year'
  
  const selectedYear = selectedMonth.split('-')[0];
  
  // Fetch all data for trends
  const { data: allIncomes = [], isLoading: loadingAllIncomes } = useQuery({
    queryKey: ['all-incomes', householdId],
    queryFn: () => base44.entities.Income.filter({ household_id: householdId }),
    enabled: !!householdId,
  });
  
  const { data: allExpenses = [], isLoading: loadingAllExpenses } = useQuery({
    queryKey: ['all-expenses', householdId],
    queryFn: () => base44.entities.Expense.filter({ household_id: householdId }),
    enabled: !!householdId,
  });
  
  const { data: allInvestments = [], isLoading: loadingAllInvestments } = useQuery({
    queryKey: ['all-investments', householdId],
    queryFn: () => base44.entities.Investment.filter({ household_id: householdId }),
    enabled: !!householdId,
  });
  
  const { data: allCategories = [], isLoading: loadingAllCategories } = useQuery({
    queryKey: ['all-categories', householdId],
    queryFn: () => base44.entities.BudgetCategory.filter({ household_id: householdId }),
    enabled: !!householdId,
  });
  
  const isLoading = loadingHousehold || loadingAllIncomes || loadingAllExpenses || loadingAllInvestments || loadingAllCategories;
  
  // Filter data based on view mode
  const filteredIncomes = viewMode === 'month' 
    ? allIncomes.filter(i => i.month === selectedMonth)
    : allIncomes.filter(i => i.month?.startsWith(selectedYear));
    
  const filteredExpenses = viewMode === 'month'
    ? allExpenses.filter(e => e.month === selectedMonth)
    : allExpenses.filter(e => e.month?.startsWith(selectedYear));
    
  const filteredInvestments = viewMode === 'month'
    ? allInvestments.filter(i => i.month === selectedMonth)
    : allInvestments.filter(i => i.month?.startsWith(selectedYear));
    
  const filteredCategories = viewMode === 'month'
    ? allCategories.filter(c => c.month === selectedMonth)
    : allCategories.filter(c => c.month?.startsWith(selectedYear));
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-600" />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
          <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>
          <div className="flex items-center gap-4">
            <Tabs value={viewMode} onValueChange={setViewMode}>
              <TabsList>
                <TabsTrigger value="month">Month</TabsTrigger>
                <TabsTrigger value="year">Year</TabsTrigger>
              </TabsList>
            </Tabs>
            <MonthSelector selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />
          </div>
        </div>
        
        <div className="space-y-6">
          <SummaryCards 
            incomes={filteredIncomes}
            expenses={filteredExpenses}
            investments={filteredInvestments}
          />
          
          <div className="grid lg:grid-cols-2 gap-6">
            <ExpenseChart 
              expenses={filteredExpenses}
              categories={filteredCategories}
            />
            <BudgetProgress 
              categories={filteredCategories}
              expenses={filteredExpenses}
            />
          </div>
          
          <MonthlyTrend 
            allIncomes={allIncomes}
            allExpenses={allExpenses}
            selectedMonth={selectedMonth}
          />
        </div>
      </div>
    </div>
  );
}