import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Edit2, Check, X, Copy, MessageSquare, ChevronDown, ChevronRight } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { format, parseISO, isAfter, isBefore, addMonths } from 'date-fns';
import CopyToMonthDialog from './CopyToMonthDialog';
import TutorialHint from './TutorialHint';
import { useTheme } from '../ThemeProvider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const EXPENSE_CATEGORIES = ['Rent', 'Utilities', 'Insurance', 'Subscriptions', 'Loans', 'Other'];

export default function ExpensesSection({ expenses, selectedMonth, householdId, defaultDate, onRefresh, showTutorial, debts = [] }) {
  const theme = useTheme();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [form, setForm] = useState({ 
    description: '',
    category: '', 
    expense_type: 'fixed',
    amount: '', 
    due_date: defaultDate || '', 
    is_paid: false, 
    expiry_date: '', 
    notes: '', 
    debt_id: '' 
  });
  const [newCategory, setNewCategory] = useState('');
  
  const handleCopyToMonth = async (targetMonth) => {
    for (const expense of expenses) {
      if (expense.expiry_date && isAfter(new Date(), parseISO(expense.expiry_date))) {
        continue;
      }
      await base44.entities.Expense.create({
        description: expense.description,
        category: expense.category,
        expense_type: expense.expense_type,
        amount: expense.amount,
        due_date: expense.due_date,
        expiry_date: expense.expiry_date,
        notes: expense.notes,
        debt_id: expense.debt_id,
        is_paid: false,
        month: targetMonth,
        household_id: householdId
      });
    }
    onRefresh();
  };
  
  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };
  
  // Group expenses by category and type
  const groupedExpenses = {};
  expenses.forEach(exp => {
    const key = `${exp.expense_type || 'fixed'}-${exp.category}`;
    if (!groupedExpenses[key]) {
      groupedExpenses[key] = [];
    }
    groupedExpenses[key].push(exp);
  });
  
  // Calculate totals
  const fixedTotal = expenses
    .filter(e => e.expense_type === 'fixed')
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  const variableTotal = expenses
    .filter(e => e.expense_type === 'variable')
    .reduce((sum, e) => sum + (e.amount || 0), 0);
  const grandTotal = fixedTotal + variableTotal;
  
  const handleAdd = async () => {
    const categoryToUse = newCategory || form.category;
    if (!categoryToUse || !form.amount) return;
    
    await base44.entities.Expense.create({
      ...form,
      category: categoryToUse,
      amount: parseFloat(form.amount),
      month: selectedMonth,
      household_id: householdId
    });
    setForm({ 
      description: '',
      category: '', 
      expense_type: 'fixed',
      amount: '', 
      due_date: defaultDate || '', 
      is_paid: false, 
      expiry_date: '', 
      notes: '',
      debt_id: ''
    });
    setNewCategory('');
    setIsAdding(false);
    onRefresh();
  };
  
  const handleUpdate = async (id) => {
    await base44.entities.Expense.update(id, {
      ...form,
      amount: parseFloat(form.amount)
    });
    setEditingId(null);
    setForm({ 
      description: '',
      category: 'Rent', 
      expense_type: 'fixed',
      amount: '', 
      due_date: '', 
      is_paid: false, 
      expiry_date: '', 
      notes: '',
      debt_id: ''
    });
    onRefresh();
  };
  
  const togglePaid = async (expense) => {
    await base44.entities.Expense.update(expense.id, { is_paid: !expense.is_paid });
    
    // If linked to debt and paying, create transaction
    if (!expense.is_paid && expense.debt_id) {
      const debt = debts.find(d => d.id === expense.debt_id);
      if (debt) {
        await base44.entities.DebtTransaction.create({
          debt_id: expense.debt_id,
          type: 'payment',
          amount: expense.amount,
          date: format(new Date(), 'yyyy-MM-dd'),
          expense_id: expense.id,
          household_id: householdId
        });
        
        const newAmount = debt.current_amount - expense.amount;
        await base44.entities.Debt.update(expense.debt_id, { 
          current_amount: Math.max(0, newAmount) 
        });
      }
    }
    
    onRefresh();
  };
  
  const handleDelete = async (id) => {
    await base44.entities.Expense.delete(id);
    onRefresh();
  };
  
  const startEdit = (expense) => {
    setEditingId(expense.id);
    setForm({
      description: expense.description || '',
      category: expense.category,
      expense_type: expense.expense_type || 'fixed',
      amount: expense.amount?.toString() || '',
      due_date: expense.due_date || '',
      is_paid: expense.is_paid || false,
      expiry_date: expense.expiry_date || '',
      notes: expense.notes || '',
      debt_id: expense.debt_id || ''
    });
  };
  
  const renderExpenseRow = (expense) => {
    const isExpiringSoon = expense.expiry_date && 
      isBefore(parseISO(expense.expiry_date), addMonths(new Date(), 2)) &&
      isAfter(parseISO(expense.expiry_date), new Date());
    
    const linkedDebt = debts.find(d => d.id === expense.debt_id);
    
    return (
      <div key={expense.id} className={`grid grid-cols-12 gap-2 px-4 py-2 items-center hover:bg-slate-50 ${isExpiringSoon ? 'bg-amber-50' : ''}`}>
        {editingId === expense.id ? (
          <>
            <div className="col-span-3">
              <Input 
                placeholder="Description"
                value={form.description} 
                onChange={(e) => setForm({...form, description: e.target.value})}
                className="h-8 text-sm"
              />
            </div>
            <div className="col-span-2">
              <Input 
                type="number"
                value={form.amount} 
                onChange={(e) => setForm({...form, amount: e.target.value})}
                className="h-8 text-sm"
              />
            </div>
            <div className="col-span-2">
              <Input 
                type="date"
                value={form.due_date} 
                onChange={(e) => setForm({...form, due_date: e.target.value})}
                className="h-8 text-sm"
              />
            </div>
            <div className="col-span-2">
              <Select value={form.debt_id} onValueChange={(val) => setForm({...form, debt_id: val})}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue placeholder="No Debt" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>None</SelectItem>
                  {debts.map(d => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-1 flex justify-center">
              <Checkbox 
                checked={form.is_paid}
                onCheckedChange={(checked) => setForm({...form, is_paid: checked})}
              />
            </div>
            <div className="col-span-2 flex gap-1">
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleUpdate(expense.id)}>
                <Check className="h-3 w-3 text-green-600" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingId(null)}>
                <X className="h-3 w-3 text-red-600" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="col-span-3 text-sm flex items-center gap-1">
              {expense.description || expense.category}
              {expense.notes && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <MessageSquare className="h-3 w-3 text-slate-400" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="max-w-xs">{expense.notes}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <div className="col-span-2 text-sm font-medium">R {expense.amount?.toLocaleString()}</div>
            <div className="col-span-2 text-xs text-slate-500">
              {expense.due_date ? format(parseISO(expense.due_date), 'dd MMM') : '-'}
            </div>
            <div className="col-span-2 text-xs">
              {linkedDebt ? (
                <span className="text-blue-600 font-medium">{linkedDebt.name}</span>
              ) : '-'}
            </div>
            <div className="col-span-1 flex justify-center">
              <Checkbox 
                checked={expense.is_paid}
                onCheckedChange={() => togglePaid(expense)}
              />
            </div>
            <div className="col-span-2 flex gap-1 justify-end">
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(expense)}>
                <Edit2 className="h-3 w-3 text-slate-400" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDelete(expense.id)}>
                <Trash2 className="h-3 w-3 text-red-400" />
              </Button>
            </div>
          </>
        )}
      </div>
    );
  };
  
  return (
    <Card className="border-0 shadow-md">
      <CardHeader className={`${theme.cardHeader} text-white rounded-t-lg py-3`}>
        <CardTitle className="text-base font-semibold flex items-center justify-between">
          <span className="flex items-center">
            EXPENSES
            <TutorialHint 
              text="Track all expenses by category. Link expenses to debt accounts for automatic payment tracking."
              showTutorial={showTutorial}
            />
          </span>
          <div className="flex gap-1">
            <Button 
              size="sm" 
              variant="ghost" 
              className={`h-7 text-white ${theme.primaryHover}`}
              onClick={() => setShowCopyDialog(true)}
              disabled={expenses.length === 0}
            >
              <Copy className="h-4 w-4 mr-1" /> Copy
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className={`h-7 text-white ${theme.primaryHover}`}
              onClick={() => setIsAdding(true)}
            >
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-100 text-xs font-medium text-slate-600 uppercase">
          <div className="col-span-3">Description</div>
          <div className="col-span-2">Amount</div>
          <div className="col-span-2">Due</div>
          <div className="col-span-2">Debt</div>
          <div className="col-span-1 text-center">Paid</div>
          <div className="col-span-2"></div>
        </div>
        
        <div className="divide-y divide-slate-200">
          {/* Fixed Expenses */}
          <div>
            <div 
              className="bg-slate-50 px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-slate-100"
              onClick={() => toggleCategory('fixed')}
            >
              <div className="flex items-center gap-2">
                {expandedCategories['fixed'] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="font-semibold text-sm">Fixed Expenses</span>
              </div>
              <span className="font-bold text-sm">R {fixedTotal.toLocaleString()}</span>
            </div>
            {expandedCategories['fixed'] && (
              <div className="divide-y divide-slate-100">
                {EXPENSE_CATEGORIES.map(cat => {
                  const key = `fixed-${cat}`;
                  const categoryExpenses = groupedExpenses[key] || [];
                  if (categoryExpenses.length === 0) return null;
                  
                  const catTotal = categoryExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
                  
                  return (
                    <div key={cat}>
                      <div className="bg-slate-50 px-6 py-1.5 flex items-center justify-between text-xs">
                        <span className="text-slate-600">{cat}</span>
                        <span className="font-medium">R {catTotal.toLocaleString()}</span>
                      </div>
                      {categoryExpenses.map(renderExpenseRow)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Variable Expenses */}
          <div>
            <div 
              className="bg-slate-50 px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-slate-100"
              onClick={() => toggleCategory('variable')}
            >
              <div className="flex items-center gap-2">
                {expandedCategories['variable'] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                <span className="font-semibold text-sm">Variable Expenses</span>
              </div>
              <span className="font-bold text-sm">R {variableTotal.toLocaleString()}</span>
            </div>
            {expandedCategories['variable'] && (
              <div className="divide-y divide-slate-100">
                {EXPENSE_CATEGORIES.map(cat => {
                  const key = `variable-${cat}`;
                  const categoryExpenses = groupedExpenses[key] || [];
                  if (categoryExpenses.length === 0) return null;
                  
                  const catTotal = categoryExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
                  
                  return (
                    <div key={cat}>
                      <div className="bg-slate-50 px-6 py-1.5 flex items-center justify-between text-xs">
                        <span className="text-slate-600">{cat}</span>
                        <span className="font-medium">R {catTotal.toLocaleString()}</span>
                      </div>
                      {categoryExpenses.map(renderExpenseRow)}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          
          {/* Add Form */}
          {isAdding && (
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center bg-blue-50">
              <div className="col-span-3">
                <Input 
                  placeholder="Description"
                  value={form.description} 
                  onChange={(e) => setForm({...form, description: e.target.value})}
                  className="h-8 text-sm"
                />
              </div>
              <div className="col-span-2">
                <div className="space-y-1">
                  <Input 
                    type="number"
                    placeholder="Amount"
                    value={form.amount} 
                    onChange={(e) => setForm({...form, amount: e.target.value})}
                    className="h-8 text-sm"
                  />
                  <Select value={form.expense_type} onValueChange={(val) => setForm({...form, expense_type: val})}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed</SelectItem>
                      <SelectItem value="variable">Variable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="col-span-2">
                <div className="space-y-1">
                  <Input 
                    type="date"
                    value={form.due_date} 
                    onChange={(e) => setForm({...form, due_date: e.target.value})}
                    className="h-8 text-sm"
                  />
                  <Select value={form.category} onValueChange={(val) => setForm({...form, category: val})}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {EXPENSE_CATEGORIES.map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="col-span-2">
                <Select value={form.debt_id} onValueChange={(val) => setForm({...form, debt_id: val})}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Link Debt" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={null}>None</SelectItem>
                    {debts.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-1 flex justify-center">
                <Checkbox 
                  checked={form.is_paid}
                  onCheckedChange={(checked) => setForm({...form, is_paid: checked})}
                />
              </div>
              <div className="col-span-2 flex gap-1">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleAdd}>
                  <Check className="h-3 w-3 text-green-600" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsAdding(false)}>
                  <X className="h-3 w-3 text-red-600" />
                </Button>
              </div>
            </div>
          )}
        </div>
        
        <div className={`grid grid-cols-12 gap-2 px-4 py-3 ${theme.cardFooter} text-white rounded-b-lg`}>
          <div className="col-span-8 font-semibold text-sm">TOTAL EXPENSES</div>
          <div className="col-span-4 text-right font-bold">R {grandTotal.toLocaleString()}</div>
        </div>
      </CardContent>
      
      <CopyToMonthDialog 
        open={showCopyDialog}
        onClose={() => setShowCopyDialog(false)}
        onCopy={handleCopyToMonth}
        title="Expenses"
      />
    </Card>
  );
}