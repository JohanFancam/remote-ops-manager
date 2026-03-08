import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Wrench, Edit2, Trash2, AlertCircle } from 'lucide-react';

const statusColors = {
  available: 'bg-green-500/20 text-green-400 border-green-500/30',
  in_use: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  maintenance: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  retired: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
};

const emptyForm = { name: '', type: '', serial_number: '', status: 'available', description: '', last_service_date: '', next_service_date: '', notes: '' };

export default function Rigs() {
  const { isAdmin } = useApp();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const { data: rigs = [] } = useQuery({
    queryKey: ['rigs'],
    queryFn: () => base44.entities.Rig.list(),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['rigs'] });

  const handleAdd = async () => {
    if (!form.name || !form.type) return;
    await base44.entities.Rig.create(form);
    setForm(emptyForm); setIsAdding(false); refresh();
  };

  const handleUpdate = async () => {
    await base44.entities.Rig.update(editingId, form);
    setEditingId(null); setForm(emptyForm); refresh();
  };

  const handleDelete = async (id) => {
    await base44.entities.Rig.delete(id); refresh();
  };

  const startEdit = (rig) => {
    setEditingId(rig.id);
    setForm({ ...emptyForm, ...rig });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Rig Settings</h1>
          {isAdmin && (
            <Button onClick={() => setIsAdding(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" /> Add Rig
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {['available','in_use','maintenance','retired'].map(status => (
            <Card key={status} className="bg-gray-900 border-gray-800">
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-bold text-white">{rigs.filter(r => r.status === status).length}</p>
                <p className="text-xs text-gray-400 capitalize mt-1">{status.replace('_', ' ')}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {isAdmin && isAdding && (
          <Card className="bg-gray-900 border-blue-700 mb-6">
            <CardHeader className="border-b border-gray-800 py-3">
              <CardTitle className="text-white text-base">Add New Rig</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <RigForm form={form} setForm={setForm} />
              <div className="flex gap-2 mt-4">
                <Button onClick={handleAdd} className="bg-blue-600 hover:bg-blue-700">Add Rig</Button>
                <Button variant="outline" onClick={() => { setIsAdding(false); setForm(emptyForm); }} className="border-gray-700 text-gray-300 hover:bg-gray-800">Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rigs.map(rig => (
            <Card key={rig.id} className="bg-gray-900 border-gray-800">
              {editingId === rig.id ? (
                <CardContent className="pt-4">
                  <RigForm form={form} setForm={setForm} />
                  <div className="flex gap-2 mt-4">
                    <Button onClick={handleUpdate} size="sm" className="bg-green-700 hover:bg-green-600">Save</Button>
                    <Button onClick={() => { setEditingId(null); setForm(emptyForm); }} size="sm" variant="outline" className="border-gray-700 text-gray-300">Cancel</Button>
                  </div>
                </CardContent>
              ) : (
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-9 h-9 bg-gray-800 rounded-lg flex items-center justify-center">
                        <Wrench className="h-5 w-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="font-semibold text-white">{rig.name}</p>
                        <p className="text-xs text-gray-400">{rig.type}</p>
                      </div>
                    </div>
                    <Badge className={`text-xs border ${statusColors[rig.status]}`}>{rig.status?.replace('_', ' ')}</Badge>
                  </div>
                  {rig.serial_number && <p className="text-xs text-gray-500 mb-2">S/N: {rig.serial_number}</p>}
                  {rig.description && <p className="text-sm text-gray-400 mb-3">{rig.description}</p>}
                  {rig.next_service_date && (
                    <div className="flex items-center gap-1 mb-3">
                      <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
                      <p className="text-xs text-yellow-500">Service due: {rig.next_service_date}</p>
                    </div>
                  )}
                  {isAdmin && (
                    <div className="flex gap-2 pt-3 border-t border-gray-800">
                      <Button size="sm" variant="ghost" onClick={() => startEdit(rig)} className="text-gray-400 hover:text-white hover:bg-gray-800">
                        <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(rig.id)} className="text-gray-500 hover:text-red-400 hover:bg-gray-800">
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
                      </Button>
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>

        {rigs.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <Wrench className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>No rigs configured yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RigForm({ form, setForm }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <Input placeholder="Rig Name *" value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
      <Input placeholder="Type (e.g. Drone, Camera) *" value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
      <Input placeholder="Serial Number" value={form.serial_number} onChange={e => setForm({...form, serial_number: e.target.value})} className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
      <Select value={form.status} onValueChange={v => setForm({...form, status: v})}>
        <SelectTrigger className="bg-gray-800 border-gray-700 text-white"><SelectValue /></SelectTrigger>
        <SelectContent className="bg-gray-900 border-gray-700">
          {['available','in_use','maintenance','retired'].map(s => (
            <SelectItem key={s} value={s} className="text-white capitalize">{s.replace('_', ' ')}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input placeholder="Description" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 md:col-span-2" />
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Last Service</label>
        <Input type="date" value={form.last_service_date} onChange={e => setForm({...form, last_service_date: e.target.value})} className="bg-gray-800 border-gray-700 text-white" />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-1 block">Next Service</label>
        <Input type="date" value={form.next_service_date} onChange={e => setForm({...form, next_service_date: e.target.value})} className="bg-gray-800 border-gray-700 text-white" />
      </div>
    </div>
  );
}