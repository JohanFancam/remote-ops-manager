import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Plus, Trash2, Edit2, Check, X, Target } from "lucide-react";
import { base44 } from '@/api/base44Client';
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function HouseholdGoalsSection({ goals, onRefresh }) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ 
    name: '', 
    target_amount: '', 
    amount_saved: '', 
    notes: '',
    priority: 'medium'
  });
  
  const handleAdd = async () => {
    if (!form.name || !form.target_amount) return;
    await base44.entities.HouseholdGoal.create({
      name: form.name,
      target_amount: parseFloat(form.target_amount),
      amount_saved: parseFloat(form.amount_saved) || 0,
      notes: form.notes,
      priority: form.priority,
      is_completed: false
    });
    setForm({ name: '', target_amount: '', amount_saved: '', notes: '', priority: 'medium' });
    setIsAdding(false);
    onRefresh();
  };
  
  const handleUpdate = async (id) => {
    await base44.entities.HouseholdGoal.update(id, {
      name: form.name,
      target_amount: parseFloat(form.target_amount),
      amount_saved: parseFloat(form.amount_saved) || 0,
      notes: form.notes,
      priority: form.priority
    });
    setEditingId(null);
    setForm({ name: '', target_amount: '', amount_saved: '', notes: '', priority: 'medium' });
    onRefresh();
  };
  
  const toggleCompleted = async (goal) => {
    await base44.entities.HouseholdGoal.update(goal.id, { is_completed: !goal.is_completed });
    onRefresh();
  };
  
  const handleDelete = async (id) => {
    await base44.entities.HouseholdGoal.delete(id);
    onRefresh();
  };
  
  const startEdit = (goal) => {
    setEditingId(goal.id);
    setForm({
      name: goal.name,
      target_amount: goal.target_amount?.toString() || '',
      amount_saved: goal.amount_saved?.toString() || '0',
      notes: goal.notes || '',
      priority: goal.priority || 'medium'
    });
  };
  
  const activeGoals = goals.filter(g => !g.is_completed);
  const completedGoals = goals.filter(g => g.is_completed);
  const totalTarget = activeGoals.reduce((sum, g) => sum + (g.target_amount || 0), 0);
  const totalSaved = activeGoals.reduce((sum, g) => sum + (g.amount_saved || 0), 0);
  
  const priorityColors = {
    high: 'text-red-600 bg-red-50',
    medium: 'text-amber-600 bg-amber-50',
    low: 'text-blue-600 bg-blue-50'
  };
  
  return (
    <Card className="border-0 shadow-md">
      <CardHeader className="bg-slate-800 text-white rounded-t-lg py-3">
        <CardTitle className="text-base font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            HOUSEHOLD GOALS
          </span>
          <Button 
            size="sm" 
            variant="ghost" 
            className="h-7 text-white hover:bg-slate-700"
            onClick={() => setIsAdding(true)}
          >
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-slate-100 text-xs font-medium text-slate-600 uppercase">
          <div className="col-span-1"></div>
          <div className="col-span-3">Goal</div>
          <div className="col-span-2">Target</div>
          <div className="col-span-2">Saved</div>
          <div className="col-span-3">Progress</div>
          <div className="col-span-1"></div>
        </div>
        
        <div className="divide-y divide-slate-100">
          {activeGoals.map((goal) => {
            const progress = goal.target_amount > 0 
              ? Math.min(100, (goal.amount_saved / goal.target_amount) * 100) 
              : 0;
            const remaining = (goal.target_amount || 0) - (goal.amount_saved || 0);
            
            return (
              <div key={goal.id} className="grid grid-cols-12 gap-2 px-4 py-3 items-center hover:bg-slate-50">
                {editingId === goal.id ? (
                  <>
                    <div className="col-span-1">
                      <Select value={form.priority} onValueChange={(v) => setForm({...form, priority: v})}>
                        <SelectTrigger className="h-8 w-full text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Med</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-3">
                      <Input 
                        value={form.name} 
                        onChange={(e) => setForm({...form, name: e.target.value})}
                        className="h-8 text-sm"
                        placeholder="Goal name"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input 
                        type="number"
                        value={form.target_amount} 
                        onChange={(e) => setForm({...form, target_amount: e.target.value})}
                        className="h-8 text-sm"
                        placeholder="Target"
                      />
                    </div>
                    <div className="col-span-2">
                      <Input 
                        type="number"
                        value={form.amount_saved} 
                        onChange={(e) => setForm({...form, amount_saved: e.target.value})}
                        className="h-8 text-sm"
                        placeholder="Saved"
                      />
                    </div>
                    <div className="col-span-3">
                      <Input 
                        value={form.notes} 
                        onChange={(e) => setForm({...form, notes: e.target.value})}
                        className="h-8 text-sm"
                        placeholder="Notes"
                      />
                    </div>
                    <div className="col-span-1 flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleUpdate(goal.id)}>
                        <Check className="h-3 w-3 text-green-600" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingId(null)}>
                        <X className="h-3 w-3 text-red-600" />
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="col-span-1 flex justify-center">
                      <Checkbox 
                        checked={goal.is_completed}
                        onCheckedChange={() => toggleCompleted(goal)}
                      />
                    </div>
                    <div className="col-span-3">
                      <div className="text-sm font-medium">{goal.name}</div>
                      {goal.notes && <div className="text-xs text-slate-500">{goal.notes}</div>}
                      <span className={cn("text-xs px-1.5 py-0.5 rounded mt-1 inline-block", priorityColors[goal.priority])}>
                        {goal.priority}
                      </span>
                    </div>
                    <div className="col-span-2 text-sm">R {goal.target_amount?.toLocaleString()}</div>
                    <div className="col-span-2 text-sm font-medium text-green-600">
                      R {goal.amount_saved?.toLocaleString()}
                    </div>
                    <div className="col-span-3">
                      <Progress value={progress} className="h-2" />
                      <div className="text-xs text-slate-500 mt-1">
                        {remaining > 0 ? `R ${remaining.toLocaleString()} to go` : 'Ready!'}
                      </div>
                    </div>
                    <div className="col-span-1 flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(goal)}>
                        <Edit2 className="h-3 w-3 text-slate-400" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDelete(goal.id)}>
                        <Trash2 className="h-3 w-3 text-red-400" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
          
          {isAdding && (
            <div className="grid grid-cols-12 gap-2 px-4 py-3 items-center bg-purple-50">
              <div className="col-span-1">
                <Select value={form.priority} onValueChange={(v) => setForm({...form, priority: v})}>
                  <SelectTrigger className="h-8 w-full text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Med</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-3">
                <Input 
                  placeholder="Goal name"
                  value={form.name} 
                  onChange={(e) => setForm({...form, name: e.target.value})}
                  className="h-8 text-sm"
                />
              </div>
              <div className="col-span-2">
                <Input 
                  type="number"
                  placeholder="Target"
                  value={form.target_amount} 
                  onChange={(e) => setForm({...form, target_amount: e.target.value})}
                  className="h-8 text-sm"
                />
              </div>
              <div className="col-span-2">
                <Input 
                  type="number"
                  placeholder="Saved"
                  value={form.amount_saved} 
                  onChange={(e) => setForm({...form, amount_saved: e.target.value})}
                  className="h-8 text-sm"
                />
              </div>
              <div className="col-span-3">
                <Input 
                  placeholder="Notes (optional)"
                  value={form.notes} 
                  onChange={(e) => setForm({...form, notes: e.target.value})}
                  className="h-8 text-sm"
                />
              </div>
              <div className="col-span-1 flex gap-1 justify-end">
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleAdd}>
                  <Check className="h-3 w-3 text-green-600" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setIsAdding(false)}>
                  <X className="h-3 w-3 text-red-600" />
                </Button>
              </div>
            </div>
          )}
          
          {completedGoals.length > 0 && (
            <>
              <div className="px-4 py-2 bg-green-50 text-xs font-medium text-green-700 uppercase">
                Completed Goals ({completedGoals.length})
              </div>
              {completedGoals.map((goal) => (
                <div key={goal.id} className="grid grid-cols-12 gap-2 px-4 py-2 items-center bg-green-50/50 opacity-70">
                  <div className="col-span-1 flex justify-center">
                    <Checkbox 
                      checked={goal.is_completed}
                      onCheckedChange={() => toggleCompleted(goal)}
                    />
                  </div>
                  <div className="col-span-4 text-sm line-through text-slate-500">{goal.name}</div>
                  <div className="col-span-2 text-sm text-slate-500">R {goal.target_amount?.toLocaleString()}</div>
                  <div className="col-span-4 text-sm text-green-600">✓ Achieved</div>
                  <div className="col-span-1 flex justify-end">
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => handleDelete(goal.id)}>
                      <Trash2 className="h-3 w-3 text-red-400" />
                    </Button>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
        
        <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-slate-800 text-white rounded-b-lg">
          <div className="col-span-4 font-semibold text-sm">TOTAL GOALS</div>
          <div className="col-span-2 text-sm">R {totalTarget.toLocaleString()}</div>
          <div className="col-span-2 text-sm text-green-400">R {totalSaved.toLocaleString()}</div>
          <div className="col-span-4 text-right font-bold text-sm">
            R {(totalTarget - totalSaved).toLocaleString()} to go
          </div>
        </div>
      </CardContent>
    </Card>
  );
}