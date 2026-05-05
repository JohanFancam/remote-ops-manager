import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DEFAULT_CHECKLIST = [
  'Camera connections checked',
  'Rig power on and stable',
  'Remote access confirmed',
  'Test footage captured',
  'Rig settings verified',
];

export default function RigTestAssignModal({ shoot, user, allUsers, onConfirm, onClose }) {
  const assignableUsers = (allUsers || []).filter(u => u.role === 'admin' || u.role === 'standby');

  const [assignedTo, setAssignedTo] = useState(user?.email || '');
  const [scheduledDate, setScheduledDate] = useState(shoot?.date || '');
  const [checklistItems, setChecklistItems] = useState([...DEFAULT_CHECKLIST]);
  const [newItem, setNewItem] = useState('');

  const assignedUser = assignableUsers.find(u => u.email === assignedTo);
  const assignedName = assignedUser?.full_name || assignedUser?.email || assignedTo;

  const handleAddItem = () => {
    if (newItem.trim()) {
      setChecklistItems(prev => [...prev, newItem.trim()]);
      setNewItem('');
    }
  };

  const handleRemoveItem = (idx) => {
    setChecklistItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleConfirm = () => {
    onConfirm({
      title: `Rig Test – ${shoot?.title || 'Shoot'}`,
      scheduled_date: scheduledDate,
      assigned_to: assignedTo,
      assigned_name: assignedName,
      status: 'pending',
      checklist: checklistItems.map(item => ({ item, checked: false })),
      notes: `Assigned from calendar for shoot: ${shoot?.title} on ${shoot?.date}`,
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div>
            <h2 className="text-base font-semibold text-white">Assign Rig Test</h2>
            <p className="text-xs text-gray-500 mt-0.5">{shoot?.title}</p>
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-white" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {/* Assignee */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block font-medium">Assign To</label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="Select person" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700">
                {assignableUsers.map(u => (
                  <SelectItem key={u.email} value={u.email} className="text-white">
                    {u.full_name || u.email}
                    <span className="ml-1.5 text-xs text-gray-500 capitalize">({u.role})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block font-medium">Scheduled Date</label>
            <Input
              type="date"
              value={scheduledDate}
              onChange={e => setScheduledDate(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white"
            />
          </div>

          {/* Checklist */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block font-medium">Checklist Items</label>
            <div className="space-y-1.5 mb-2">
              {checklistItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-gray-800/60 rounded-lg px-3 py-1.5">
                  <span className="text-xs text-gray-300 flex-1">{item}</span>
                  <button
                    onClick={() => handleRemoveItem(idx)}
                    className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newItem}
                onChange={e => setNewItem(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddItem(); } }}
                placeholder="Add checklist item…"
                className="bg-gray-800 border-gray-700 text-white text-xs h-8 placeholder:text-gray-500"
              />
              <Button size="sm" variant="outline" className="h-8 border-gray-700 text-gray-300 hover:bg-gray-800 px-2" onClick={handleAddItem}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-4 border-t border-gray-800">
          <Button onClick={handleConfirm} className="flex-1 bg-teal-600 hover:bg-teal-700 text-white">
            Create Rig Test
          </Button>
          <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300 hover:bg-gray-800">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}