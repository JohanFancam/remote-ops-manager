import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export default function BudgetProgress({ categories, expenses }) {
  const variableExpenses = expenses.filter(e => !e.is_fixed);
  
  const getCategorySpent = (categoryName) => {
    return variableExpenses
      .filter(e => e.category === categoryName)
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  };
  
  if (categories.length === 0) {
    return (
      <Card className="border-0 shadow-md">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Budget Progress</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center h-32">
          <p className="text-slate-400 text-sm">No budget categories set</p>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Budget Progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {categories.map(category => {
          const spent = getCategorySpent(category.name);
          const budget = category.budget_amount || 0;
          const percentage = budget > 0 ? Math.min((spent / budget) * 100, 100) : 0;
          const isOverBudget = spent > budget;
          
          return (
            <div key={category.id} className="space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium">{category.name}</span>
                <span className={cn(
                  "text-xs font-medium",
                  isOverBudget ? "text-red-600" : "text-slate-500"
                )}>
                  R {spent.toLocaleString()} / R {budget.toLocaleString()}
                </span>
              </div>
              <Progress 
                value={percentage} 
                className={cn(
                  "h-2",
                  isOverBudget ? "[&>div]:bg-red-500" : "[&>div]:bg-green-500"
                )}
              />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}