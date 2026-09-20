import React, { useState } from 'react';
import { X, UserMinus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const EXCLUDED_EMAILS = ['hano@fancam.com', 'matthew.swart@fancam.com', 'mattswartuk@gmail.com'];

export default function AssignOperatorModal({
  shoot,
  allUsers,
  pendingUsers = [],
  onConfirm,
  onUnassign,
  onApprove,
  onDecline,
  onClose,
}) {
  const userMap = new Map((allUsers || []).map(u => [u.email?.toLowerCase(), u]));
  const [busyKey, setBusyKey] = useState(null);

  const isAssignableRole = (role) => role === 'user' || role === 'standby';

  // Remote operators and Operator / Standby — not admins or accounts
  const assignableUsers = (pendingUsers.length > 0 ? pendingUsers : allUsers)
    .filter(u => u && typeof u.email === 'string' && u.email.trim() !== '')
    .filter(u => !EXCLUDED_EMAILS.includes(u.email.trim().toLowerCase()))
    .filter(u => !u.inactive)
    .filter(u => {
      const live = userMap.get(u.email.trim().toLowerCase());
      return isAssignableRole(live?.role || u.role);
    })
    .filter(u => {
      const email = u.email.trim().toLowerCase();
      return !shoot.assigned_operators?.includes(email) && !shoot.pending_operators?.includes(email)
        && !shoot.assigned_operators?.includes(u.email) && !shoot.pending_operators?.includes(u.email);
    })
    .map(u => {
      const live = userMap.get(u.email.trim().toLowerCase());
      const role = live?.role || u.role;
      return {
        email: u.email.trim().toLowerCase(),
        full_name: live?.full_name || u.full_name || u.email,
        role,
      };
    })
    .sort((a, b) => (a.full_name || '').localeCompare(b.full_name || ''));

  const assignedRemoteUsers = (shoot.assigned_operators || [])
    .slice(0, 1)
    .map(email => {
      const u = userMap.get(email.toLowerCase()) || allUsers.find(x => x.email === email);
      return { email, full_name: u?.full_name || email, role: u?.role };
    })
    .filter(Boolean);
  const hasAssignee = assignedRemoteUsers.length > 0;

  // Pending remote operators
  const pendingRemoteUsers = (shoot.pending_operators || [])
    .map(email => {
      const u = userMap.get(email.toLowerCase()) || allUsers.find(x => x.email === email);
      return { email, full_name: u?.full_name || email };
    });

  const [selectedEmail, setSelectedEmail] = useState('');

  const runAction = async (key, fn) => {
    setBusyKey(key);
    try {
      await fn();
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-sm mx-4">
        <div className="flex items-center justify-between p-4 border-b border-slate-800">
          <div>
            <h2 className="text-base font-semibold text-slate-100">Manage Operators</h2>
            <p className="text-xs text-slate-500 mt-0.5">{shoot?.title}</p>
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500 hover:text-slate-100" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Currently assigned */}
          {assignedRemoteUsers.length > 0 && (
            <div>
              <p className="text-xs text-slate-400 font-medium mb-2">Assigned Operator</p>
              <div className="space-y-1">
                {assignedRemoteUsers.map(u => (
                  <div key={u.email} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2">
                    <span className="text-sm text-slate-100">{u.full_name}</span>
                    <button
                      onClick={() => { onUnassign?.(u.email, 'assigned'); }}
                      className="text-red-400 hover:text-red-400 transition-colors"
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
              <p className="text-xs text-amber-400 font-medium mb-2">Pending Approval</p>
              <div className="space-y-1">
                {pendingRemoteUsers.map(u => {
                  const approveKey = `approve_${u.email}`;
                  const declineKey = `decline_${u.email}`;
                  return (
                    <div key={u.email} className="flex items-center justify-between gap-2 bg-amber-950/40 border border-amber-800 rounded-lg px-3 py-2">
                      <span className="text-sm text-yellow-200 min-w-0 truncate">{u.full_name}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          disabled={busyKey === approveKey}
                          onClick={() => runAction(approveKey, () => onApprove?.(u.email))}
                          className="h-7 text-xs bg-green-700 hover:bg-green-600 gap-1 px-2"
                        >
                          <Check className="h-3 w-3" />
                          {busyKey === approveKey ? '…' : 'Approve'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          disabled={busyKey === declineKey}
                          onClick={() => runAction(declineKey, () => onDecline?.(u.email))}
                          className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/40 gap-1 px-2"
                        >
                          <X className="h-3 w-3" />
                          {busyKey === declineKey ? '…' : 'Decline'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Assign new */}
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block font-medium">
              {hasAssignee ? 'Replace Operator' : 'Assign Operator'}
            </label>
            <select
              value={selectedEmail}
              onChange={e => setSelectedEmail(e.target.value)}
              className="w-full bg-slate-800 border border-slate-800 text-slate-100 rounded-md px-3 py-2 text-sm h-9"
            >
              <option value="">Select operator…</option>
              {assignableUsers.map(u => (
                <option key={u.email} value={u.email}>
                  {u.full_name}{u.role === 'standby' ? ' (Operator / Standby)' : ''}
                </option>
              ))}
            </select>
            {assignableUsers.length === 0 && (
              <p className="text-xs text-slate-500 mt-1">No other operators available.</p>
            )}
            {hasAssignee && assignableUsers.length > 0 && (
              <p className="text-xs text-slate-500 mt-1">Assigning someone else replaces the current operator.</p>
            )}
          </div>
        </div>

        <div className="flex gap-2 p-4 border-t border-slate-800">
          <Button
            onClick={() => { if (selectedEmail) { onConfirm(selectedEmail); setSelectedEmail(''); } }}
            disabled={!selectedEmail}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white"
          >
            {hasAssignee ? 'Replace' : 'Assign'}
          </Button>
          <Button variant="outline" onClick={onClose} className="border-slate-800 text-slate-400 hover:bg-slate-800">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
