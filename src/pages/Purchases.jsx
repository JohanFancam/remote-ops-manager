import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';

import { useHousehold } from '../components/HouseholdContext';
import MonthSelector from '../components/budget/MonthSelector';
import PurchasesSection from '../components/budget/PurchasesSection';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function Purchases() {
  const { householdId, isLoading: loadingHousehold } = useHousehold();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const queryClient = useQueryClient();
  
  const { data: purchases = [], isLoading: loadingPurchases } = useQuery({
    queryKey: ['purchases', selectedMonth, householdId],
    queryFn: () => base44.entities.Purchase.filter({ month: selectedMonth, household_id: householdId }),
    enabled: !!householdId,
  });
  
  const { data: categories = [], isLoading: loadingCategories } = useQuery({
    queryKey: ['categories', selectedMonth, householdId],
    queryFn: () => base44.entities.BudgetCategory.filter({ month: selectedMonth, household_id: householdId }),
    enabled: !!householdId,
  });
  
  const isLoading = loadingHousehold || loadingPurchases || loadingCategories;
  
  const refreshData = () => {
    queryClient.invalidateQueries({ queryKey: ['purchases', selectedMonth, householdId] });
    queryClient.invalidateQueries({ queryKey: ['categories', selectedMonth, householdId] });
  };
  
  // Calculate spending by category
  const categorySpending = categories.map(cat => {
    const spent = purchases
      .filter(p => p.category === cat.name)
      .reduce((sum, p) => sum + (p.amount || 0), 0);
    return {
      ...cat,
      spent,
      remaining: cat.budget_amount - spent
    };
  });
  
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
          <h1 className="text-2xl font-bold text-slate-800">Purchase Tracker</h1>
          <MonthSelector selectedMonth={selectedMonth} onMonthChange={setSelectedMonth} />
        </div>
        
        {/* Budget Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {categorySpending.map(cat => (
            <Card key={cat.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <p className="text-xs font-medium text-slate-500 uppercase">{cat.name}</p>
                <p className="text-lg font-bold mt-1">R {cat.spent.toLocaleString()}</p>
                <p className={cn(
                  "text-xs mt-1",
                  cat.remaining >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {cat.remaining >= 0 ? 'R ' + cat.remaining.toLocaleString() + ' left' : 'R ' + Math.abs(cat.remaining).toLocaleString() + ' over'}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <PurchasesSection 
          purchases={purchases}
          categories={categories}
          selectedMonth={selectedMonth}
          householdId={householdId}
          onRefresh={refreshData}
        />
      </div>
    </div>
  );
}