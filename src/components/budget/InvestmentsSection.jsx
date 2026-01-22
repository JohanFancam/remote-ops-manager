import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2, Edit2, Check, X, Copy, Upload } from "lucide-react";
import { base44 } from '@/api/base44Client';
import CopyToMonthDialog from './CopyToMonthDialog';
import TutorialHint from './TutorialHint';
import { useTheme } from '../ThemeProvider';
import CSVImportDialog from '../common/CSVImportDialog';

const CSV_FIELD_MAPPINGS = {
  'name': { field: 'name', type: 'string' },
  'savings_goal': { field: 'savings_goal', type: 'number' },
  'amount_saved': { field: 'amount_saved', type: 'number' },
};

export default function InvestmentsSection({ investments, selectedMonth, householdId, onRefresh, showTutorial }) {
  const theme = useTheme();
  const [showImport, setShowImport] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [form, setForm] = useState({ name: '', savings_goal: '', amount_saved: '' });
  
  const handleCopyToMonth = async (targetMonth) => {
    for (const investment of investments) {
      await base44.entities.Investment.create({
        name: investment.name,
        savings_goal: investment.savings_goal,
        amount_saved: 0,
        month: targetMonth,
        household_id: householdId
      });
    }
    onRefresh();
  };
  
  const totalSaved = investments.reduce((sum, i) => sum + (i.amount_saved || 0), 0);
  
  const handleAdd = async () => {
    if (!form.name || !form.savings_goal) return;
    await base44.entities.Investment.create({
      ...form,
      savings_goal: parseFloat(form.savings_goal),
      amount_saved: parseFloat(form.amount_saved) || 0,
      month: selectedMonth,
      household_id: householdId
    });
    setForm({ name: '', savings_goal: '', amount_saved: '' });
    setIsAdding(false);
    onRefresh();
  };
  
  const handleUpdate = async (id) => {
    await base44.entities.Investment.update(id, {
      ...form,
      savings_goal: parseFloat(form.savings_goal),
      amount_saved: parseFloat(form.amount_saved) || 0
    });
    setEditingId(null);
    setForm({ name: '', savings_goal: '', amount_saved: '' });
    onRefresh();
  };
  
  const handleDelete = async (id) => {
    await base44.entities.Investment.delete(id);
    onRefresh();
  };
  
  const startEdit = (investment) => {
    setEditingId(investment.id);
    setForm({
      name: investment.name,
      savings_goal: investment.savings_goal?.toString() || '',
      amount_saved: investment.amount_saved?.toString() || ''
    });
  };
  
  return (
    <Card className="border-0 shadow-md">
      <CardHeader className={`${theme.accent} text-white rounded-t-lg py-3`}>
        <CardTitle className="text-base font-semibold flex items-center justify-between">
          <span className="flex items-center">
            INVESTMENTS / SAVINGS
            <TutorialHint 
              text="Track your monthly savings and investments here. Set goals and record how much you've saved each month."
              showTutorial={showTutorial}
            />
          </span>
          <div className="flex gap-1">
            <Button 
              size="sm" 
              variant="ghost" 
              className={`h-7 text-white ${theme.accentHover}`}
              onClick={() => setShowImport(true)}
            >
              <Upload className="h-4 w-4 mr-1" /> Import
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className={`h-7 text-white ${theme.accentHover}`}
              onClick={() => setShowCopyDialog(true)}
              disabled={investments.length === 0}
            >
              <Copy className="h-4 w-4 mr-1" /> Copy
            </Button>
            <Button 
              size="sm" 
              variant="ghost" 
              className={`h-7 text-white ${theme.accentHover}`}
              onClick={() => setIsAdding(true)}
            >
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-100 text-xs font-medium text-slate-600 uppercase">
          <div className="col-span-5">Name</div>
          <div className="col-span-3 text-right">Goal</div>
          <div className="col-span-3 text-right">Saved</div>
          <div className="col-span-1"></div>
        </div>
        
        <div className="divide-y divide-slate-100">
          {investments.map((investment) => (
            <div key={investment.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-slate-50">
              {editingId === investment.id ? (
                <>
                  <div className="col-span-5">
                    <Input 
                      value={form.name} 
                      onChange={(e) => setForm({...form, name: e.target.value})}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="col-span-3">
                    <Input 
                      type="number"
                      value={form.savings_goal} 
                      onChange={(e) => setForm({...form, savings_goal: e.target.value})}
                      className="h-8 text-sm text-right"
                    />
                  </div>
                  <div className="col-span-3">
                    <Input 
                      type="number"
                      value={form.amount_saved} 
                      onChange={(e) => setForm({...form, amount_saved: e.target.value})}
                      className="h-8 text-sm text-right"
                    />
                  </div>
                  <div className="col-span-1 flex gap-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleUpdate(investment.id)}>
                      <Check className="h-3 w-3 text-green-600" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingId(null)}>
                      <X className="h-3 w-3 text-red-600" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="col-span-5 text-sm">{investment.name}</div>
                  <div className="col-span-3 text-sm text-right">R {investment.savings_goal?.toLocaleString()}</div>
                  <div className="col-span-3 text-sm text-right font-medium">R {investment.amount_saved?.toLocaleString()}</div>
                  <div className="col-span-1 flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(investment)}>
                      <Edit2 className="h-3 w-3 text-slate-400" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDelete(investment.id)}>
                      <Trash2 className="h-3 w-3 text-red-400" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
          
          {isAdding && (
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center bg-blue-50">
              <div className="col-span-5">
                <Input 
                  placeholder="Name"
                  value={form.name} 
                  onChange={(e) => setForm({...form, name: e.target.value})}
                  className="h-8 text-sm"
                />
              </div>
              <div className="col-span-3">
                <Input 
                  type="number"
                  placeholder="Goal"
                  value={form.savings_goal} 
                  onChange={(e) => setForm({...form, savings_goal: e.target.value})}
                  className="h-8 text-sm text-right"
                />
              </div>
              <div className="col-span-3">
                <Input 
                  type="number"
                  placeholder="Saved"
                  value={form.amount_saved} 
                  onChange={(e) => setForm({...form, amount_saved: e.target.value})}
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
        
        <div className={`grid grid-cols-12 gap-2 px-4 py-3 ${theme.accent} text-white rounded-b-lg`}>
          <div className="col-span-8 font-semibold text-sm">TOTAL SAVED</div>
          <div className="col-span-4 text-right font-bold">R {totalSaved.toLocaleString()}</div>
        </div>
      </CardContent>
      
      <CopyToMonthDialog 
        open={showCopyDialog}
        onClose={() => setShowCopyDialog(false)}
        onCopy={handleCopyToMonth}
        title="Investments"
      />
    </Card>
  );
}