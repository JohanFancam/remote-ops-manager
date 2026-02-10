import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit2, Check, X, Copy, ChevronDown, ChevronRight } from "lucide-react";
import { base44 } from '@/api/base44Client';
import CopyToMonthDialog from './CopyToMonthDialog';
import TutorialHint from './TutorialHint';
import { useTheme } from '../ThemeProvider';

export default function IncomeSection({ incomes, selectedMonth, householdId, defaultDate, onRefresh, showTutorial }) {
  const theme = useTheme();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState({});
  const [form, setForm] = useState({ source: '', category: '', amount: '', date: defaultDate || '' });
  const [newCategory, setNewCategory] = useState('');
  
  // Get unique categories from existing incomes
  const allCategories = [...new Set(incomes.map(i => i.category).filter(Boolean))];
  
  // Group incomes by category
  const groupedIncomes = {};
  incomes.forEach(income => {
    const category = income.category || 'Uncategorized';
    if (!groupedIncomes[category]) {
      groupedIncomes[category] = [];
    }
    groupedIncomes[category].push(income);
  });
  
  const toggleCategory = (category) => {
    setExpandedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };
  
  const handleCopyToMonth = async (targetMonth) => {
    for (const income of incomes) {
      await base44.entities.Income.create({
        source: income.source,
        category: income.category,
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
    const categoryToUse = newCategory || form.category;
    if (!form.source || !form.amount) return;
    await base44.entities.Income.create({
      ...form,
      category: categoryToUse,
      amount: parseFloat(form.amount),
      month: selectedMonth,
      household_id: householdId
    });
    setForm({ source: '', category: '', amount: '', date: defaultDate || '' });
    setNewCategory('');
    setIsAdding(false);
    onRefresh();
  };
  
  const handleUpdate = async (id) => {
    await base44.entities.Income.update(id, {
      ...form,
      amount: parseFloat(form.amount)
    });
    setEditingId(null);
    setForm({ source: '', category: '', amount: '', date: '' });
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
      category: income.category || '',
      amount: income.amount?.toString() || '',
      date: income.date || ''
    });
  };
  
  const renderIncomeRow = (income) => (
    <div key={income.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-slate-50">
      {editingId === income.id ? (
        <>
          <div className="col-span-4">
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
          <div className="col-span-2 flex gap-1 justify-end">
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
          <div className="col-span-4 text-sm">{income.source}</div>
          <div className="col-span-3 text-sm text-slate-500">{income.date || '-'}</div>
          <div className="col-span-3 text-sm text-right font-medium">R {income.amount?.toLocaleString()}</div>
          <div className="col-span-2 flex gap-1 justify-end">
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
  );
  
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
          <div className="col-span-4">Source</div>
          <div className="col-span-3">Date</div>
          <div className="col-span-3 text-right">Amount</div>
          <div className="col-span-2"></div>
        </div>
        
        <div className="divide-y divide-slate-200">
          {Object.keys(groupedIncomes).sort().map(category => {
            const categoryIncomes = groupedIncomes[category];
            const catTotal = categoryIncomes.reduce((sum, i) => sum + (i.amount || 0), 0);
            const isExpanded = expandedCategories[category];
            
            return (
              <div key={category}>
                <div 
                  className="bg-slate-50 px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-slate-100"
                  onClick={() => toggleCategory(category)}
                >
                  <div className="flex items-center gap-2">
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                    <span className="font-semibold text-sm">{category}</span>
                  </div>
                  <span className="font-bold text-sm text-green-600">R {catTotal.toLocaleString()}</span>
                </div>
                {isExpanded && (
                  <div className="divide-y divide-slate-100">
                    {categoryIncomes.map(renderIncomeRow)}
                  </div>
                )}
              </div>
            );
          })}
          
          {isAdding && (
            <div className="px-4 py-3 bg-green-50 border-t-2 border-green-200">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-700">Category:</span>
                {allCategories.length > 0 && (
                  <>
                    <Select value={form.category} onValueChange={(val) => { setForm({...form, category: val}); setNewCategory(''); }}>
                      <SelectTrigger className="h-8 text-sm w-40">
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {allCategories.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <span className="text-xs text-slate-500">or</span>
                  </>
                )}
                <Input 
                  placeholder="New category name"
                  value={newCategory}
                  onChange={(e) => { setNewCategory(e.target.value); setForm({...form, category: ''}); }}
                  className="h-8 text-sm w-48"
                />
              </div>
              <div className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-4">
                  <Input 
                    placeholder="Income source"
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
                <div className="col-span-2 flex gap-1 justify-end">
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleAdd}>
                    <Check className="h-3 w-3 text-green-600" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setIsAdding(false); setNewCategory(''); }}>
                    <X className="h-3 w-3 text-red-600" />
                  </Button>
                </div>
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