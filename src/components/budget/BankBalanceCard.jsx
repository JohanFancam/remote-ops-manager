import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Wallet, Edit2, Check, X, Plus } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import TutorialHint from './TutorialHint';

export default function BankBalanceCard({ balance, selectedMonth, householdId, onRefresh, showTutorial }) {
  const [isEditing, setIsEditing] = useState(false);
  const [form, setForm] = useState({
    amount: balance?.amount?.toString() || '',
    date: balance?.date || format(new Date(), 'yyyy-MM-dd'),
    note: balance?.note || ''
  });
  
  const handleSave = async () => {
    if (!form.amount) return;
    
    if (balance) {
      await base44.entities.BankBalance.update(balance.id, {
        amount: parseFloat(form.amount),
        date: form.date,
        note: form.note
      });
    } else {
      await base44.entities.BankBalance.create({
        amount: parseFloat(form.amount),
        date: form.date,
        note: form.note,
        month: selectedMonth,
        household_id: householdId
      });
    }
    setIsEditing(false);
    onRefresh();
  };
  
  return (
    <Card className="border-0 shadow-md bg-gradient-to-r from-emerald-500 to-teal-600">
      <CardHeader className="pb-2">
        <CardTitle className="text-white text-base font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            <span>Bank Balance</span>
            <TutorialHint 
              text="Enter your starting bank balance for the month. This helps you track how much money you actually have available."
              showTutorial={showTutorial}
            />
          </div>
          {!isEditing && (
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-7 text-white hover:bg-white/20"
              onClick={() => {
                setForm({
                  amount: balance?.amount?.toString() || '',
                  date: balance?.date || format(new Date(), 'yyyy-MM-dd'),
                  note: balance?.note || ''
                });
                setIsEditing(true);
              }}
            >
              {balance ? <Edit2 className="h-4 w-4" /> : <><Plus className="h-4 w-4 mr-1" /> Add</>}
            </Button>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isEditing ? (
          <div className="space-y-3">
            <div>
              <label className="text-xs text-white/80 mb-1 block">Amount</label>
              <Input
                type="number"
                placeholder="Enter balance"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="bg-white/20 border-white/30 text-white placeholder:text-white/50"
              />
            </div>
            <div>
              <label className="text-xs text-white/80 mb-1 block">Date</label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="bg-white/20 border-white/30 text-white"
              />
            </div>
            <div>
              <label className="text-xs text-white/80 mb-1 block">Note (optional)</label>
              <Input
                placeholder="e.g., After salary"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className="bg-white/20 border-white/30 text-white placeholder:text-white/50"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" className="text-white hover:bg-white/20" onClick={() => setIsEditing(false)}>
                <X className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" className="text-white hover:bg-white/20" onClick={handleSave}>
                <Check className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="text-3xl font-bold text-white">
              {balance ? `R ${balance.amount?.toLocaleString()}` : 'Not set'}
            </div>
            {balance?.note && (
              <p className="text-sm text-white/80 mt-1">{balance.note}</p>
            )}
            {balance?.date && (
              <p className="text-xs text-white/60 mt-1">
                as of {format(new Date(balance.date), 'dd MMM yyyy')}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}