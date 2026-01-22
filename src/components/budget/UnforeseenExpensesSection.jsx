import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit2, Check, X, AlertTriangle } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useTheme } from '../ThemeProvider';
import TutorialHint from './TutorialHint';

const CATEGORIES = [
  { value: 'medical', label: 'Medical/Doctor' },
  { value: 'car_repair', label: 'Car Repair' },
  { value: 'home_repair', label: 'Home Repair' },
  { value: 'fines', label: 'Fines/Penalties' },
  { value: 'emergency', label: 'Emergency' },
  { value: 'other', label: 'Other' },
];

export default function UnforeseenExpensesSection({ selectedMonth, householdId, showTutorial }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    description: '',
    category: 'other',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });

  const { data: expenses = [], isLoading } = useQuery({
    queryKey: ['unforeseenExpenses', householdId, selectedMonth],
    queryFn: () => base44.entities.UnforeseenExpense.filter({ 
      household_id: householdId, 
      month: selectedMonth 
    }),
    enabled: !!householdId,
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['unforeseenExpenses'] });
  };

  const handleAdd = async () => {
    if (!form.description || !form.amount) return;
    await base44.entities.UnforeseenExpense.create({
      ...form,
      amount: parseFloat(form.amount),
      month: selectedMonth,
      household_id: householdId
    });
    setForm({ description: '', category: 'other', amount: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
    setIsAdding(false);
    refresh();
  };

  const handleUpdate = async (id) => {
    await base44.entities.UnforeseenExpense.update(id, {
      ...form,
      amount: parseFloat(form.amount)
    });
    setEditingId(null);
    setForm({ description: '', category: 'other', amount: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
    refresh();
  };

  const handleDelete = async (id) => {
    await base44.entities.UnforeseenExpense.delete(id);
    refresh();
  };

  const startEdit = (expense) => {
    setEditingId(expense.id);
    setForm({
      description: expense.description || '',
      category: expense.category || 'other',
      amount: expense.amount?.toString() || '',
      date: expense.date || format(new Date(), 'yyyy-MM-dd'),
      notes: expense.notes || ''
    });
  };

  const getCategoryLabel = (value) => CATEGORIES.find(c => c.value === value)?.label || value;

  const totalAmount = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);

  return (
    <Card className={`border-0 shadow-md ${theme.cardBg}`}>
      <CardHeader className={`bg-amber-600 text-white rounded-t-lg py-3`}>
        <CardTitle className="text-base font-semibold flex items-center justify-between">
          <span className="flex items-center">
            <AlertTriangle className="h-4 w-4 mr-2" />
            UNFORESEEN EXPENSES
            <TutorialHint 
              text="Track unexpected expenses like medical bills, car repairs, or fines that weren't in your original budget."
              showTutorial={showTutorial}
            />
          </span>
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-7 text-white hover:bg-amber-500"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className={`grid grid-cols-12 gap-2 px-4 py-2 ${theme.headerBg} text-xs font-medium ${theme.textMuted} uppercase`}>
          <div className="col-span-4">Description</div>
          <div className="col-span-2">Category</div>
          <div className="col-span-2">Date</div>
          <div className="col-span-2 text-right">Amount</div>
          <div className="col-span-2"></div>
        </div>

        <div className={`${theme.divider} divide-y`}>
          {expenses.map((expense) => (
            <div key={expense.id} className={`grid grid-cols-12 gap-2 px-4 py-2.5 items-center ${theme.hoverBg}`}>
              {editingId === expense.id ? (
                <>
                  <div className="col-span-4">
                    <Input value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} className="h-8 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <Select value={form.category} onValueChange={(v) => setForm({...form, category: v})}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Input type="date" value={form.date} onChange={(e) => setForm({...form, date: e.target.value})} className="h-8 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value})} className="h-8 text-sm text-right" />
                  </div>
                  <div className="col-span-2 flex gap-1 justify-end">
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
                  <div className={`col-span-4 text-sm ${theme.text}`}>{expense.description}</div>
                  <div className={`col-span-2 text-xs ${theme.textMuted}`}>{getCategoryLabel(expense.category)}</div>
                  <div className={`col-span-2 text-xs ${theme.textMuted}`}>{expense.date || '-'}</div>
                  <div className={`col-span-2 text-sm text-right font-medium text-amber-600`}>R {expense.amount?.toLocaleString()}</div>
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
          ))}

          {isAdding && (
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center bg-amber-50">
              <div className="col-span-4">
                <Input placeholder="Description" value={form.description} onChange={(e) => setForm({...form, description: e.target.value})} className="h-8 text-sm" />
              </div>
              <div className="col-span-2">
                <Select value={form.category} onValueChange={(v) => setForm({...form, category: v})}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(cat => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Input type="date" value={form.date} onChange={(e) => setForm({...form, date: e.target.value})} className="h-8 text-sm" />
              </div>
              <div className="col-span-2">
                <Input type="number" placeholder="0" value={form.amount} onChange={(e) => setForm({...form, amount: e.target.value})} className="h-8 text-sm text-right" />
              </div>
              <div className="col-span-2 flex gap-1 justify-end">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleAdd}>
                  <Check className="h-3 w-3 text-green-600" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsAdding(false)}>
                  <X className="h-3 w-3 text-red-600" />
                </Button>
              </div>
            </div>
          )}

          {expenses.length === 0 && !isAdding && (
            <div className={`px-4 py-8 text-center ${theme.textMuted}`}>
              <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No unforeseen expenses this month</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-amber-600 text-white rounded-b-lg">
          <div className="col-span-8 font-semibold text-sm">TOTAL UNFORESEEN</div>
          <div className="col-span-4 text-right font-bold">R {totalAmount.toLocaleString()}</div>
        </div>
      </CardContent>
    </Card>
  );
}