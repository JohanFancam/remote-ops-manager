import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Edit2, Check, X, ShoppingCart } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';

export default function PurchasesSection({ purchases, categories, selectedMonth, householdId, onRefresh }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ 
    description: '', 
    category: '', 
    amount: '', 
    date: format(new Date(), 'yyyy-MM-dd'),
    store: '' 
  });
  
  const totalSpent = purchases.reduce((sum, p) => sum + (p.amount || 0), 0);
  
  const handleAdd = async () => {
    if (!form.description || !form.amount || !form.category) return;
    await base44.entities.Purchase.create({
      ...form,
      amount: parseFloat(form.amount),
      month: selectedMonth,
      household_id: householdId
    });
    setForm({ description: '', category: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'), store: '' });
    setIsAdding(false);
    onRefresh();
  };
  
  const handleUpdate = async (id) => {
    await base44.entities.Purchase.update(id, {
      ...form,
      amount: parseFloat(form.amount)
    });
    setEditingId(null);
    setForm({ description: '', category: '', amount: '', date: format(new Date(), 'yyyy-MM-dd'), store: '' });
    onRefresh();
  };
  
  const handleDelete = async (id) => {
    await base44.entities.Purchase.delete(id);
    onRefresh();
  };
  
  const startEdit = (purchase) => {
    setEditingId(purchase.id);
    setForm({
      description: purchase.description || '',
      category: purchase.category || '',
      amount: purchase.amount?.toString() || '',
      date: purchase.date || format(new Date(), 'yyyy-MM-dd'),
      store: purchase.store || ''
    });
  };
  
  const categoryNames = categories.map(c => c.name);
  
  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="bg-purple-700 text-white rounded-t-lg py-3">
        <CardTitle className="text-base font-semibold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            <span>PURCHASES</span>
          </div>
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-7 text-white hover:bg-purple-600"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-100 text-xs font-medium text-slate-600 uppercase">
          <div className="col-span-3">Description</div>
          <div className="col-span-2">Category</div>
          <div className="col-span-2">Store</div>
          <div className="col-span-2">Date</div>
          <div className="col-span-2 text-right">Amount</div>
          <div className="col-span-1"></div>
        </div>
        
        <div className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
          {purchases.map((purchase) => (
            <div key={purchase.id} className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center hover:bg-slate-50">
              {editingId === purchase.id ? (
                <>
                  <div className="col-span-3">
                    <Input 
                      value={form.description} 
                      onChange={(e) => setForm({...form, description: e.target.value})}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <Select value={form.category} onValueChange={(v) => setForm({...form, category: v})}>
                      <SelectTrigger className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categoryNames.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <Input 
                      value={form.store} 
                      onChange={(e) => setForm({...form, store: e.target.value})}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input 
                      type="date"
                      value={form.date} 
                      onChange={(e) => setForm({...form, date: e.target.value})}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <Input 
                      type="number"
                      value={form.amount} 
                      onChange={(e) => setForm({...form, amount: e.target.value})}
                      className="h-8 text-sm text-right"
                    />
                  </div>
                  <div className="col-span-1 flex gap-1">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleUpdate(purchase.id)}>
                      <Check className="h-3 w-3 text-green-600" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingId(null)}>
                      <X className="h-3 w-3 text-red-600" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="col-span-3 text-sm truncate">{purchase.description}</div>
                  <div className="col-span-2 text-sm text-slate-500 truncate">{purchase.category}</div>
                  <div className="col-span-2 text-sm text-slate-500 truncate">{purchase.store || '-'}</div>
                  <div className="col-span-2 text-sm text-slate-500">{purchase.date || '-'}</div>
                  <div className="col-span-2 text-sm text-right font-medium">R {purchase.amount?.toLocaleString()}</div>
                  <div className="col-span-1 flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(purchase)}>
                      <Edit2 className="h-3 w-3 text-slate-400" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDelete(purchase.id)}>
                      <Trash2 className="h-3 w-3 text-red-400" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
          
          {isAdding && (
            <div className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center bg-purple-50">
              <div className="col-span-3">
                <Input 
                  placeholder="What did you buy?"
                  value={form.description} 
                  onChange={(e) => setForm({...form, description: e.target.value})}
                  className="h-8 text-sm"
                />
              </div>
              <div className="col-span-2">
                <Select value={form.category} onValueChange={(v) => setForm({...form, category: v})}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryNames.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2">
                <Input 
                  placeholder="Store"
                  value={form.store} 
                  onChange={(e) => setForm({...form, store: e.target.value})}
                  className="h-8 text-sm"
                />
              </div>
              <div className="col-span-2">
                <Input 
                  type="date"
                  value={form.date} 
                  onChange={(e) => setForm({...form, date: e.target.value})}
                  className="h-8 text-sm"
                />
              </div>
              <div className="col-span-2">
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
          
          {purchases.length === 0 && !isAdding && (
            <div className="px-4 py-8 text-center text-slate-400 text-sm">
              No purchases recorded yet
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-purple-700 text-white rounded-b-lg">
          <div className="col-span-8 font-semibold text-sm">TOTAL SPENT</div>
          <div className="col-span-4 text-right font-bold">R {totalSpent.toLocaleString()}</div>
        </div>
      </CardContent>
    </Card>
  );
}