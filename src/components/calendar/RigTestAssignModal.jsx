import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

const FALLBACK_CHECKLIST = [
  'Power on all rigs and confirm boot',
  'Check network / remote connectivity',
  'Verify camera feeds (HD + Wide)',
  'Test audio / sound recording',
  'Confirm rig type settings match team profile',
  'Review storage / SD cards',
  'Check battery levels',
];

export default function RigTestAssignModal({ shoot, user, allUsers, onConfirm, onClose }) {
  const assignableUsers = (allUsers || []).filter(u => u.role === 'admin' || u.role === 'standby');

  const [assignedTo, setAssignedTo] = useState(user?.email || '');
  const [scheduledDate, setScheduledDate] = useState(shoot?.date || '');
  const [dueDate, setDueDate] = useState('');

  // Load checklist from AppSettings
  const { data: appSettings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const settingsChecklist = (() => {
    const val = appSettings.find(s => s.key === 'rig_test_checklist')?.value;
    if (!val) return null;
    try { return JSON.parse(val); } catch { return null; }
  })();

  const checklistItems = settingsChecklist || FALLBACK_CHECKLIST;

  const assignedUser = assignableUsers.find(u => u.email === assignedTo);
  const assignedName = assignedUser?.full_name || assignedUser?.email || assignedTo;

  const handleConfirm = () => {
    onConfirm({
      title: `Rig Test – ${shoot?.title || 'Shoot'}`,
      scheduled_date: scheduledDate,
      due_date: dueDate || undefined,
      assigned_to: assignedTo,
      assigned_name: assignedName,
      status: 'pending',
      checklist: checklistItems.map(item => ({ item, checked: false })),
      notes: `Assigned from calendar for shoot: ${shoot?.title} on ${shoot?.date}`,
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="bg-white border border-zinc-200 rounded-2xl shadow-2xl w-full max-w-sm mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200">
          <div>
            <h2 className="text-base font-semibold text-zinc-900">Assign Rig Test</h2>
            <p className="text-xs text-zinc-400 mt-0.5">{shoot?.title}</p>
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-zinc-400 hover:text-zinc-900" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {/* Assignee */}
          <div>
            <label className="text-xs text-zinc-500 mb-1.5 block font-medium">Assign To</label>
            <select
              value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
              className="w-full bg-zinc-100 border border-zinc-200 text-zinc-900 rounded-md px-3 py-2 text-sm h-9"
            >
              <option value="">Select person…</option>
              {assignableUsers.map(u => (
                <option key={u.email} value={u.email}>
                  {u.full_name || u.email} ({u.role})
                </option>
              ))}
            </select>
          </div>

          {/* Scheduled Date */}
          <div>
            <label className="text-xs text-zinc-500 mb-1.5 block font-medium">Scheduled Date</label>
            <Input
              type="date"
              value={scheduledDate}
              onChange={e => setScheduledDate(e.target.value)}
              className="bg-zinc-100 border-zinc-200 text-zinc-900"
            />
          </div>

          {/* Due Date */}
          <div>
            <label className="text-xs text-zinc-500 mb-1.5 block font-medium">Due Date <span className="text-gray-600">(optional)</span></label>
            <Input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="bg-zinc-100 border-zinc-200 text-zinc-900"
            />
          </div>

          {/* Checklist preview */}
          <div>
            <p className="text-xs text-zinc-400 mb-1">
              Checklist: <span className="text-zinc-500">{checklistItems.length} items</span>
              <span className="ml-2 text-gray-600">(managed in Settings → Rig Test Checklist)</span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-zinc-200">
          <Button onClick={handleConfirm} disabled={!assignedTo || !scheduledDate} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white">
            Create Rig Test
          </Button>
          <Button variant="outline" onClick={onClose} className="border-zinc-200 text-zinc-600 hover:bg-zinc-100">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}