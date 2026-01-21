import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

import { useHousehold } from '../components/HouseholdContext';
import { useTheme } from '../components/ThemeProvider';
import MonthSelector from '../components/budget/MonthSelector';
import IncomeSection from '../components/budget/IncomeSection';
import ExpensesSection from '../components/budget/ExpensesSection';
import InvestmentsSection from '../components/budget/InvestmentsSection';
import BudgetCategorySection from '../components/budget/BudgetCategorySection';
import MonthlyTotals from '../components/budget/MonthlyTotals';
import BankBalanceCard from '../components/budget/BankBalanceCard';
import HouseholdGoalsSection from '../components/budget/HouseholdGoalsSection';
import CalendarWidget from '../components/budget/CalendarWidget';

export default function Budget() {
  const { householdId, isLoading: loadingHousehold, showTutorial, getDefaultIncomeDate, getDefaultExpenseDate, themeColors } = useHousehold();
  
  // Auto-set to current month on load
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const queryClient = useQueryClient();
  
  // Auto-advance month when real calendar changes
  useEffect(() => {
    const currentMonth = format(new Date(), 'yyyy-MM');
    if (selectedMonth !== currentMonth) {
      // Only auto-advance if viewing previous month
      const [selYear, selMonth] = selectedMonth.split('-').map(Number);
      const [curYear, curMonth] = currentMonth.split('-').map(Number);
      if (selYear < curYear || (selYear === curYear && selMonth < curMonth)) {
        setSelectedMonth(currentMonth);
      }
    }
  }, []);
  
  const { data: incomes = [], isLoading: loadingIncomes } = useQuery({
    queryKey: ['incomes', selectedMonth, householdId],
    queryFn: () => base44.entities.Income.filter({ month: selectedMonth, household_id: householdId }),
    enabled: !!householdId,
  });
  
  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ['expenses', selectedMonth, householdId],
    queryFn: () => base44.entities.Expense.filter({ month: selectedMonth, household_id: householdId }),
    enabled: !!householdId,
  });
  
  const { data: investments = [], isLoading: loadingInvestments } = useQuery({
    queryKey: ['investments', selectedMonth, householdId],
    queryFn: () => base44.entities.Investment.filter({ month: selectedMonth, household_id: householdId }),
    enabled: !!householdId,
  });
  
  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ['categories', selectedMonth, householdId],
    queryFn: () => base44.entities.BudgetCategory.filter({ month: selectedMonth, household_id: householdId }),
    enabled: !!householdId,
  });
  
  const { data: balances = [], isLoading: loadingBalances } = useQuery({
    queryKey: ['balances', selectedMonth, householdId],
    queryFn: () => base44.entities.BankBalance.filter({ month: selectedMonth, household_id: householdId }),
    enabled: !!householdId,
  });
  
  const { data: purchases = [], isLoading: loadingPurchases } = useQuery({
    queryKey: ['purchases', selectedMonth, householdId],
    queryFn: () => base44.entities.Purchase.filter({ month: selectedMonth, household_id: householdId }),
    enabled: !!householdId,
  });
  
  const { data: goals = [], isLoading: loadingGoals } = useQuery({
    queryKey: ['goals', householdId],
    queryFn: () => base44.entities.HouseholdGoal.filter({ household_id: householdId }),
    enabled: !!householdId,
  });
  
  const isLoading = loadingHousehold || loadingIncomes || loadingExpenses || loadingInvestments || loadingCategories || loadingBalances || loadingPurchases || loadingGoals;
  
  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['incomes', selectedMonth, householdId] });
    queryClient.invalidateQueries({ queryKey: ['expenses', selectedMonth, householdId] });
    queryClient.invalidateQueries({ queryKey: ['investments', selectedMonth, householdId] });
    queryClient.invalidateQueries({ queryKey: ['categories', selectedMonth, householdId] });
    queryClient.invalidateQueries({ queryKey: ['balances', selectedMonth, householdId] });
    queryClient.invalidateQueries({ queryKey: ['purchases', selectedMonth, householdId] });
    queryClient.invalidateQueries({ queryKey: ['goals', householdId] });
  };
  
  const refreshGoals = () => {
    queryClient.invalidateQueries({ queryKey: ['goals', householdId] });
  };
  
  // Combine expenses and purchases for totals
  const allExpenses = [
    ...expenses,
    ...purchases.map(p => ({ ...p, is_fixed: false }))
  ];
  
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
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <h1 className={`text-2xl font-bold ${themeColors?.text || 'text-slate-800'}`}>Household Budget</h1>
          <MonthSelector selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />
        </div>
        
        {/* Calendar Widget */}
        <div className="mb-6">
          <CalendarWidget />
        </div>
        
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Left Column - Income, Fixed Expenses, Investments, Totals */}
          <div className="space-y-6">
            <BankBalanceCard
              balance={balances[0]}
              selectedMonth={selectedMonth}
              householdId={householdId}
              onRefresh={refreshData}
              showTutorial={showTutorial}
            />
            
            <IncomeSection 
              incomes={incomes} 
              selectedMonth={selectedMonth}
              householdId={householdId}
              defaultDate={getDefaultIncomeDate(selectedMonth)}
              onRefresh={refreshData}
              showTutorial={showTutorial}
            />
            
            <ExpensesSection 
              expenses={expenses} 
              selectedMonth={selectedMonth}
              householdId={householdId}
              defaultDate={getDefaultExpenseDate(selectedMonth)}
              onRefresh={refreshData}
              showTutorial={showTutorial}
            />
            
            <InvestmentsSection 
              investments={investments} 
              selectedMonth={selectedMonth}
              householdId={householdId}
              onRefresh={refreshData}
              showTutorial={showTutorial}
            />
            
            <MonthlyTotals 
              incomes={incomes} 
              expenses={allExpenses} 
              investments={investments}
              showTutorial={showTutorial}
            />
          </div>
          
          {/* Right Column - Budget Categories & Goals */}
          <div className="space-y-6">
            <BudgetCategorySection 
              categories={categories}
              expenses={expenses}
              selectedMonth={selectedMonth}
              householdId={householdId}
              onRefresh={refreshData}
              showTutorial={showTutorial}
            />
            
            <HouseholdGoalsSection 
              goals={goals}
              householdId={householdId}
              onRefresh={refreshGoals}
              showTutorial={showTutorial}
            />
          </div>
        </div>
      </div>
    </div>
  );
}