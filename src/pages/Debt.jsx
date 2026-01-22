import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CreditCard, TrendingDown, Loader2, Target } from "lucide-react";
import { useHousehold } from '../components/HouseholdContext';
import { useTheme } from '../components/ThemeProvider';
import DebtSection from '../components/budget/DebtSection';

export default function DebtPage() {
  const { householdId, isLoading: loadingHousehold, showTutorial } = useHousehold();
  const theme = useTheme();

  const { data: debts = [], isLoading } = useQuery({
    queryKey: ['debts', householdId],
    queryFn: () => base44.entities.Debt.filter({ household_id: householdId }),
    enabled: !!householdId,
  });

  const { data: transactions = [] } = useQuery({
    queryKey: ['debtTransactions', householdId],
    queryFn: () => base44.entities.DebtTransaction.filter({ household_id: householdId }),
    enabled: !!householdId,
  });

  if (loadingHousehold || isLoading) {
    return (
      <div className={`min-h-screen ${theme.bg} flex items-center justify-center`}>
        <Loader2 className={`h-8 w-8 animate-spin ${theme.textMuted}`} />
      </div>
    );
  }

  const totalOriginal = debts.reduce((sum, d) => sum + (d.original_amount || 0), 0);
  const totalCurrent = debts.reduce((sum, d) => sum + (d.current_amount || 0), 0);
  const totalPaid = totalOriginal - totalCurrent;
  const overallProgress = totalOriginal > 0 ? (totalPaid / totalOriginal) * 100 : 0;

  // Calculate total monthly payments
  const totalMonthlyPayments = debts.reduce((sum, d) => sum + (d.minimum_payment || 0), 0);

  return (
    <div className={`min-h-screen ${theme.bg}`}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className={`text-2xl font-bold ${theme.text} mb-6`}>Debt Tracker</h1>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className={`border-0 shadow-md ${theme.cardBg}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs ${theme.textMuted} uppercase`}>Total Debt</p>
                  <p className={`text-2xl font-bold text-red-600`}>R {totalCurrent.toLocaleString()}</p>
                </div>
                <CreditCard className="h-8 w-8 text-red-400" />
              </div>
            </CardContent>
          </Card>

          <Card className={`border-0 shadow-md ${theme.cardBg}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs ${theme.textMuted} uppercase`}>Paid Off</p>
                  <p className={`text-2xl font-bold text-green-600`}>R {totalPaid.toLocaleString()}</p>
                </div>
                <TrendingDown className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className={`border-0 shadow-md ${theme.cardBg}`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs ${theme.textMuted} uppercase`}>Monthly Payments</p>
                  <p className={`text-2xl font-bold ${theme.text}`}>R {totalMonthlyPayments.toLocaleString()}</p>
                </div>
                <Target className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className={`border-0 shadow-md ${theme.cardBg}`}>
            <CardContent className="p-4">
              <div>
                <p className={`text-xs ${theme.textMuted} uppercase mb-2`}>Overall Progress</p>
                <Progress value={overallProgress} className="h-3 mb-1" />
                <p className={`text-sm ${theme.text} font-medium`}>{overallProgress.toFixed(1)}% paid off</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Debt Section */}
        <DebtSection
          householdId={householdId}
          showTutorial={showTutorial}
        />
      </div>
    </div>
  );
}