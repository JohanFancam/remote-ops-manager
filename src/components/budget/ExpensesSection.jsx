import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Edit2, Check, X, Copy, Calendar } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { format, parseISO, isAfter, isBefore, addMonths } from 'date-fns';
import CopyToMonthDialog from './CopyToMonthDialog';
import TutorialHint from './TutorialHint';

export default function ExpensesSection({ expenses, selectedMonth, householdId, defaultDate, onRefresh, showTutorial }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [form, setForm] = useState({ category: '', amount: '', due_date: defaultDate || '', is_paid: false, expiry_date: '' });
  
  const handleCopyToMonth = async (targetMonth) => {
    for (const expense of fixedExpenses) {
      // Don't copy expired expenses
      if (expense.expiry_date && isAfter(new Date(), parseISO(expense.expiry_date))) {
        continue;
      }
      await base44.entities.Expense.create({
        category: expense.category,
        amount: expense.amount,
        due_date: expense.due_date,
        expiry_date: expense.expiry_date,
        is_paid: false,
        is_fixed: true,
        month: targetMonth,
        household_id: householdId
      });
    }
    onRefresh();
  };
  
  const fixedExpenses = expenses.filter(e => e.is_fixed);
  const totalCost = fixedExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  
  const handleAdd = async () => {
    if (!form.category || !form.amount) return;
    await base44.entities.Expense.create({
      ...form,
      amount: parseFloat(form.amount),
      is_fixed: true,
      month: selectedMonth,
      household_id: householdId
    });
    setForm({ category: '', amount: '', due_date: defaultDate || '', is_paid: false, expiry_date: '' });
    setIsAdding(false);
    onRefresh();
  };
  
  const handleUpdate = async (id) => {
    await base44.entities.Expense.update(id, {
      ...form,
      amount: parseFloat(form.amount)
    });
    setEditingId(null);
    setForm({ category: '', amount: '', due_date: '', is_paid: false });
    onRefresh();
  };
  
  const togglePaid = async (expense) => {
    await base44.entities.Expense.update(expense.id, { is_paid: !expense.is_paid });
    onRefresh();
  };
  
  const handleDelete = async (id) => {
    await base44.entities.Expense.delete(id);
    onRefresh();
  };
  
  const startEdit = (expense) => {
    setEditingId(expense.id);
    setForm({
      category: expense.category,
      amount: expense.amount?.toString() || '',
      due_date: expense.due_date || '',
      is_paid: expense.is_paid || false,
      expiry_date: expense.expiry_date || ''
    });
  };
  
  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="bg-slate-800 text-white rounded-t-lg py-3">
        <CardTitle className="text-base font-semibold flex items-center justify-between">
          <span className="flex items-center">
            FIXED EXPENSES / BILLS
            <TutorialHint 
              text="Monthly bills like rent, insurance, subscriptions. Set expiry dates for contracts to see projections of when they end. Due dates default to the 1st."
              showTutorial={showTutorial}
            />
          </span>
          <div className="flex gap-1">
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-7 text-white hover:bg-slate-700"
              onClick={() => setShowCopyDialog(true)}
              disabled={fixedExpenses.length === 0}
            >
              <Copy className="h-4 w-4 mr-1" /> Copy
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-7 text-white hover:bg-slate-700"
              onClick={() => setIsAdding(true)}
            >
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-100 text-xs font-medium text-slate-600 uppercase">
          <div className="col-span-3">Category</div>
          <div className="col-span-2">Amount</div>
          <div className="col-span-2">Due</div>
          <div className="col-span-2">Expires</div>
          <div className="col-span-2 text-center">Paid</div>
          <div className="col-span-1"></div>
        </div>
        
        <div className="divide-y divide-slate-100">
          {fixedExpenses.map((expense) => {
            const isExpiringSoon = expense.expiry_date && 
              isBefore(parseISO(expense.expiry_date), addMonths(new Date(), 2)) &&
              isAfter(parseISO(expense.expiry_date), new Date());
            
            return (
            <div key={expense.id} className={`grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-slate-50 ${isExpiringSoon ? 'bg-amber-50' : ''}`}>
              {editingId === expense.id ? (
                <>
                  <div className="col-span-3">
                    <Input 
                      value={form.category} 
                      onChange={(e) => setForm({...form, category: e.target.value})}
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
                    <Input 
                      type="date"
                      value={form.expiry_date} 
                      onChange={(e) => setForm({...form, expiry_date: e.target.value})}
                      className="h-8 text-sm"
                      placeholder="Expiry"
                    />
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <Checkbox 
                      checked={form.is_paid}
                      onCheckedChange={(checked) => setForm({...form, is_paid: checked})}
                    />
                  </div>
                  <div className="col-span-1 flex gap-1">
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
                  <div className="col-span-3 text-sm">{expense.category}</div>
                  <div className="col-span-2 text-sm font-medium">R {expense.amount?.toLocaleString()}</div>
                  <div className="col-span-2 text-xs text-slate-500">{expense.due_date ? format(parseISO(expense.due_date), 'dd MMM') : '-'}</div>
                  <div className="col-span-2 text-xs">
                    {expense.expiry_date ? (
                      <span className={isExpiringSoon ? 'text-amber-600 font-medium' : 'text-slate-500'}>
                        {format(parseISO(expense.expiry_date), 'MMM yyyy')}
                      </span>
                    ) : '-'}
                  </div>
                  <div className="col-span-2 flex justify-center">
                    <Checkbox 
                      checked={expense.is_paid}
                      onCheckedChange={() => togglePaid(expense)}
                    />
                  </div>
                  <div className="col-span-1 flex gap-1 justify-end">
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
          )})}
          
          {isAdding && (
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center bg-red-50">
              <div className="col-span-3">
                <Input 
                  placeholder="Category"
                  value={form.category} 
                  onChange={(e) => setForm({...form, category: e.target.value})}
                  className="h-8 text-sm"
                />
              </div>
              <div className="col-span-2">
                <Input 
                  type="number"
                  placeholder="0"
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
                <Input 
                  type="date"
                  value={form.expiry_date} 
                  onChange={(e) => setForm({...form, expiry_date: e.target.value})}
                  className="h-8 text-sm"
                  placeholder="Expiry"
                />
              </div>
              <div className="col-span-2 flex justify-center">
                <Checkbox 
                  checked={form.is_paid}
                  onCheckedChange={(checked) => setForm({...form, is_paid: checked})}
                />
              </div>
              <div className="col-span-1 flex gap-1">
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
        
        <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-slate-800 text-white rounded-b-lg">
          <div className="col-span-8 font-semibold text-sm">TOTAL COST</div>
          <div className="col-span-4 text-right font-bold">R {totalCost.toLocaleString()}</div>
        </div>
      </CardContent>
      
      <CopyToMonthDialog 
        open={showCopyDialog}
        onClose={() => setShowCopyDialog(false)}
        onCopy={handleCopyToMonth}
        title="Fixed Expenses"
      />
    </Card>
  );
}