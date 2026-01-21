import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Edit2, Check, X, Copy } from "lucide-react";
import { base44 } from '@/api/base44Client';
import CopyToMonthDialog from './CopyToMonthDialog';
import TutorialHint from './TutorialHint';
import { useTheme } from '../ThemeProvider';

export default function IncomeSection({ incomes, selectedMonth, householdId, defaultDate, onRefresh, showTutorial }) {
  const theme = useTheme();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [form, setForm] = useState({ source: '', amount: '', date: defaultDate || '' });
  
  const handleCopyToMonth = async (targetMonth) => {
    for (const income of incomes) {
      await base44.entities.Income.create({
        source: income.source,
        amount: income.amount,
        date: '',
        month: targetMonth,
        household_id: householdId
      });
    }
    onRefresh();
  };
  
  const totalIncome = incomes.reduce((sum, i) => sum + (i.amount || 0), 0);
  
  const handleAdd = async () => {
    if (!form.source || !form.amount) return;
    await base44.entities.Income.create({
      ...form,
      amount: parseFloat(form.amount),
      month: selectedMonth,
      household_id: householdId
    });
    setForm({ source: '', amount: '', date: defaultDate || '' });
    setIsAdding(false);
    onRefresh();
  };
  
  const handleUpdate = async (id) => {
    await base44.entities.Income.update(id, {
      ...form,
      amount: parseFloat(form.amount)
    });
    setEditingId(null);
    setForm({ source: '', amount: '', date: '' });
    onRefresh();
  };
  
  const handleDelete = async (id) => {
    await base44.entities.Income.delete(id);
    onRefresh();
  };
  
  const startEdit = (income) => {
    setEditingId(income.id);
    setForm({
      source: income.source,
      amount: income.amount?.toString() || '',
      date: income.date || ''
    });
  };
  
  return (
    <Card className="border-0 shadow-md">
      <CardHeader className={`${theme.cardHeader} text-white rounded-t-lg py-3`}>
        <CardTitle className="text-base font-semibold flex items-center justify-between">
          <span className="flex items-center">
            INCOME
            <TutorialHint 
              text="Track all your income sources here. By default, income is set to the 25th of each month but you can change this in Settings."
              showTutorial={showTutorial}
            />
          </span>
          <div className="flex gap-1">
            <Button 
              size="sm" 
              variant="ghost" 
              className={`h-7 text-white ${theme.primaryHover}`}
              onClick={() => setShowCopyDialog(true)}
              disabled={incomes.length === 0}
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
          <div className="col-span-5">Source</div>
          <div className="col-span-3">Date</div>
          <div className="col-span-3 text-right">Amount</div>
          <div className="col-span-1"></div>
        </div>
        
        <div className="divide-y divide-slate-100">
          {incomes.map((income) => (
            <div key={income.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-slate-50">
              {editingId === income.id ? (
                <>
                  <div className="col-span-5">
                    <Input 
                      value={form.source} 
                      onChange={(e) => setForm({...form, source: e.target.value})}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="col-span-3">
                    <Input 
                      type="date"
                      value={form.date} 
                      onChange={(e) => setForm({...form, date: e.target.value})}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="col-span-3">
                    <Input 
                      type="number"
                      value={form.amount} 
                      onChange={(e) => setForm({...form, amount: e.target.value})}
                      className="h-8 text-sm text-right"
                    />
                  </div>
                  <div className="col-span-1 flex gap-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleUpdate(income.id)}>
                      <Check className="h-3 w-3 text-green-600" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingId(null)}>
                      <X className="h-3 w-3 text-red-600" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="col-span-5 text-sm">{income.source}</div>
                  <div className="col-span-3 text-sm text-slate-500">{income.date || '-'}</div>
                  <div className="col-span-3 text-sm text-right font-medium">R {income.amount?.toLocaleString()}</div>
                  <div className="col-span-1 flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(income)}>
                      <Edit2 className="h-3 w-3 text-slate-400" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDelete(income.id)}>
                      <Trash2 className="h-3 w-3 text-red-400" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
          
          {isAdding && (
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center bg-green-50">
              <div className="col-span-5">
                <Input 
                  placeholder="Source"
                  value={form.source} 
                  onChange={(e) => setForm({...form, source: e.target.value})}
                  className="h-8 text-sm"
                />
              </div>
              <div className="col-span-3">
                <Input 
                  type="date"
                  value={form.date} 
                  onChange={(e) => setForm({...form, date: e.target.value})}
                  className="h-8 text-sm"
                />
              </div>
              <div className="col-span-3">
                <Input 
                  type="number"
                  placeholder="0"
                  value={form.amount} 
                  onChange={(e) => setForm({...form, amount: e.target.value})}
                  className="h-8 text-sm text-right"
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
        
        <div className={`grid grid-cols-12 gap-2 px-4 py-3 ${theme.cardFooter} text-white rounded-b-lg`}>
          <div className="col-span-8 font-semibold text-sm">TOTAL INCOME</div>
          <div className="col-span-4 text-right font-bold">R {totalIncome.toLocaleString()}</div>
        </div>
      </CardContent>
      
      <CopyToMonthDialog 
        open={showCopyDialog}
        onClose={() => setShowCopyDialog(false)}
        onCopy={handleCopyToMonth}
        title="Income"
      />
    </Card>
  );
}