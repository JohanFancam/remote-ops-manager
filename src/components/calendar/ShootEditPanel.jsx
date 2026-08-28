import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { X } from 'lucide-react';

export default function ShootEditPanel({
  shoot,
  form,
  setForm,
  onSave,
  onCancel,
  onClose,
}) {
  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full bg-gray-900 border-l border-gray-800 p-0 [&_button[type='button']]:text-white overflow-y-auto transition-all duration-300">
        <SheetHeader className="px-4 py-3 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-base text-white">{shoot ? 'Edit Shoot' : 'New Shoot'}</SheetTitle>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-white" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </SheetHeader>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 mt-4">
          <div className="space-y-4">
            {/* Title */}
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Title *</label>
              <Input
                placeholder="Shoot title"
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
              />
            </div>

            {/* Client & Location */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Client / Team</label>
                <Input
                  placeholder="Client"
                  value={form.client}
                  onChange={e => setForm({ ...form, client: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Location</label>
                <Input
                  placeholder="Venue / Location"
                  value={form.location}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                />
              </div>
            </div>

            {/* Date & Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Date *</label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Game Time</label>
                <input
                  type="time"
                  value={form.game_time}
                  onChange={e => setForm({ ...form, game_time: e.target.value })}
                  className="bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2 h-9 text-sm w-full"
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Status</label>
              <Select value={form.status || 'upcoming'} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  {['upcoming', 'completed', 'cancelled'].map((s) => (
                    <SelectItem key={s} value={s} className="text-white capitalize">{s.replace('_', ' ')}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cancellation reason + earning override — only when status is cancelled */}
            {form.status === 'cancelled' && (
              <div className="space-y-3 rounded-lg border border-gray-700 bg-gray-800/40 p-3">
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Cancellation reason *</label>
                  <Input
                    placeholder="Short reason for cancelling this shoot"
                    value={form.cancellation_reason || ''}
                    onChange={e => setForm({ ...form, cancellation_reason: e.target.value })}
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Earning override (ZAR)</label>
                  <Input
                    type="number"
                    placeholder="Leave blank — operator earns R0"
                    value={form.earning_override ?? ''}
                    onChange={e => setForm({ ...form, earning_override: e.target.value === '' ? null : Number(e.target.value) })}
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                  />
                </div>
                {form.earning_override != null && form.earning_override !== '' && (
                  <div>
                    <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Override reason *</label>
                    <Input
                      placeholder="Why is the operator being paid?"
                      value={form.earning_override_reason || ''}
                      onChange={e => setForm({ ...form, earning_override_reason: e.target.value })}
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Description */}
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Description</label>
              <textarea
                placeholder="Notes and description"
                value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2 text-sm placeholder:text-gray-500 h-20"
              />
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-800 p-4 flex-shrink-0 flex gap-2 sticky bottom-0 bg-gray-900 z-10">
          <Button
            onClick={() => {
              if (form.status === 'cancelled' && !(form.cancellation_reason || '').trim()) {
                alert('Please provide a short reason for cancelling this shoot.');
                return;
              }
              if (form.status === 'cancelled' && form.earning_override != null && form.earning_override !== '' && !(form.earning_override_reason || '').trim()) {
                alert('Please provide a reason for the earning override.');
                return;
              }
              onSave();
            }}
            className="flex-1 bg-blue-600 hover:bg-blue-700">
            {shoot ? 'Save Changes' : 'Create Shoot'}
          </Button>
          <Button onClick={onCancel} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800">
            Cancel
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}