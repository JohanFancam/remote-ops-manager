import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Clock, Check, Trash2, DollarSign } from 'lucide-react';
import { format } from 'date-fns';

const statusColors = {
  pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  approved: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  paid: 'bg-green-500/20 text-green-400 border-green-500/30',
};

const emptyForm = { date: '', hours: '', rate: '', notes: '' };

export default function Timesheets() {
  const { user, isAdmin } = useApp();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedShootId, setSelectedShootId] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterOperator, setFilterOperator] = useState('all');

  const { data: entries = [] } = useQuery({
    queryKey: ['timeEntries'],
    queryFn: () => base44.entities.TimeEntry.list('-date', 200),
  });

  const { data: shoots = [] } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list('-date', 100),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['timeEntries'] });

  const handleAdd = async () => {
    if (!form.date || !form.hours) return;
    const hours = parseFloat(form.hours);
    const rate = parseFloat(form.rate) || 0;
    await base44.entities.TimeEntry.create({
      ...form,
      operator_email: user.email,
      operator_name: user.full_name,
      shoot_id: selectedShootId || null,
      hours,
      rate,
      total: hours * rate,
    });
    setForm(emptyForm);
    setSelectedShootId('');
    setIsAdding(false);
    refresh();
  };

  const updateStatus = async (id, status) => {
    await base44.entities.TimeEntry.update(id, { status });
    refresh();
  };

  const handleDelete = async (id) => {
    await base44.entities.TimeEntry.delete(id);
    refresh();
  };

  let filtered = isAdmin ? entries : entries.filter(e => e.operator_email === user?.email);
  if (filterStatus !== 'all') filtered = filtered.filter(e => e.status === filterStatus);
  if (isAdmin && filterOperator !== 'all') filtered = filtered.filter(e => e.operator_email === filterOperator);

  const operators = [...new Set(entries.map(e => e.operator_email).filter(Boolean))];
  const totalPending = filtered.filter(e => e.status === 'pending').reduce((s, e) => s + (e.total || 0), 0);
  const totalPaid = filtered.filter(e => e.status === 'paid').reduce((s, e) => s + (e.total || 0), 0);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Timesheets</h1>
          {!isAdmin && (
            <Button onClick={() => setIsAdding(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" /> Log Time
            </Button>
          )}
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-5">
              <p className="text-gray-400 text-sm">Pending Approval</p>
              <p className="text-2xl font-bold text-yellow-400 mt-1">R {totalPending.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-5">
              <p className="text-gray-400 text-sm">Total Paid</p>
              <p className="text-2xl font-bold text-green-400 mt-1">R {totalPaid.toLocaleString()}</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-5">
              <p className="text-gray-400 text-sm">Total Hours</p>
              <p className="text-2xl font-bold text-white mt-1">{filtered.reduce((s, e) => s + (e.hours || 0), 0).toFixed(1)}h</p>
            </CardContent>
          </Card>
        </div>

        {/* Add form */}
        {!isAdmin && isAdding && (
          <Card className="bg-gray-900 border-blue-700 mb-6">
            <CardHeader className="border-b border-gray-800 py-3">
              <CardTitle className="text-white text-base">Log Time Entry</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="bg-gray-800 border-gray-700 text-white" />
                <Input placeholder="Hours worked" type="number" value={form.hours} onChange={e => setForm({...form, hours: e.target.value})} className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
                <Input placeholder="Rate (R per hour)" type="number" value={form.rate} onChange={e => setForm({...form, rate: e.target.value})} className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
                <Select value={selectedShootId} onValueChange={setSelectedShootId}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                    <SelectValue placeholder="Link to Shoot (optional)" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    <SelectItem value={null} className="text-gray-400">No Shoot Linked</SelectItem>
                    {shoots.filter(s => s.assigned_operators?.includes(user?.email)).map(s => (
                      <SelectItem key={s.id} value={s.id} className="text-white">{s.title} — {format(new Date(s.date), 'MMM d')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input placeholder="Notes (optional)" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 md:col-span-2" />
              </div>
              <div className="flex gap-2 mt-4">
                <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700">Submit</Button>
                <Button variant="outline" onClick={() => setIsAdding(false)} className="border-gray-700 text-gray-300 hover:bg-gray-800">Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <div className="flex gap-3 mb-4">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36 bg-gray-900 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              <SelectItem value="all" className="text-white">All Status</SelectItem>
              {['pending','approved','paid'].map(s => <SelectItem key={s} value={s} className="text-white capitalize">{s}</SelectItem>)}
            </SelectContent>
          </Select>
          {isAdmin && (
            <Select value={filterOperator} onValueChange={setFilterOperator}>
              <SelectTrigger className="w-48 bg-gray-900 border-gray-700 text-white">
                <SelectValue placeholder="All Operators" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700">
                <SelectItem value="all" className="text-white">All Operators</SelectItem>
                {operators.map(o => <SelectItem key={o} value={o} className="text-white">{o}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Entries */}
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-0">
            <div className="divide-y divide-gray-800">
              {filtered.length === 0 ? (
                <p className="text-gray-500 text-sm p-8 text-center">No time entries found.</p>
              ) : (
                filtered.map(entry => {
                  const linkedShoot = shoots.find(s => s.id === entry.shoot_id);
                  return (
                    <div key={entry.id} className="p-4 flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <span className="font-medium text-white">{entry.operator_name || entry.operator_email}</span>
                        </div>
                        <p className="text-sm text-gray-400">{format(new Date(entry.date), 'EEE, MMM d yyyy')} · {entry.hours}h {entry.rate > 0 && `@ R${entry.rate}/h`}</p>
                        {linkedShoot && <p className="text-xs text-blue-400 mt-0.5">📸 {linkedShoot.title}</p>}
                        {entry.notes && <p className="text-xs text-gray-500 mt-0.5">{entry.notes}</p>}
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="font-bold text-white">R {(entry.total || 0).toLocaleString()}</p>
                          <Badge className={`text-xs border ${statusColors[entry.status]}`}>{entry.status}</Badge>
                        </div>
                        {isAdmin && (
                          <div className="flex flex-col gap-1">
                            {entry.status === 'pending' && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-green-400 hover:bg-gray-800" onClick={() => updateStatus(entry.id, 'approved')}>Approve</Button>
                            )}
                            {entry.status === 'approved' && (
                              <Button size="sm" variant="ghost" className="h-7 text-xs text-blue-400 hover:bg-gray-800" onClick={() => updateStatus(entry.id, 'paid')}>Mark Paid</Button>
                            )}
                            <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-600 hover:text-red-400 hover:bg-gray-800" onClick={() => handleDelete(entry.id)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}