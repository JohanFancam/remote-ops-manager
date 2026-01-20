import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

import MonthSelector from '../components/budget/MonthSelector';
import IncomeSection from '../components/budget/IncomeSection';
import ExpensesSection from '../components/budget/ExpensesSection';
import InvestmentsSection from '../components/budget/InvestmentsSection';
import BudgetCategorySection from '../components/budget/BudgetCategorySection';
import MonthlyTotals from '../components/budget/MonthlyTotals';

export default function Budget() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const queryClient = useQueryClient();
  
  const { data: incomes = [], isLoading: loadingIncomes } = useQuery({
    queryKey: ['incomes', selectedMonth],
    queryFn: () => base44.entities.Income.filter({ month: selectedMonth }),
  });
  
  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ['expenses', selectedMonth],
    queryFn: () => base44.entities.Expense.filter({ month: selectedMonth }),
  });
  
  const { data: investments = [], isLoading: loadingInvestments } = useQuery({
    queryKey: ['investments', selectedMonth],
    queryFn: () => base44.entities.Investment.filter({ month: selectedMonth }),
  });
  
  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ['categories', selectedMonth],
    queryFn: () => base44.entities.BudgetCategory.filter({ month: selectedMonth }),
  });
  
  const isLoading = loadingIncomes || loadingExpenses || loadingInvestments || loadingCategories;
  
  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['incomes', selectedMonth] });
    queryClient.invalidateQueries({ queryKey: ['expenses', selectedMonth] });
    queryClient.invalidateQueries({ queryKey: ['investments', selectedMonth] });
    queryClient.invalidateQueries({ queryKey: ['categories', selectedMonth] });
  };
  
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
          <h1 className="text-2xl font-bold text-slate-800">Household Budget</h1>
          <MonthSelector selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />
        </div>
        
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column - Income, Fixed Expenses, Investments, Totals */}
          <div className="space-y-6">
            <IncomeSection 
              incomes={incomes} 
              selectedMonth={selectedMonth} 
              onRefresh={refreshData} 
            />
            
            <ExpensesSection 
              expenses={expenses} 
              selectedMonth={selectedMonth} 
              onRefresh={refreshData} 
            />
            
            <InvestmentsSection 
              investments={investments} 
              selectedMonth={selectedMonth} 
              onRefresh={refreshData} 
            />
            
            <MonthlyTotals 
              incomes={incomes} 
              expenses={expenses} 
              investments={investments} 
            />
          </div>
          
          {/* Right Column - Budget Categories */}
          <div className="space-y-6">
            <BudgetCategorySection 
              categories={categories}
              expenses={expenses}
              selectedMonth={selectedMonth}
              onRefresh={refreshData}
            />
          </div>
        </div>
      </div>
    </div>
  );
}