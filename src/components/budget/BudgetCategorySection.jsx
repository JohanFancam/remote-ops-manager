import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Edit2, Check, X, ChevronDown, ChevronRight, Copy } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { cn } from "@/lib/utils";
import CopyToMonthDialog from './CopyToMonthDialog';
import TutorialHint from './TutorialHint';
import { useTheme } from '../ThemeProvider';

export default function BudgetCategorySection({ categories, expenses, selectedMonth, householdId, onRefresh, showTutorial }) {
  const theme = useTheme();
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(null);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [editingExpenseId, setEditingExpenseId] = useState(null);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', budget_amount: '' });
  const [expenseForm, setExpenseForm] = useState({ description: '', amount: '' });
  
  const handleCopyToMonth = async (targetMonth) => {
    for (const category of categories) {
      await base44.entities.BudgetCategory.create({
        name: category.name,
        budget_amount: category.budget_amount,
        month: targetMonth,
        household_id: householdId
      });
    }
    onRefresh();
  };
  
  const variableExpenses = expenses.filter(e => !e.is_fixed);
  
  const getCategoryExpenses = (categoryName) => {
    return variableExpenses.filter(e => e.category === categoryName);
  };
  
  const getCategorySpent = (categoryName) => {
    return getCategoryExpenses(categoryName).reduce((sum, e) => sum + (e.amount || 0), 0);
  };
  
  const toggleCategory = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };
  
  const handleAddCategory = async () => {
    if (!categoryForm.name || !categoryForm.budget_amount) return;
    await base44.entities.BudgetCategory.create({
      ...categoryForm,
      budget_amount: parseFloat(categoryForm.budget_amount),
      month: selectedMonth,
      household_id: householdId
    });
    setCategoryForm({ name: '', budget_amount: '' });
    setIsAddingCategory(false);
    onRefresh();
  };
  
  const handleUpdateCategory = async (id) => {
    await base44.entities.BudgetCategory.update(id, {
      ...categoryForm,
      budget_amount: parseFloat(categoryForm.budget_amount)
    });
    setEditingCategoryId(null);
    setCategoryForm({ name: '', budget_amount: '' });
    onRefresh();
  };
  
  const handleDeleteCategory = async (id) => {
    await base44.entities.BudgetCategory.delete(id);
    onRefresh();
  };
  
  const handleAddExpense = async (categoryName) => {
    if (!expenseForm.description || !expenseForm.amount) return;
    await base44.entities.Expense.create({
      category: categoryName,
      description: expenseForm.description,
      amount: parseFloat(expenseForm.amount),
      is_fixed: false,
      month: selectedMonth,
      household_id: householdId
    });
    setExpenseForm({ description: '', amount: '' });
    setIsAddingExpense(null);
    onRefresh();
  };
  
  const handleUpdateExpense = async (id) => {
    await base44.entities.Expense.update(id, {
      description: expenseForm.description,
      amount: parseFloat(expenseForm.amount)
    });
    setEditingExpenseId(null);
    setExpenseForm({ description: '', amount: '' });
    onRefresh();
  };
  
  const handleDeleteExpense = async (id) => {
    await base44.entities.Expense.delete(id);
    onRefresh();
  };
  
  const startEditCategory = (category) => {
    setEditingCategoryId(category.id);
    setCategoryForm({
      name: category.name,
      budget_amount: category.budget_amount?.toString() || ''
    });
  };
  
  const startEditExpense = (expense) => {
    setEditingExpenseId(expense.id);
    setExpenseForm({
      description: expense.description || '',
      amount: expense.amount?.toString() || ''
    });
  };
  
  return (
    <Card className="border-0 shadow-md">
      <CardHeader className={`${theme.cardHeader} text-white rounded-t-lg py-3`}>
        <CardTitle className="text-base font-semibold flex items-center justify-between">
          <span className="flex items-center">
            MONTHLY BUDGET
            <TutorialHint 
              text="Set spending limits for categories like Groceries, Transport, etc. Track individual purchases against each budget to stay on track."
              showTutorial={showTutorial}
            />
          </span>
          <div className="flex gap-1">
            <Button 
              size="sm" 
              variant="ghost" 
              className={`h-7 text-white ${theme.primaryHover}`}
              onClick={() => setShowCopyDialog(true)}
              disabled={categories.length === 0}
            >
              <Copy className="h-4 w-4 mr-1" /> Copy
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className={`h-7 text-white ${theme.primaryHover}`}
              onClick={() => setIsAddingCategory(true)}
            >
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {isAddingCategory && (
          <div className="grid grid-cols-12 gap-2 px-4 py-3 items-center bg-green-50 border-b">
            <div className="col-span-6">
              <Input 
                placeholder="Category Name"
                value={categoryForm.name} 
                onChange={(e) => setCategoryForm({...categoryForm, name: e.target.value})}
                className="h-8 text-sm"
              />
            </div>
            <div className="col-span-4">
              <Input 
                type="number"
                placeholder="Budget Amount"
                value={categoryForm.budget_amount} 
                onChange={(e) => setCategoryForm({...categoryForm, budget_amount: e.target.value})}
                className="h-8 text-sm"
              />
            </div>
            <div className="col-span-2 flex gap-1 justify-end">
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleAddCategory}>
                <Check className="h-3 w-3 text-green-600" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsAddingCategory(false)}>
                <X className="h-3 w-3 text-red-600" />
              </Button>
            </div>
          </div>
        )}
        
        <div className="divide-y divide-slate-200">
          {categories.map((category) => {
            const spent = getCategorySpent(category.name);
            const remaining = (category.budget_amount || 0) - spent;
            const isExpanded = expandedCategories[category.id];
            const categoryExpenses = getCategoryExpenses(category.name);
            
            return (
              <div key={category.id}>
                {editingCategoryId === category.id ? (
                  <div className="grid grid-cols-12 gap-2 px-4 py-3 items-center bg-amber-50">
                    <div className="col-span-6">
                      <Input 
                        value={categoryForm.name} 
                        onChange={(e) => setCategoryForm({...categoryForm, name: e.target.value})}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="col-span-4">
                      <Input 
                        type="number"
                        value={categoryForm.budget_amount} 
                        onChange={(e) => setCategoryForm({...categoryForm, budget_amount: e.target.value})}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div className="col-span-2 flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleUpdateCategory(category.id)}>
                        <Check className="h-3 w-3 text-green-600" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingCategoryId(null)}>
                        <X className="h-3 w-3 text-red-600" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div 
                      className="flex items-center justify-between px-4 py-3 bg-slate-100 cursor-pointer hover:bg-slate-200"
                      onClick={() => toggleCategory(category.id)}
                    >
                      <div className="flex items-center gap-2">
                        {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        <span className="font-semibold text-sm uppercase">{category.name}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium">Budget: R {category.budget_amount?.toLocaleString()}</span>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); startEditCategory(category); }}>
                          <Edit2 className="h-3 w-3 text-slate-400" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleDeleteCategory(category.id); }}>
                          <Trash2 className="h-3 w-3 text-red-400" />
                        </Button>
                      </div>
                    </div>
                    
                    {isExpanded && (
                      <div className="bg-white">
                        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-50 text-xs font-medium text-slate-500 uppercase border-b">
                          <div className="col-span-6">Expense</div>
                          <div className="col-span-3 text-right">Amount</div>
                          <div className="col-span-3 text-right">(+/-)</div>
                        </div>
                        
                        {categoryExpenses.map((expense) => (
                          <div key={expense.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center border-b border-slate-50 hover:bg-slate-50">
                            {editingExpenseId === expense.id ? (
                              <>
                                <div className="col-span-6">
                                  <Input 
                                    value={expenseForm.description} 
                                    onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})}
                                    className="h-8 text-sm"
                                  />
                                </div>
                                <div className="col-span-4">
                                  <Input 
                                    type="number"
                                    value={expenseForm.amount} 
                                    onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})}
                                    className="h-8 text-sm text-right"
                                  />
                                </div>
                                <div className="col-span-2 flex gap-1 justify-end">
                                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleUpdateExpense(expense.id)}>
                                    <Check className="h-3 w-3 text-green-600" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingExpenseId(null)}>
                                    <X className="h-3 w-3 text-red-600" />
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="col-span-6 text-sm">{expense.description || '-'}</div>
                                <div className="col-span-3 text-sm text-right">R {expense.amount?.toLocaleString()}</div>
                                <div className="col-span-2 text-sm text-right text-slate-400">-R {expense.amount?.toLocaleString()}</div>
                                <div className="col-span-1 flex gap-1 justify-end">
                                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEditExpense(expense)}>
                                    <Edit2 className="h-3 w-3 text-slate-400" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDeleteExpense(expense.id)}>
                                    <Trash2 className="h-3 w-3 text-red-400" />
                                  </Button>
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                        
                        {isAddingExpense === category.id && (
                          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center bg-blue-50 border-b">
                            <div className="col-span-6">
                              <Input 
                                placeholder="Expense description"
                                value={expenseForm.description} 
                                onChange={(e) => setExpenseForm({...expenseForm, description: e.target.value})}
                                className="h-8 text-sm"
                              />
                            </div>
                            <div className="col-span-4">
                              <Input 
                                type="number"
                                placeholder="Amount"
                                value={expenseForm.amount} 
                                onChange={(e) => setExpenseForm({...expenseForm, amount: e.target.value})}
                                className="h-8 text-sm text-right"
                              />
                            </div>
                            <div className="col-span-2 flex gap-1 justify-end">
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleAddExpense(category.name)}>
                                <Check className="h-3 w-3 text-green-600" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsAddingExpense(null)}>
                                <X className="h-3 w-3 text-red-600" />
                              </Button>
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between px-4 py-2 bg-slate-50">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 text-xs text-slate-600"
                            onClick={() => setIsAddingExpense(category.id)}
                          >
                            <Plus className="h-3 w-3 mr-1" /> Add Expense
                          </Button>
                        </div>
                        
                        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-amber-50 border-t">
                          <div className="col-span-6 text-xs font-semibold uppercase">Total</div>
                          <div className="col-span-3 text-sm text-right font-medium">R {spent.toLocaleString()}</div>
                          <div className={cn(
                            "col-span-3 text-sm text-right font-medium",
                            remaining >= 0 ? "text-green-600" : "text-red-600"
                          )}>
                            {remaining >= 0 ? '+' : ''}R {remaining.toLocaleString()}
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
      
      <CopyToMonthDialog 
        open={showCopyDialog}
        onClose={() => setShowCopyDialog(false)}
        onCopy={handleCopyToMonth}
        title="Budget Categories"
      />
    </Card>
  );
}