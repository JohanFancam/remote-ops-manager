import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const EXCLUDED_EMAILS = ['hano@fancam.com', 'matthew.swart@fancam.com', 'mattswartuk@gmail.com'];

export default function AssignOperatorModal({ shoot, allUsers, pendingUsers = [], onConfirm, onClose }) {
  // Build a unified list from pendingUsers (source of truth) enriched with live User data
  const userMap = new Map((allUsers || []).map(u => [u.email?.toLowerCase(), u]));

  const assignableUsers = pendingUsers
    .filter(pu => pu && typeof pu.email === 'string' && pu.email.trim() !== '')
    .filter(pu => !EXCLUDED_EMAILS.includes(pu.email.trim().toLowerCase()))
    .filter(pu => !pu.inactive)
    .filter(pu => pu.role !== 'admin')
    .filter(pu => {
      const email = pu.email.trim().toLowerCase();
      return !shoot.assigned_operators?.includes(email) && !shoot.pending_operators?.includes(email)
        && !shoot.assigned_operators?.includes(pu.email) && !shoot.pending_operators?.includes(pu.email);
    })
    .map(pu => {
      const live = userMap.get(pu.email.trim().toLowerCase());
      return {
        email: pu.email.trim().toLowerCase(),
        full_name: live?.full_name || pu.full_name || pu.email,
        role: live?.role || pu.role,
      };
    })
    .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

  const [selectedEmail, setSelectedEmail] = useState('');

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div>
            <h2 className="text-base font-semibold text-white">Assign Operator</h2>
            <p className="text-xs text-gray-500 mt-0.5">{shoot?.title}</p>
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-white" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block font-medium">Select Operator</label>
            <select
              value={selectedEmail}
              onChange={e => setSelectedEmail(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2 text-sm h-9"
            >
              <option value="">Select person…</option>
              {assignableUsers.map(u => (
                <option key={u.email} value={u.email}>
                  {u.full_name} {u.role ? `(${u.role === 'user' ? 'Operator' : u.role})` : ''}
                </option>
              ))}
            </select>
          </div>
          {assignableUsers.length === 0 && (
            <p className="text-xs text-gray-500">All users are already assigned or no users have been added yet.</p>
          )}
        </div>

        <div className="flex gap-2 p-4 border-t border-gray-800">
          <Button
            onClick={() => { onConfirm(selectedEmail); onClose(); }}
            disabled={!selectedEmail}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            Assign
          </Button>
          <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300 hover:bg-gray-800">
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}