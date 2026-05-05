import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDisplayName } from '../utils/nameUtils';

const EXCLUDED_EMAILS = ['hano@fancam.com'];

export default function AssignOperatorModal({ shoot, allUsers, onConfirm, onClose }) {
  const assignableUsers = (allUsers || [])
    .filter(u => u && typeof u.email === 'string' && u.email.trim() !== '')
    .filter(u => !EXCLUDED_EMAILS.includes(u.email.trim().toLowerCase()))
    .filter(u => !shoot.assigned_operators?.includes(u.email) && !shoot.pending_operators?.includes(u.email));

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
                  {getDisplayName(u, u.email)} {u.role ? `(${u.role})` : ''}
                </option>
              ))}
            </select>
          </div>
          {assignableUsers.length === 0 && (
            <p className="text-xs text-gray-500">All users are already assigned.</p>
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