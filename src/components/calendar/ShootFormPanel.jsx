import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DEFAULT_OFFSETS = { setup_offset: -150, pre_shoot_offset: -120, attention_offset: -30, sound_offset: -30 };
export const emptyForm = { title: '', client: '', location: '', date: '', game_time: '', status: 'upcoming', description: '', ...DEFAULT_OFFSETS };

export default function ShootFormPanel({ form, setForm, editingShoot, onSave, onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full z-50 flex flex-col bg-slate-900 border-l border-blue-800 shadow-2xl w-full md:w-[480px] lg:w-[540px]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 flex-shrink-0">
          <h2 className="text-base font-semibold text-slate-100">{editingShoot ? 'Edit Shoot' : 'New Shoot'}</h2>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500 hover:text-slate-100" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="grid grid-cols-1 gap-3">
            <Input placeholder="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="bg-slate-800 border-slate-800 text-slate-100 placeholder:text-slate-500" />
            <Input placeholder="Client / Team" value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} className="bg-slate-800 border-slate-800 text-slate-100 placeholder:text-slate-500" />
            <Input placeholder="Venue / Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="bg-slate-800 border-slate-800 text-slate-100 placeholder:text-slate-500" />
            <div className="grid grid-cols-2 gap-3">
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="bg-slate-800 border-slate-800 text-slate-100" />
              <input type="time" value={form.game_time} onChange={e => setForm({ ...form, game_time: e.target.value })} className="bg-slate-800 border border-slate-800 text-slate-100 rounded-md px-3 py-2 h-9 text-sm w-full" />
            </div>
            <Select value={form.status || 'upcoming'} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger className="bg-slate-800 border-slate-800 text-slate-100">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800">
                {['upcoming', 'confirmed', 'in_progress', 'completed', 'cancelled'].map((s) => (
                  <SelectItem key={s} value={s} className="text-slate-100 capitalize">{s.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Notes / Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="bg-slate-800 border-slate-800 text-slate-100 placeholder:text-slate-500" />
          </div>

          <div className="bg-slate-800/60 rounded-lg p-3">
            <p className="text-xs text-slate-400 mb-2 font-medium">Schedule Offsets (minutes before game time)</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: 'setup_offset', label: 'Setup' },
                { key: 'pre_shoot_offset', label: 'Pre-Shoot' },
                { key: 'attention_offset', label: 'Attention' },
                { key: 'sound_offset', label: 'Sound' },
              ].map(({ key, label }) => (
                <div key={key}>
                  <label className="text-xs text-slate-500 block mb-1">{label}</label>
                  <Input type="number" value={form[key]} onChange={e => setForm({ ...form, [key]: Number(e.target.value) })} className="bg-slate-700 border-slate-700 text-slate-100 h-8 text-sm" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-slate-800 flex-shrink-0">
          <Button onClick={onSave} className="bg-blue-600 hover:bg-blue-500 flex-1">{editingShoot ? 'Save Changes' : 'Create Shoot'}</Button>
          <Button variant="outline" onClick={onClose} className="border-slate-800 text-slate-400 hover:bg-slate-800">Cancel</Button>
        </div>
      </div>
    </>
  );
}