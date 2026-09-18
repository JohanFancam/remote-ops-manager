import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';

const EXCLUDED_EMAILS = ['hano@fancam.com', 'matthew.swart@fancam.com', 'mattswartuk@gmail.com'];

export default function AssignOperatorModal({ shoot, allUsers, pendingUsers = [], onConfirm, onUnassign, onClose }) {
  const userMap = new Map((allUsers || []).map(u => [u.email?.toLowerCase(), u]));

  // Only remote operators (role === 'user'), not admins/standby
  const assignableUsers = (pendingUsers.length > 0 ? pendingUsers : allUsers)
    .filter(u => u && typeof u.email === 'string' && u.email.trim() !== '')
    .filter(u => !EXCLUDED_EMAILS.includes(u.email.trim().toLowerCase()))
    .filter(u => !u.inactive)
    .filter(u => ['user', 'standby', 'operator_standby'].includes(u.role))
    .filter(u => {
      const email = u.email.trim().toLowerCase();
      return !shoot.assigned_operators?.includes(email) && !shoot.pending_operators?.includes(email)
        && !shoot.assigned_operators?.includes(u.email) && !shoot.pending_operators?.includes(u.email);
    })
    .map(u => {
      const live = userMap.get(u.email.trim().toLowerCase());
      return {
        email: u.email.trim().toLowerCase(),
        full_name: live?.full_name || u.full_name || u.email,
      };
    })
    .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

  // Currently assigned remote operators
  const assignedRemoteUsers = (shoot.assigned_operators || [])
    .map(email => {
      const u = userMap.get(email.toLowerCase()) || allUsers.find(x => x.email === email);
      if (!u || u.role === 'admin') return null;
      return { email, full_name: u?.full_name || email };
    })
    .filter(Boolean);

  // Pending remote operators
  const pendingRemoteUsers = (shoot.pending_operators || [])
    .map(email => {
      const u = userMap.get(email.toLowerCase()) || allUsers.find(x => x.email === email);
      return { email, full_name: u?.full_name || email };
    });

  const [selectedEmail, setSelectedEmail] = useState('');

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-sm mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <div>
            <h2 className="text-base font-semibold text-white">Manage Operators</h2>
            <p className="text-xs text-gray-500 mt-0.5">{shoot?.title}</p>
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-white" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Currently assigned */}
          {assignedRemoteUsers.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 font-medium mb-2">Assigned Operators</p>
              <div className="space-y-1">
                {assignedRemoteUsers.map(u => (
                  <div key={u.email} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
                    <span className="text-sm text-white">{u.full_name}</span>
                    <button
                      onClick={() => { onUnassign?.(u.email, 'assigned'); }}
                      className="text-red-400 hover:text-red-300 transition-colors"
                      title="Unassign"
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Pending operators */}
          {pendingRemoteUsers.length > 0 && (
            <div>
              <p className="text-xs text-yellow-400 font-medium mb-2">Pending Approval</p>
              <div className="space-y-1">
                {pendingRemoteUsers.map(u => (
                  <div key={u.email} className="flex items-center justify-between bg-yellow-950/30 border border-yellow-800/40 rounded-lg px-3 py-2">
                    <span className="text-sm text-yellow-200">{u.full_name}</span>
                    <button
                      onClick={() => { onUnassign?.(u.email, 'pending'); }}
                      className="text-red-400 hover:text-red-300 transition-colors"
                      title="Remove pending"
                    >
                      <UserMinus className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Assign new */}
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block font-medium">Assign Operator</label>
            <select
              value={selectedEmail}
              onChange={e => setSelectedEmail(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2 text-sm h-9"
            >
              <option value="">Select operator…</option>
              {assignableUsers.map(u => (
                <option key={u.email} value={u.email}>{u.full_name}</option>
              ))}
            </select>
            {assignableUsers.length === 0 && (
              <p className="text-xs text-gray-500 mt-1">All operators are already assigned.</p>
            )}
          </div>
        </div>

        <div className="flex gap-2 p-4 border-t border-gray-800">
          <Button
            onClick={() => { if (selectedEmail) { onConfirm(selectedEmail); setSelectedEmail(''); } }}
            disabled={!selectedEmail}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
          >
            Assign
          </Button>
          <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300 hover:bg-gray-800">
            Done
          </Button>
        </div>
      </div>
    </div>,
    document.body
  );
}