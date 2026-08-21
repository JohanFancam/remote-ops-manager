import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Camera, MapPin, Calendar, Clock, Users, Trash2, Edit2, X, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { format, isAfter } from 'date-fns';

const STATUSES = ['upcoming', 'confirmed', 'in_progress', 'completed', 'cancelled'];
const statusColors = {
  upcoming: 'bg-blue-600/20 text-blue-400 border-blue-800',
  confirmed: 'bg-green-500/20 text-emerald-400 border-green-500/30',
  in_progress: 'bg-yellow-500/20 text-amber-400 border-yellow-500/30',
  completed: 'bg-gray-500/20 text-slate-400 border-gray-500/30',
  cancelled: 'bg-red-950/400/20 text-red-400 border-red-800',
};

const emptyForm = { title: '', client: '', location: '', date: '', start_time: '', end_time: '', status: 'upcoming', description: '', rate: '', rate_type: 'day_rate', notes: '' };

export default function Shoots() {
  const { user, isAdmin } = useApp();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [statusFilter, setStatusFilter] = useState('all');

  const { data: shoots = [] } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list('-date', 200),
  });

  const { data: rigs = [] } = useQuery({
    queryKey: ['rigs'],
    queryFn: () => base44.entities.Rig.list(),
    enabled: isAdmin,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['shoots'] });

  const handleAdd = async () => {
    if (!form.title || !form.date) return;
    await base44.entities.Shoot.create({ ...form, rate: parseFloat(form.rate) || 0 });
    setForm(emptyForm);
    setIsAdding(false);
    refresh();
  };

  const handleUpdate = async () => {
    await base44.entities.Shoot.update(editingId, { ...form, rate: parseFloat(form.rate) || 0 });
    setEditingId(null);
    setForm(emptyForm);
    refresh();
  };

  const handleDelete = async (id) => {
    await base44.entities.Shoot.delete(id);
    refresh();
  };

  const startEdit = (shoot) => {
    setEditingId(shoot.id);
    setForm({ ...emptyForm, ...shoot, rate: shoot.rate?.toString() || '' });
    setExpandedId(null);
  };

  const toggleAssign = async (shoot) => {
    const current = shoot.assigned_operators || [];
    const updated = current.includes(user?.email)
      ? current.filter(e => e !== user?.email)
      : [...current, user?.email];
    await base44.entities.Shoot.update(shoot.id, { assigned_operators: updated });
    refresh();
  };

  const today = new Date();
  let filtered = statusFilter === 'all' ? shoots : shoots.filter(s => s.status === statusFilter);
  if (!isAdmin) {
    filtered = filtered.filter(s => s.assigned_operators?.includes(user?.email) || s.status === 'upcoming');
  }

  const grouped = filtered.reduce((acc, s) => {
    const key = isAfter(new Date(s.date), today) || s.date === format(today, 'yyyy-MM-dd') ? 'Upcoming' : 'Past';
    (acc[key] = acc[key] || []).push(s);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-800 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Shoots</h1>
          <div className="flex items-center gap-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36 bg-slate-900 border-slate-800 text-slate-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800">
                <SelectItem value="all" className="text-slate-100">All Status</SelectItem>
                {STATUSES.map(s => <SelectItem key={s} value={s} className="text-slate-100 capitalize">{s.replace('_', ' ')}</SelectItem>)}
              </SelectContent>
            </Select>
            {isAdmin && (
              <Button onClick={() => setIsAdding(true)} className="bg-blue-600 hover:bg-blue-500">
                <Plus className="h-4 w-4 mr-2" /> New Shoot
              </Button>
            )}
          </div>
        </div>

        {/* Add Form */}
        {isAdmin && isAdding && (
          <Card className="bg-slate-900 border-blue-500 mb-6">
            <CardHeader className="border-b border-slate-800 py-3">
              <CardTitle className="text-slate-100 text-base">New Shoot</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <ShootForm form={form} setForm={setForm} rigs={rigs} />
              <div className="flex gap-2 mt-4">
                <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-500">Create Shoot</Button>
                <Button variant="outline" onClick={() => { setIsAdding(false); setForm(emptyForm); }} className="border-slate-800 text-slate-400 hover:bg-slate-800">Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Shoots List */}
        {['Upcoming', 'Past'].map(group => {
          const groupShoots = (grouped[group] || []).sort((a, b) => group === 'Upcoming' ? new Date(a.date) - new Date(b.date) : new Date(b.date) - new Date(a.date));
          if (!groupShoots.length) return null;
          return (
            <div key={group} className="mb-8">
              <h2 className="text-lg font-semibold text-slate-400 mb-3">{group}</h2>
              <div className="space-y-3">
                {groupShoots.map(shoot => (
                  <Card key={shoot.id} className="bg-slate-900 border-slate-800 hover:border-slate-800 transition-colors">
                    {editingId === shoot.id ? (
                      <CardContent className="pt-4">
                        <ShootForm form={form} setForm={setForm} rigs={rigs} />
                        <div className="flex gap-2 mt-4">
                          <Button onClick={handleUpdate} size="sm" className="bg-green-700 hover:bg-green-600">Save</Button>
                          <Button onClick={() => { setEditingId(null); setForm(emptyForm); }} size="sm" variant="outline" className="border-slate-800 text-slate-400 hover:bg-slate-800">Cancel</Button>
                        </div>
                      </CardContent>
                    ) : (
                      <CardContent className="p-0">
                        <div
                          className="p-4 cursor-pointer"
                          onClick={() => setExpandedId(expandedId === shoot.id ? null : shoot.id)}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-start gap-3">
                              {expandedId === shoot.id ? <ChevronDown className="h-4 w-4 text-slate-500 mt-1" /> : <ChevronRight className="h-4 w-4 text-slate-500 mt-1" />}
                              <div>
                                <p className="font-semibold text-slate-100">{shoot.title}</p>
                                <div className="flex flex-wrap gap-3 mt-1">
                                  {shoot.client && <span className="text-sm text-slate-400">{shoot.client}</span>}
                                  {shoot.location && <span className="text-sm text-slate-500 flex items-center gap-1"><MapPin className="h-3 w-3" />{shoot.location}</span>}
                                  <span className="text-sm text-slate-500 flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(shoot.date), 'EEE, MMM d yyyy')}</span>
                                  {shoot.start_time && <span className="text-sm text-slate-500 flex items-center gap-1"><Clock className="h-3 w-3" />{shoot.start_time}{shoot.end_time && ` – ${shoot.end_time}`}</span>}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={`text-xs border ${statusColors[shoot.status]}`}>{shoot.status}</Badge>
                              {isAdmin && (
                                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500 hover:text-slate-100 hover:bg-slate-800" onClick={() => startEdit(shoot)}>
                                    <Edit2 className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500 hover:text-red-400 hover:bg-slate-800" onClick={() => handleDelete(shoot.id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {expandedId === shoot.id && (
                          <div className="px-4 pb-4 border-t border-slate-800 pt-3">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-3">
                              <div>
                                <p className="text-xs text-slate-500 mb-0.5">Rate</p>
                                <p className="text-sm text-slate-100">{shoot.rate ? `R ${shoot.rate} (${shoot.rate_type?.replace('_', ' ')})` : '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-slate-500 mb-0.5">Operators</p>
                                <p className="text-sm text-slate-100">{shoot.assigned_operators?.length || 0} assigned</p>
                              </div>
                              {shoot.description && (
                                <div className="col-span-2">
                                  <p className="text-xs text-slate-500 mb-0.5">Brief</p>
                                  <p className="text-sm text-slate-400">{shoot.description}</p>
                                </div>
                              )}
                            </div>
                            {shoot.assigned_operators?.length > 0 && (
                              <div className="mb-3">
                                <p className="text-xs text-slate-500 mb-1">Assigned Operators</p>
                                <div className="flex flex-wrap gap-2">
                                  {shoot.assigned_operators.map(email => (
                                    <span key={email} className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded-full">{email}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {!isAdmin && (
                              <Button
                                size="sm"
                                onClick={() => toggleAssign(shoot)}
                                className={shoot.assigned_operators?.includes(user?.email)
                                  ? 'border border-red-700 text-red-400 bg-transparent hover:bg-red-900/30'
                                  : 'bg-blue-600 hover:bg-blue-500 text-white'
                                }
                              >
                                {shoot.assigned_operators?.includes(user?.email) ? 'Unassign Myself' : 'Assign Myself'}
                              </Button>
                            )}
                          </div>
                        )}
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-20 text-slate-500">
            <Camera className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No shoots found.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ShootForm({ form, setForm, rigs }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Input placeholder="Shoot Title *" value={form.title} onChange={e => setForm({...form, title: e.target.value})} className="bg-slate-800 border-slate-800 text-slate-100 placeholder:text-slate-500" />
      <Input placeholder="Client" value={form.client} onChange={e => setForm({...form, client: e.target.value})} className="bg-slate-800 border-slate-800 text-slate-100 placeholder:text-slate-500" />
      <Input placeholder="Location" value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="bg-slate-800 border-slate-800 text-slate-100 placeholder:text-slate-500" />
      <Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="bg-slate-800 border-slate-800 text-slate-100" />
      <Input placeholder="Start Time (e.g. 08:00)" value={form.start_time} onChange={e => setForm({...form, start_time: e.target.value})} className="bg-slate-800 border-slate-800 text-slate-100 placeholder:text-slate-500" />
      <Input placeholder="End Time (e.g. 17:00)" value={form.end_time} onChange={e => setForm({...form, end_time: e.target.value})} className="bg-slate-800 border-slate-800 text-slate-100 placeholder:text-slate-500" />
      <Input placeholder="Rate (e.g. 1500)" type="number" value={form.rate} onChange={e => setForm({...form, rate: e.target.value})} className="bg-slate-800 border-slate-800 text-slate-100 placeholder:text-slate-500" />
      <Select value={form.rate_type} onValueChange={v => setForm({...form, rate_type: v})}>
        <SelectTrigger className="bg-slate-800 border-slate-800 text-slate-100"><SelectValue /></SelectTrigger>
        <SelectContent className="bg-slate-900 border-slate-800">
          <SelectItem value="hourly" className="text-slate-100">Hourly</SelectItem>
          <SelectItem value="day_rate" className="text-slate-100">Day Rate</SelectItem>
          <SelectItem value="fixed" className="text-slate-100">Fixed</SelectItem>
        </SelectContent>
      </Select>
      <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
        <SelectTrigger className="bg-slate-800 border-slate-800 text-slate-100"><SelectValue /></SelectTrigger>
        <SelectContent className="bg-slate-900 border-slate-800">
          {['upcoming','confirmed','in_progress','completed','cancelled'].map(s => (
            <SelectItem key={s} value={s} className="text-slate-100 capitalize">{s.replace('_', ' ')}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input placeholder="Description / Brief" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="bg-slate-800 border-slate-800 text-slate-100 placeholder:text-slate-500 md:col-span-2" />
    </div>
  );
}