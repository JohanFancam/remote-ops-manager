import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

import { useHousehold } from '../components/HouseholdContext';
import { useTheme } from '../components/ThemeProvider';
import MonthSelector from '../components/budget/MonthSelector';
import BankBalanceCard from '../components/budget/BankBalanceCard';
import IncomeSection from '../components/budget/IncomeSection';
import ExpensesSection from '../components/budget/ExpensesSection';
import InvestmentsSection from '../components/budget/InvestmentsSection';
import BudgetCategorySection from '../components/budget/BudgetCategorySection';
import HouseholdGoalsSection from '../components/budget/HouseholdGoalsSection';
import PurchasesSection from '../components/budget/PurchasesSection';
import CalendarWidget from '../components/budget/CalendarWidget';
import MonthlyTotals from '../components/budget/MonthlyTotals';
import DebtSection from '../components/budget/DebtSection';
import UnforeseenExpensesSection from '../components/budget/UnforeseenExpensesSection';
import BudgetCalculations from '../components/budget/BudgetCalculations';

export default function Budget() {
  const { 
    householdId, isLoading: loadingHousehold, showTutorial, 
    getDefaultIncomeDate, getDefaultExpenseDate, features, getCurrentMonth 
  } = useHousehold();
  const theme = useTheme();
  const queryClient = useQueryClient();
  
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  
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
  
  const { data: investments = [], isLoading: loadingInvestments } = useQuery({
    queryKey: ['investments', householdId, selectedMonth],
    queryFn: () => base44.entities.Investment.filter({ household_id: householdId, month: selectedMonth }),
    enabled: !!householdId && features.investments,
  });
  
  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ['categories', householdId, selectedMonth],
    queryFn: () => base44.entities.BudgetCategory.filter({ household_id: householdId, month: selectedMonth }),
    enabled: !!householdId,
  });
  
  const { data: balances = [], isLoading: loadingBalances } = useQuery({
    queryKey: ['balances', householdId, selectedMonth],
    queryFn: () => base44.entities.BankBalance.filter({ household_id: householdId, month: selectedMonth }),
    enabled: !!householdId,
  });
  
  const { data: purchases = [], isLoading: loadingPurchases } = useQuery({
    queryKey: ['purchases', householdId, selectedMonth],
    queryFn: () => base44.entities.Purchase.filter({ household_id: householdId, month: selectedMonth }),
    enabled: !!householdId,
  });
  
  const { data: goals = [], isLoading: loadingGoals } = useQuery({
    queryKey: ['householdGoals', householdId],
    queryFn: () => base44.entities.HouseholdGoal.filter({ household_id: householdId }),
    enabled: !!householdId && features.household_goals,
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
  
  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['incomes'] });
    queryClient.invalidateQueries({ queryKey: ['expenses'] });
    queryClient.invalidateQueries({ queryKey: ['investments'] });
    queryClient.invalidateQueries({ queryKey: ['categories'] });
    queryClient.invalidateQueries({ queryKey: ['balances'] });
    queryClient.invalidateQueries({ queryKey: ['purchases'] });
    queryClient.invalidateQueries({ queryKey: ['unforeseenExpenses'] });
  };
  
  const refreshGoals = () => {
    queryClient.invalidateQueries({ queryKey: ['householdGoals'] });
  };
  
  const currentBalance = balances[0];
  const fixedExpenses = expenses.filter(e => e.is_fixed);
  
  // Calculate totals
  const totalIncome = incomes.reduce((sum, i) => sum + (i.amount || 0), 0);
  const totalExpenses = fixedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const totalPurchases = purchases.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalInvestments = investments.reduce((sum, i) => sum + (i.amount_saved || 0), 0);
  const totalUnforeseen = unforeseenExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  
  const isLoading = loadingHousehold || loadingIncomes || loadingExpenses || loadingCategories;
  
  if (isLoading) {
    return (
      <div className={`min-h-screen ${theme.bg} flex items-center justify-center`}>
        <Loader2 className={`h-8 w-8 animate-spin ${theme.textMuted}`} />
      </div>
    );
  }
  
  return (
    <div className={`min-h-screen ${theme.bg}`}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
          <h1 className={`text-2xl font-bold ${theme.text}`}>Household Budget</h1>
          <MonthSelector 
            selectedMonth={selectedMonth} 
            onMonthChange={setSelectedMonth}
          />
        </div>

        {/* Budget Calculations Summary */}
        <BudgetCalculations
          bankBalance={currentBalance?.amount || 0}
          totalIncome={totalIncome}
          totalExpenses={totalExpenses}
          totalPurchases={totalPurchases}
          totalUnforeseen={totalUnforeseen}
          totalInvestments={totalInvestments}
        />
        
        <div className="mb-6">
          <CalendarWidget />
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-6">
            <BankBalanceCard 
              balance={currentBalance}
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
              debts={debts}
            />
            
            {features.investments && (
              <InvestmentsSection 
                investments={investments}
                selectedMonth={selectedMonth}
                householdId={householdId}
                onRefresh={refreshData}
                showTutorial={showTutorial}
              />
            )}

            {features.unforeseen_expenses && (
              <UnforeseenExpensesSection
                selectedMonth={selectedMonth}
                householdId={householdId}
                showTutorial={showTutorial}
              />
            )}
            
            <MonthlyTotals 
              incomes={incomes}
              expenses={expenses}
              investments={investments}
              unforeseenExpenses={unforeseenExpenses}
              purchases={purchases}
            />
          </div>
          
          {/* Right Column */}
          <div className="space-y-6">
            <BudgetCategorySection 
              categories={categories}
              expenses={purchases}
              selectedMonth={selectedMonth}
              householdId={householdId}
              onRefresh={refreshData}
              showTutorial={showTutorial}
            />
            
            {features.household_goals && (
              <HouseholdGoalsSection 
                goals={goals.filter(g => !g.is_completed)}
                householdId={householdId}
                onRefresh={refreshGoals}
                showTutorial={showTutorial}
              />
            )}

            {features.debt && (
              <DebtSection
                householdId={householdId}
                showTutorial={showTutorial}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}