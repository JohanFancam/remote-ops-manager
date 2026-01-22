import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format, addMonths, parseISO, isAfter } from 'date-fns';
import { Loader2, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useHousehold } from '../components/HouseholdContext';
import { useTheme } from '../components/ThemeProvider';

export default function Projections() {
  const { householdId, isLoading: loadingHousehold } = useHousehold();
  const theme = useTheme();
  
  const { data: expenses = [], isLoading: loadingExpenses } = useQuery({
    queryKey: ['all-expenses', householdId],
    queryFn: () => base44.entities.Expense.filter({ household_id: householdId }),
    enabled: !!householdId,
  });
  
  const { data: incomes = [], isLoading: loadingIncomes } = useQuery({
    queryKey: ['all-incomes', householdId],
    queryFn: () => base44.entities.Income.filter({ household_id: householdId }),
    enabled: !!householdId,
  });
  
  const isLoading = loadingHousehold || loadingExpenses || loadingIncomes;
  
  if (isLoading) {
    return (
      <div className={`min-h-screen ${theme.bg} flex items-center justify-center`}>
        <Loader2 className={`h-8 w-8 animate-spin ${theme.textMuted}`} />
      </div>
    );
  }
  
  const today = new Date();
  const currentMonth = format(today, 'yyyy-MM');
  
  // Get fixed expenses with expiry dates
  const fixedExpenses = expenses.filter(e => e.is_fixed && e.month === currentMonth);
  const expiringExpenses = fixedExpenses.filter(e => e.expiry_date);
  
  // Calculate current monthly totals
  const currentFixedTotal = fixedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const currentIncomeTotal = incomes
    .filter(i => i.month === currentMonth)
    .reduce((sum, i) => sum + (i.amount || 0), 0);
  
  // Generate projections for next 12 months
  const projections = [];
  for (let i = 0; i < 12; i++) {
    const projMonth = format(addMonths(today, i), 'yyyy-MM');
    const projDate = addMonths(today, i);
    
    // Calculate which expenses will still be active
    let projectedExpenses = 0;
    const expiredThisMonth = [];
    
    fixedExpenses.forEach(expense => {
      if (expense.expiry_date) {
        const expiryDate = parseISO(expense.expiry_date);
        if (isAfter(projDate, expiryDate)) {
          if (i > 0) {
            const prevMonth = addMonths(today, i - 1);
            if (!isAfter(prevMonth, expiryDate)) {
              expiredThisMonth.push(expense);
            }
          }
          return; // Don't add to projected
        }
      }
      projectedExpenses += expense.amount || 0;
    });
    
    projections.push({
      month: projMonth,
      monthLabel: format(projDate, 'MMM yyyy'),
      expenses: projectedExpenses,
      income: currentIncomeTotal,
      savings: currentIncomeTotal - projectedExpenses,
      expiredThisMonth
    });
  }
  
  // Sort expiring expenses by date
  const sortedExpiring = [...expiringExpenses].sort((a, b) => 
    new Date(a.expiry_date) - new Date(b.expiry_date)
  );
  
  return (
    <div className={`min-h-screen ${theme.bg}`}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className={`text-2xl font-bold ${theme.text} flex items-center gap-2`}>
            <TrendingUp className="h-6 w-6" />
            Budget Projections
          </h1>
          <p className={`${theme.textMuted} mt-1`}>See how your budget will look as contracts expire</p>
        </div>
        
        {/* Expiring Contracts Overview */}
        <Card className={`mb-6 border-0 shadow-md ${theme.cardBg}`}>
          <CardHeader className="bg-amber-600 text-white rounded-t-lg py-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              EXPIRING CONTRACTS
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {sortedExpiring.length === 0 ? (
              <p className="text-slate-500 text-sm">No expenses with expiry dates set. Add expiry dates to your fixed expenses to see projections.</p>
            ) : (
              <div className="space-y-3">
                {sortedExpiring.map(expense => {
                  const expiryDate = parseISO(expense.expiry_date);
                  const isExpired = isAfter(today, expiryDate);
                  const daysUntil = Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24));
                  
                  return (
                    <div key={expense.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div>
                        <p className="font-medium">{expense.category}</p>
                        <p className="text-sm text-slate-500">
                          {isExpired ? (
                            <span className="text-green-600">Expired</span>
                          ) : daysUntil <= 30 ? (
                            <span className="text-amber-600">Expires in {daysUntil} days</span>
                          ) : (
                            <span>Expires {format(expiryDate, 'dd MMM yyyy')}</span>
                          )}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-red-600">R {expense.amount?.toLocaleString()}/month</p>
                        {!isExpired && (
                          <p className="text-xs text-green-600">Will save R {expense.amount?.toLocaleString()} after expiry</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Monthly Projections */}
        <Card className={`border-0 shadow-md ${theme.cardBg}`}>
          <CardHeader className={`${theme.cardHeader} text-white rounded-t-lg py-3`}>
                        <CardTitle className="text-base font-semibold">12-MONTH PROJECTION</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-100 text-xs font-medium text-slate-600 uppercase">
              <div className="col-span-3">Month</div>
              <div className="col-span-2 text-right">Income</div>
              <div className="col-span-2 text-right">Expenses</div>
              <div className="col-span-2 text-right">Savings</div>
              <div className="col-span-3">Status</div>
            </div>
            
            <div className="divide-y divide-slate-100">
              {projections.map((proj, idx) => (
                <div key={proj.month} className={`grid grid-cols-12 gap-2 px-4 py-3 items-center ${idx === 0 ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                  <div className="col-span-3">
                    <p className="font-medium text-sm">{proj.monthLabel}</p>
                    {idx === 0 && <span className="text-xs text-blue-600 font-medium">Current</span>}
                  </div>
                  <div className="col-span-2 text-right text-sm text-green-600 font-medium">
                    R {proj.income.toLocaleString()}
                  </div>
                  <div className="col-span-2 text-right text-sm text-red-600 font-medium">
                    R {proj.expenses.toLocaleString()}
                  </div>
                  <div className={`col-span-2 text-right text-sm font-bold ${proj.savings >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    R {proj.savings.toLocaleString()}
                  </div>
                  <div className="col-span-3">
                    {proj.expiredThisMonth.length > 0 ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-xs">{proj.expiredThisMonth.map(e => e.category).join(', ')} ends</span>
                      </div>
                    ) : proj.expenses < currentFixedTotal ? (
                      <span className="text-xs text-green-600">Reduced expenses</span>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
            
            <div className={`px-4 py-4 ${theme.cardFooter} text-white rounded-b-lg`}
              <div className="flex justify-between items-center">
                <span className="text-sm">Potential annual savings from expiring contracts:</span>
                <span className="text-xl font-bold text-green-400">
                  R {(sortedExpiring.reduce((sum, e) => sum + (e.amount || 0), 0) * 12).toLocaleString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}