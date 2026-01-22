import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Edit2, Check, X, CreditCard, TrendingDown, Upload, ChevronDown, ChevronRight } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { useTheme } from '../ThemeProvider';
import TutorialHint from './TutorialHint';
import CSVImportDialog from '../common/CSVImportDialog';

const CSV_FIELD_MAPPINGS = {
  'name': { field: 'name', type: 'string' },
  'original_amount': { field: 'original_amount', type: 'number' },
  'current_amount': { field: 'current_amount', type: 'number' },
  'interest_rate': { field: 'interest_rate', type: 'number' },
  'minimum_payment': { field: 'minimum_payment', type: 'number' },
  'due_date': { field: 'due_date', type: 'number' },
  'notes': { field: 'notes', type: 'string' },
};

export default function DebtSection({ householdId, showTutorial }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [showImport, setShowImport] = useState(false);
  const [showAddTransaction, setShowAddTransaction] = useState(null);
  const [form, setForm] = useState({ 
    name: '', 
    original_amount: '', 
    current_amount: '', 
    interest_rate: '',
    minimum_payment: '',
    due_date: '',
    notes: '' 
  });
  const [transactionForm, setTransactionForm] = useState({
    type: 'payment',
    amount: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    notes: ''
  });

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

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['debts'] });
    queryClient.invalidateQueries({ queryKey: ['debtTransactions'] });
  };

  const handleAdd = async () => {
    if (!form.name || !form.original_amount) return;
    await base44.entities.Debt.create({
      ...form,
      original_amount: parseFloat(form.original_amount),
      current_amount: parseFloat(form.current_amount || form.original_amount),
      interest_rate: parseFloat(form.interest_rate) || 0,
      minimum_payment: parseFloat(form.minimum_payment) || 0,
      due_date: parseInt(form.due_date) || 1,
      household_id: householdId
    });
    setForm({ name: '', original_amount: '', current_amount: '', interest_rate: '', minimum_payment: '', due_date: '', notes: '' });
    setIsAdding(false);
    refresh();
  };

  const handleUpdate = async (id) => {
    await base44.entities.Debt.update(id, {
      ...form,
      original_amount: parseFloat(form.original_amount),
      current_amount: parseFloat(form.current_amount),
      interest_rate: parseFloat(form.interest_rate) || 0,
      minimum_payment: parseFloat(form.minimum_payment) || 0,
      due_date: parseInt(form.due_date) || 1,
    });
    setEditingId(null);
    setForm({ name: '', original_amount: '', current_amount: '', interest_rate: '', minimum_payment: '', due_date: '', notes: '' });
    refresh();
  };

  const handleDelete = async (id) => {
    await base44.entities.Debt.delete(id);
    refresh();
  };

  const startEdit = (debt) => {
    setEditingId(debt.id);
    setForm({
      name: debt.name,
      original_amount: debt.original_amount?.toString() || '',
      current_amount: debt.current_amount?.toString() || '',
      interest_rate: debt.interest_rate?.toString() || '',
      minimum_payment: debt.minimum_payment?.toString() || '',
      due_date: debt.due_date?.toString() || '',
      notes: debt.notes || ''
    });
  };

  const handleAddTransaction = async (debtId) => {
    const debt = debts.find(d => d.id === debtId);
    if (!debt || !transactionForm.amount) return;

    const amount = parseFloat(transactionForm.amount);
    const newAmount = transactionForm.type === 'payment' 
      ? debt.current_amount - amount 
      : debt.current_amount + amount;

    await base44.entities.DebtTransaction.create({
      debt_id: debtId,
      type: transactionForm.type,
      amount,
      date: transactionForm.date,
      notes: transactionForm.notes,
      household_id: householdId
    });

    await base44.entities.Debt.update(debtId, { current_amount: Math.max(0, newAmount) });

    setTransactionForm({ type: 'payment', amount: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
    setShowAddTransaction(null);
    refresh();
  };

  const getDebtTransactions = (debtId) => transactions.filter(t => t.debt_id === debtId);

  const calculatePayoffTime = (debt) => {
    if (!debt.minimum_payment || debt.minimum_payment <= 0) return null;
    const months = Math.ceil(debt.current_amount / debt.minimum_payment);
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (years > 0) {
      return `${years}y ${remainingMonths}m`;
    }
    return `${months}m`;
  };

  const totalDebt = debts.reduce((sum, d) => sum + (d.current_amount || 0), 0);
  const totalOriginal = debts.reduce((sum, d) => sum + (d.original_amount || 0), 0);
  const paidOff = totalOriginal - totalDebt;

  return (
    <Card className={`border-0 shadow-md ${theme.cardBg}`}>
      <CardHeader className={`${theme.cardHeader} text-white rounded-t-lg py-3`}>
        <CardTitle className="text-base font-semibold flex items-center justify-between">
          <span className="flex items-center">
            <CreditCard className="h-4 w-4 mr-2" />
            DEBT TRACKER
            <TutorialHint 
              text="Track your debts and see how payments reduce your balance over time."
              showTutorial={showTutorial}
            />
          </span>
          <div className="flex gap-1">
            <Button 
              size="sm" 
              variant="ghost" 
              className={`h-7 text-white ${theme.primaryHover}`}
              onClick={() => setShowImport(true)}
            >
              <Upload className="h-4 w-4 mr-1" /> Import
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
        <div className={`grid grid-cols-12 gap-2 px-4 py-2 ${theme.headerBg} text-xs font-medium ${theme.textMuted} uppercase`}>
          <div className="col-span-4">Name</div>
          <div className="col-span-2">Original</div>
          <div className="col-span-2">Current</div>
          <div className="col-span-2">Progress</div>
          <div className="col-span-2"></div>
        </div>

        <div className={`${theme.divider} divide-y`}>
          {debts.map((debt) => {
            const progress = ((debt.original_amount - debt.current_amount) / debt.original_amount) * 100;
            const debtTxns = getDebtTransactions(debt.id);
            const isExpanded = expandedId === debt.id;

            return (
              <div key={debt.id}>
                <div className={`grid grid-cols-12 gap-2 px-4 py-2.5 items-center ${theme.hoverBg}`}>
                  {editingId === debt.id ? (
                    <>
                      <div className="col-span-4">
                        <Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="h-8 text-sm" />
                      </div>
                      <div className="col-span-2">
                        <Input type="number" value={form.original_amount} onChange={(e) => setForm({...form, original_amount: e.target.value})} className="h-8 text-sm" />
                      </div>
                      <div className="col-span-2">
                        <Input type="number" value={form.current_amount} onChange={(e) => setForm({...form, current_amount: e.target.value})} className="h-8 text-sm" />
                      </div>
                      <div className="col-span-2"></div>
                      <div className="col-span-2 flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleUpdate(debt.id)}>
                          <Check className="h-3 w-3 text-green-600" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingId(null)}>
                          <X className="h-3 w-3 text-red-600" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={`col-span-4 text-sm ${theme.text} flex items-center gap-1`}>
                        <button onClick={() => setExpandedId(isExpanded ? null : debt.id)}>
                          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </button>
                        {debt.name}
                      </div>
                      <div className={`col-span-2 text-sm ${theme.textMuted}`}>R {debt.original_amount?.toLocaleString()}</div>
                      <div className={`col-span-2 text-sm font-medium ${theme.text}`}>R {debt.current_amount?.toLocaleString()}</div>
                      <div className="col-span-2">
                        <Progress value={progress} className="h-2" />
                        <span className="text-xs text-slate-500">{progress.toFixed(0)}%</span>
                      </div>
                      <div className="col-span-2 flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setShowAddTransaction(debt.id)}>
                          <TrendingDown className="h-3 w-3 text-green-600" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(debt)}>
                          <Edit2 className="h-3 w-3 text-slate-400" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDelete(debt.id)}>
                          <Trash2 className="h-3 w-3 text-red-400" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className={`px-4 py-3 ${theme.headerBg} border-t ${theme.border}`}>
                    <div className="grid grid-cols-4 gap-4 text-xs mb-3">
                      <div>
                        <span className={theme.textMuted}>Interest Rate</span>
                        <p className={`font-medium ${theme.text}`}>{debt.interest_rate || 0}%</p>
                      </div>
                      <div>
                        <span className={theme.textMuted}>Min Payment</span>
                        <p className={`font-medium ${theme.text}`}>R {debt.minimum_payment?.toLocaleString() || 0}</p>
                      </div>
                      <div>
                        <span className={theme.textMuted}>Due Day</span>
                        <p className={`font-medium ${theme.text}`}>{debt.due_date || '-'}th</p>
                      </div>
                      <div>
                        <span className={theme.textMuted}>Est. Payoff</span>
                        <p className={`font-medium ${theme.text}`}>{calculatePayoffTime(debt) || '-'}</p>
                      </div>
                    </div>
                    
                    {debtTxns.length > 0 && (
                      <div>
                        <p className={`text-xs ${theme.textMuted} mb-2`}>Recent Transactions</p>
                        <div className="space-y-1">
                          {debtTxns.slice(0, 5).map(txn => (
                            <div key={txn.id} className={`flex justify-between text-xs ${theme.text}`}>
                              <span>{txn.date} - {txn.type === 'payment' ? 'Payment' : 'Charge'}</span>
                              <span className={txn.type === 'payment' ? 'text-green-600' : 'text-red-600'}>
                                {txn.type === 'payment' ? '-' : '+'}R {txn.amount?.toLocaleString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Add Transaction Modal */}
                {showAddTransaction === debt.id && (
                  <div className={`px-4 py-3 ${theme.headerBg} border-t ${theme.border}`}>
                    <p className={`text-sm font-medium ${theme.text} mb-2`}>Record Transaction</p>
                    <div className="grid grid-cols-4 gap-2">
                      <select 
                        value={transactionForm.type}
                        onChange={(e) => setTransactionForm({...transactionForm, type: e.target.value})}
                        className="h-8 text-sm border rounded px-2"
                      >
                        <option value="payment">Payment</option>
                        <option value="charge">New Charge</option>
                      </select>
                      <Input 
                        type="number"
                        placeholder="Amount"
                        value={transactionForm.amount}
                        onChange={(e) => setTransactionForm({...transactionForm, amount: e.target.value})}
                        className="h-8 text-sm"
                      />
                      <Input 
                        type="date"
                        value={transactionForm.date}
                        onChange={(e) => setTransactionForm({...transactionForm, date: e.target.value})}
                        className="h-8 text-sm"
                      />
                      <div className="flex gap-1">
                        <Button size="sm" onClick={() => handleAddTransaction(debt.id)}>Save</Button>
                        <Button size="sm" variant="outline" onClick={() => setShowAddTransaction(null)}>Cancel</Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {isAdding && (
            <div className={`grid grid-cols-12 gap-2 px-4 py-2.5 items-center bg-green-50`}>
              <div className="col-span-4">
                <Input placeholder="Debt name" value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="h-8 text-sm" />
              </div>
              <div className="col-span-2">
                <Input type="number" placeholder="Original" value={form.original_amount} onChange={(e) => setForm({...form, original_amount: e.target.value})} className="h-8 text-sm" />
              </div>
              <div className="col-span-2">
                <Input type="number" placeholder="Current" value={form.current_amount} onChange={(e) => setForm({...form, current_amount: e.target.value})} className="h-8 text-sm" />
              </div>
              <div className="col-span-2"></div>
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
        </div>

        <div className={`grid grid-cols-12 gap-2 px-4 py-3 ${theme.cardFooter} text-white rounded-b-lg`}>
          <div className="col-span-4 font-semibold text-sm">TOTAL DEBT</div>
          <div className="col-span-2 text-sm text-green-400">Paid: R {paidOff.toLocaleString()}</div>
          <div className="col-span-6 text-right font-bold">Remaining: R {totalDebt.toLocaleString()}</div>
        </div>
      </CardContent>

      <CSVImportDialog
        open={showImport}
        onClose={() => setShowImport(false)}
        entityType="Debt"
        householdId={householdId}
        onSuccess={refresh}
        fieldMappings={CSV_FIELD_MAPPINGS}
      />
    </Card>
  );
}