import React from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SHOOT_STATUSES, formatStatusLabel, normalizeShootStatus } from '@/utils/shootStatus';
import { LiveDataToggle } from '@/components/shoots/LiveDataControls';

export const emptyForm = { title: '', client: '', date: '', game_time: '', status: 'upcoming', description: '', live_data: false };

export default function ShootFormPanel({ form, setForm, editingShoot, onSave, onClose }) {
  const statusValue = normalizeShootStatus(form.status);
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
            <p className="text-[11px] text-slate-500">Location and schedule offsets come from the matching Rig setting for this team.</p>
            <div className="grid grid-cols-2 gap-3">
              <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="bg-slate-800 border-slate-800 text-slate-100" />
              <input type="time" value={form.game_time} onChange={e => setForm({ ...form, game_time: e.target.value })} className="bg-slate-800 border border-slate-800 text-slate-100 rounded-md px-3 py-2 h-9 text-sm w-full" />
            </div>
            <Select value={statusValue} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger className="bg-slate-800 border-slate-800 text-slate-100">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 border-slate-800">
                {SHOOT_STATUSES.map((s) => (
                  <SelectItem key={s} value={s} className="text-slate-100">{formatStatusLabel(s)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <LiveDataToggle
              checked={!!form.live_data}
              onChange={(next) => setForm({ ...form, live_data: next })}
            />
            <Input placeholder="Notes / Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="bg-slate-800 border-slate-800 text-slate-100 placeholder:text-slate-500" />
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