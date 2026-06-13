import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, Edit2, Save, X, Send, Trash2 } from 'lucide-react';
import { getDisplayName } from '../utils/nameUtils';

const ROLE_OPTIONS = [
  { value: 'user', label: 'Remote Operator' },
  { value: 'standby', label: 'Standby User' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'admin', label: 'Admin' },
];

const roleBadgeClass = {
  admin: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  standby: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  accounts: 'bg-green-500/20 text-green-400 border-green-500/30',
  user: 'bg-gray-700 text-gray-300 border-gray-600',
};
const roleLabel = { admin: 'Admin', standby: 'Standby', accounts: 'Accounts', user: 'Operator' };

function AddUserForm({ onClose, onAdded }) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('user');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async () => {
    if (!firstName.trim() || !email.trim()) { setError('First name and email are required.'); return; }
    setError('');
    setSaving(true);
    const full_name = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
    // Create PendingUser record
    await base44.entities.PendingUser.create({ full_name, email: email.trim().toLowerCase(), role, invited: true });
    // Send invite
    await base44.users.inviteUser(email.trim().toLowerCase(), role);
    setSaving(false);
    setDone(true);
    onAdded();
    setTimeout(() => { setDone(false); onClose(); }, 1500);
  };

  return (
    <div className="border border-gray-700 rounded-lg p-4 bg-gray-800/50 space-y-3 mb-4">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">New User</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-gray-400 block mb-1">First Name <span className="text-red-400">*</span></label>
          <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="e.g. John"
            className="bg-gray-800 border-gray-700 text-white h-8 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Last Name <span className="text-gray-600">(optional)</span></label>
          <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="e.g. Smith"
            className="bg-gray-800 border-gray-700 text-white h-8 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Email <span className="text-red-400">*</span></label>
          <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" type="email"
            className="bg-gray-800 border-gray-700 text-white h-8 text-sm" />
        </div>
        <div>
          <label className="text-xs text-gray-400 block mb-1">Role</label>
          <select value={role} onChange={e => setRole(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-1.5 text-sm h-8 w-full">
            {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={handleAdd} disabled={saving || done}
          className="bg-blue-700 hover:bg-blue-600 gap-2 text-xs h-8">
          <Send className="h-3.5 w-3.5" />
          {done ? '✓ Added & invited!' : saving ? 'Saving...' : 'Add & Send Invite'}
        </Button>
        <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white h-8" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function PendingUserRow({ pu, onRefresh }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: pu.full_name || '', role: pu.role || 'user', inactive: !!pu.inactive });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await base44.entities.PendingUser.update(pu.id, { full_name: form.full_name, role: form.role, inactive: form.inactive });
    setSaving(false);
    setEditing(false);
    onRefresh();
  };

  const handleDelete = async () => {
    await base44.entities.PendingUser.delete(pu.id);
    onRefresh();
  };

  const displayName = pu.full_name || pu.email;

  return (
    <div className="px-5 py-4">
      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 block mb-1">Full Name</label>
              <Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })}
                placeholder="Full name" className="bg-gray-800 border-gray-700 text-white h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">Role</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                className="bg-gray-800 border border-gray-700 text-white rounded-md px-2 py-1.5 text-sm w-full h-8">
                {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
            <input type="checkbox" checked={form.inactive} onChange={e => setForm({ ...form, inactive: e.target.checked })}
              className="w-4 h-4 accent-blue-500" />
            Mark as "Not in use" (hidden from assignments, visible in accounts)
          </label>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-8 gap-1" onClick={handleSave} disabled={saving}>
              <Save className="h-3 w-3" /> {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-gray-400 hover:text-white" onClick={() => setEditing(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 bg-gray-800 rounded-full flex items-center justify-center font-bold text-blue-400 flex-shrink-0 text-sm">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-white truncate">{displayName}</p>
                {pu.inactive && <span className="text-[10px] bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded-full">Not in use</span>}
              </div>
              <p className="text-xs text-gray-400 truncate">{pu.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge className={`text-xs border ${roleBadgeClass[pu.role] || roleBadgeClass.user}`}>
              {roleLabel[pu.role] || pu.role}
            </Badge>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-blue-400 hover:bg-gray-800" onClick={() => setEditing(true)}>
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            {deleteConfirm ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-red-400">Remove?</span>
                <Button size="sm" variant="ghost" className="h-6 text-xs text-red-400 hover:bg-red-900/30" onClick={handleDelete}>Yes</Button>
                <Button size="sm" variant="ghost" className="h-6 text-xs text-gray-400 hover:bg-gray-800" onClick={() => setDeleteConfirm(false)}>No</Button>
              </div>
            ) : (
              <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-600 hover:text-red-400 hover:bg-gray-800" onClick={() => setDeleteConfirm(true)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function ManageUsersSection() {
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);

  const { data: pendingUsers = [] } = useQuery({
    queryKey: ['pendingUsers'],
    queryFn: () => base44.entities.PendingUser.list(),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['pendingUsers'] });

  return (
    <Card className="bg-gray-900 border-gray-800 mb-6">
      <CardHeader className="border-b border-gray-800 pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-400" /> Manage Users ({pendingUsers.length})
          </CardTitle>
          {!showAddForm && (
            <Button size="sm" onClick={() => setShowAddForm(true)}
              className="bg-blue-700 hover:bg-blue-600 gap-1.5 text-xs">
              <UserPlus className="h-3.5 w-3.5" /> Add User
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {showAddForm && (
          <AddUserForm
            onClose={() => setShowAddForm(false)}
            onAdded={refresh}
          />
        )}
        <div className="divide-y divide-gray-800 -mx-6 -mb-6">
          {pendingUsers.length === 0 && <p className="text-gray-500 text-sm p-6 text-center">No users added yet.</p>}
          {pendingUsers.map(pu => (
            <PendingUserRow key={pu.id} pu={pu} onRefresh={refresh} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}