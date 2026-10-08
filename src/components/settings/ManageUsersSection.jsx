import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp, OFFLINE_THRESHOLD } from '@/components/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, Edit2, Save, X, Send, Trash2, KeyRound, Copy, Download, Check, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { appOrigin, buildWelcomeMessage, buildWelcomeList } from '@/utils/welcomeMessage';

const ROLE_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'accounts', label: 'Accounts' },
  { value: 'user', label: 'Remote Operator' },
  { value: 'standby', label: 'Operator / Standby' },
  { value: 'analytics', label: 'Data Analytics' },
  { value: 'viewer', label: 'Viewer' },
];

const roleBadgeClass = {
  admin: 'bg-orange-500/20 text-orange-400 border-orange-800',
  standby: 'bg-yellow-500/20 text-amber-400 border-yellow-500/30',
  accounts: 'bg-green-500/20 text-emerald-400 border-green-500/30',
  analytics: 'bg-cyan-500/20 text-cyan-300 border-cyan-800',
  viewer: 'bg-slate-600/30 text-slate-300 border-slate-600',
  user: 'bg-slate-700 text-slate-400 border-slate-700',
};
const roleLabel = {
  admin: 'Admin',
  accounts: 'Accounts',
  user: 'Remote Operator',
  standby: 'Operator / Standby',
  analytics: 'Data Analytics',
  viewer: 'Viewer',
};

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    return true;
  }
}

function listAsText(issued) {
  const width = Math.max(0, ...issued.map((i) => i.email.length));
  return issued
    .map((item) => `${item.email.padEnd(width)}  ${item.password}`)
    .join('\n');
}

function downloadList(issued) {
  const lines = [
    'Remote Ops Manager passwords',
    `Generated ${new Date().toISOString()}`,
    'Shown once. Passwords are stored hashed — this file is the only copy.',
    '',
    listAsText(issued),
    '',
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `remote-ops-passwords-${new Date().toISOString().slice(0, 10)}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function IssuedPasswords({ issued, skipped, onDismiss }) {
  const [copied, setCopied] = useState('');

  const markCopied = (key) => {
    setCopied(key);
    setTimeout(() => setCopied((current) => (current === key ? '' : current)), 1800);
  };

  const handleCopyAll = async () => {
    await copyText(listAsText(issued));
    markCopied('all');
  };

  const handleCopyOne = async (item) => {
    await copyText(`${item.email}  ${item.password}`);
    markCopied(item.email);
  };

  const handleCopyWelcome = async (item) => {
    await copyText(buildWelcomeMessage(item, appOrigin()));
    markCopied(`welcome:${item.email}`);
    toast.success(`Welcome message copied for ${item.full_name || item.email}`);
  };

  const handleCopyAllWelcomes = async () => {
    await copyText(buildWelcomeList(issued, appOrigin()));
    markCopied('welcomes');
    toast.success('Welcome messages copied');
  };

  return (
    <div className="mb-4 rounded-lg border border-amber-500/40 bg-amber-950/30 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-amber-200">Copy login details now</p>
          <p className="text-xs text-amber-200/70 mt-1">
            Passwords are stored hashed and cannot be shown again after you leave this page.
            Copy welcome copies a message with their username, temp password, app link, and basic instructions.
          </p>
        </div>
        <Button size="sm" variant="ghost" className="h-7 text-slate-400 hover:text-slate-100" onClick={onDismiss}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="overflow-x-auto rounded-md border border-slate-800 bg-slate-950/70">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 border-b border-slate-800">
              <th className="px-3 py-2 font-medium">Email</th>
              <th className="px-3 py-2 font-medium">Password</th>
              <th className="px-3 py-2 font-medium w-24" />
            </tr>
          </thead>
          <tbody>
            {issued.map((item) => (
              <tr key={item.email} className="border-b border-slate-800/80 last:border-0">
                <td className="px-3 py-2 text-slate-200 align-top">
                  <div className="font-medium">{item.full_name || item.email}</div>
                  {item.full_name ? <div className="text-xs text-slate-500">{item.email}</div> : null}
                </td>
                <td className="px-3 py-2 font-mono text-amber-100 tracking-wide align-top">{item.password}</td>
                <td className="px-3 py-2 align-top">
                  <div className="flex items-center gap-1">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-slate-400 hover:text-slate-100"
                      onClick={() => handleCopyOne(item)}
                      title="Copy email and password"
                    >
                      {copied === item.email ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-slate-400 hover:text-blue-300"
                      onClick={() => handleCopyWelcome(item)}
                      title="Copy welcome message"
                    >
                      {copied === `welcome:${item.email}` ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <MessageSquare className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" className="bg-amber-600 hover:bg-amber-500 text-slate-950 h-8 gap-1.5 text-xs" onClick={handleCopyAll}>
          {copied === 'all' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied === 'all' ? 'Copied list' : 'Copy all'}
        </Button>
        <Button
          size="sm"
          className="bg-orange-500 hover:bg-orange-400 h-8 gap-1.5 text-xs"
          onClick={handleCopyAllWelcomes}
        >
          {copied === 'welcomes' ? <Check className="h-3.5 w-3.5" /> : <MessageSquare className="h-3.5 w-3.5" />}
          {copied === 'welcomes' ? 'Copied welcomes' : 'Copy welcome messages'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-slate-700 text-slate-200 hover:bg-slate-800 h-8 gap-1.5 text-xs"
          onClick={() => downloadList(issued)}
        >
          <Download className="h-3.5 w-3.5" /> Download .txt
        </Button>
      </div>
      {skipped?.length > 0 && (
        <p className="text-xs text-slate-500">
          Skipped: {skipped.map((s) => `${s.email} (${s.reason === 'self' ? 'you — still signed in' : s.reason})`).join(', ')}
        </p>
      )}
    </div>
  );
}

function AddUserForm({ onClose, onAdded, onIssued }) {
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
    const cleanEmail = email.trim().toLowerCase();
    try {
      await base44.entities.PendingUser.create({ full_name, email: cleanEmail, role, invited: true });
      await base44.users.inviteUser(cleanEmail, role, full_name);
      const result = await base44.users.resetPasswords({
        emails: [cleanEmail],
        allowCreate: true,
        createFrom: { [cleanEmail]: { full_name, role } },
      });
      if (result.issued?.length) {
        onIssued?.(result);
        const welcome = buildWelcomeMessage(result.issued[0], appOrigin());
        await copyText(welcome);
        toast.success('User added. Welcome message copied — send it to them now.');
      }
      setDone(true);
      onAdded();
      setTimeout(() => { setDone(false); onClose(); }, 800);
    } catch (err) {
      setError(err.message || 'Could not add user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-slate-800 rounded-lg p-4 bg-slate-800/40 space-y-3 mb-4">
      <p className="text-xs text-slate-400 font-medium uppercase tracking-wide">New User</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-400 block mb-1">First Name <span className="text-red-400">*</span></label>
          <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="e.g. John"
            className="bg-slate-800 border-slate-800 text-slate-100 h-8 text-sm" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Last Name <span className="text-gray-600">(optional)</span></label>
          <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="e.g. Smith"
            className="bg-slate-800 border-slate-800 text-slate-100 h-8 text-sm" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Email <span className="text-red-400">*</span></label>
          <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="user@example.com" type="email"
            className="bg-slate-800 border-slate-800 text-slate-100 h-8 text-sm" />
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Role</label>
          <select value={role} onChange={e => setRole(e.target.value)}
            className="bg-slate-800 border border-slate-800 text-slate-100 rounded-md px-3 py-1.5 text-sm h-8 w-full">
            {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={handleAdd} disabled={saving || done}
          className="bg-orange-500 hover:bg-orange-400 gap-2 text-xs h-8">
          <Send className="h-3.5 w-3.5" />
          {done ? '✓ Added — welcome copied' : saving ? 'Creating login…' : 'Add user & copy welcome'}
        </Button>
        <Button size="sm" variant="ghost" className="text-slate-400 hover:text-slate-100 h-8" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

function formatLastSeen(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-ZA', {
      timeZone: 'Africa/Johannesburg',
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function SignInStatus({ pu, presence }) {
  const lastSeenMs = presence?.last_seen ? new Date(presence.last_seen).getTime() : 0;
  const live = lastSeenMs > 0 && Date.now() - lastSeenMs < OFFLINE_THRESHOLD;
  const lastLogin = pu.last_login_at || (lastSeenMs ? presence.last_seen : '');
  const awaiting = !!pu.awaiting_first_login && !live;

  if (pu.inactive) return null;
  if (live) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
        Live
      </span>
    );
  }
  if (awaiting || !lastLogin) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-300/90">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
        Not signed in
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
      Signed in {formatLastSeen(lastLogin)} SAST
    </span>
  );
}

function PendingUserRow({ pu, onRefresh, onIssued, currentEmail, issuedLookup, presence }) {
  const [editing, setEditing] = useState(false);

  // Split full_name into first/last on open
  const splitName = (full_name) => {
    const parts = (full_name || '').trim().split(' ');
    return { first: parts[0] || '', last: parts.slice(1).join(' ') };
  };

  const [form, setForm] = useState(() => {
    const { first, last } = splitName(pu.full_name);
    return { firstName: first, lastName: last, email: pu.email || '', role: pu.role || 'user', inactive: !!pu.inactive };
  });

  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [copyingWelcome, setCopyingWelcome] = useState(false);
  const [welcomeCopied, setWelcomeCopied] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetConfirm, setResetConfirm] = useState(false);
  const isSelf = currentEmail && String(pu.email || '').toLowerCase() === currentEmail;
  const emailKey = String(pu.email || '').trim().toLowerCase();
  const cachedIssued = issuedLookup?.[emailKey];

  const openEdit = () => {
    const { first, last } = splitName(pu.full_name);
    setForm({ firstName: first, lastName: last, email: pu.email || '', role: pu.role || 'user', inactive: !!pu.inactive });
    setEditing(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setResetError('');
    const full_name = [form.firstName.trim(), form.lastName.trim()].filter(Boolean).join(' ');
    const email = form.email.trim().toLowerCase();
    const role = form.role;
    const inactive = form.inactive;
    try {
      if (pu.id) {
        await base44.entities.PendingUser.update(pu.id, { full_name, email, role, inactive });
      } else {
        await base44.entities.PendingUser.create({ full_name, email, role, inactive, invited: true });
      }
      if (pu.userId) {
        await base44.entities.User.update(pu.userId, {
          full_name,
          email,
          role,
          inactive,
          standby: role === 'standby',
        });
      }
      setEditing(false);
      onRefresh();
    } catch (err) {
      setResetError(err.message || 'Could not save user changes');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (pu.id) await base44.entities.PendingUser.delete(pu.id);
    if (pu.userId) {
      await base44.entities.User.update(pu.userId, { inactive: true });
    }
    onRefresh();
  };

  const issueLogin = async () => {
    const email = String(pu.email || '').trim().toLowerCase();
    const result = await base44.users.resetPassword({
      email,
      allowCreate: true,
      full_name: pu.full_name || '',
      role: pu.role || 'user',
      inactive: !!pu.inactive,
    });
    if (result.issued?.length) onIssued(result);
    return result;
  };

  const handleResetPassword = async () => {
    if (pu.inactive) return;
    setResetError('');
    setResetting(true);
    try {
      const result = await issueLogin();
      if (!result.issued?.length) {
        setResetError(result.skipped?.[0]?.reason === 'inactive' ? 'Marked not in use — no login.' : 'No login to reset.');
      } else {
        setResetConfirm(false);
      }
    } catch (err) {
      setResetError(err.message || 'Could not reset password');
    } finally {
      setResetting(false);
    }
  };

  const handleCopyWelcome = async () => {
    if (pu.inactive) return;
    setResetError('');
    setCopyingWelcome(true);
    try {
      let item = cachedIssued;
      if (!item?.password) {
        const result = await issueLogin();
        item = result.issued?.[0];
        if (!item) {
          setResetError(result.skipped?.[0]?.reason === 'inactive' ? 'Marked not in use — no login.' : 'Could not create a login.');
          return;
        }
      }
      await copyText(buildWelcomeMessage({
        ...item,
        full_name: item.full_name || pu.full_name || '',
        email: item.email || pu.email,
      }, appOrigin()));
      setWelcomeCopied(true);
      setTimeout(() => setWelcomeCopied(false), 1800);
      toast.success(`Welcome message copied for ${pu.full_name || pu.email}`);
    } catch (err) {
      setResetError(err.message || 'Could not copy welcome message');
    } finally {
      setCopyingWelcome(false);
    }
  };

  const displayName = pu.full_name || pu.email;

  return (
    <div className="px-5 py-4">
      {editing ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-400 block mb-1">First Name</label>
              <Input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })}
                placeholder="First name" className="bg-slate-800 border-slate-800 text-slate-100 h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Last Name</label>
              <Input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })}
                placeholder="Last name" className="bg-slate-800 border-slate-800 text-slate-100 h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Email</label>
              <Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="user@example.com" type="email" className="bg-slate-800 border-slate-800 text-slate-100 h-8 text-sm" />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Role</label>
              <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                className="bg-slate-800 border border-slate-800 text-slate-100 rounded-md px-2 py-1.5 text-sm w-full h-8">
                {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
            <input type="checkbox" checked={form.inactive} onChange={e => setForm({ ...form, inactive: e.target.checked })}
              className="w-4 h-4 accent-blue-500" />
            Mark as "Not in use"
          </label>
          {resetError && <p className="text-xs text-red-400">{resetError}</p>}
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" className="bg-orange-500 hover:bg-orange-400 h-8 gap-1" onClick={handleSave} disabled={saving}>
              <Save className="h-3 w-3" /> {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-slate-400 hover:text-slate-100" onClick={() => setEditing(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ) : (
        <div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 bg-slate-800 rounded-full flex items-center justify-center font-bold text-orange-400 flex-shrink-0 text-sm">
              {displayName.charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-medium text-slate-100 truncate">{displayName}</p>
                {pu.inactive && <span className="text-[10px] bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full">Not in use</span>}
                <SignInStatus pu={pu} presence={presence} />
              </div>
              <p className="text-xs text-slate-400 truncate">{pu.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge className={`text-xs border ${roleBadgeClass[pu.role] || roleBadgeClass.user}`}>
              {roleLabel[pu.role] || pu.role}
            </Badge>
            {!pu.inactive && (
              <>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-slate-500 hover:text-blue-300 hover:bg-slate-800"
                  onClick={handleCopyWelcome}
                  disabled={copyingWelcome || resetting}
                  title={cachedIssued?.password
                    ? 'Copy welcome message (username, temp password, app link)'
                    : 'Issue a temp password and copy the welcome message'}
                >
                  {welcomeCopied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <MessageSquare className="h-3.5 w-3.5" />}
                </Button>
                {resetConfirm ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-amber-300 hidden sm:inline">Reset password?</span>
                    <Button
                      size="sm"
                      className="h-7 bg-amber-600 hover:bg-amber-500 text-slate-950 text-xs"
                      onClick={handleResetPassword}
                      disabled={resetting || copyingWelcome}
                    >
                      {resetting ? 'Resetting…' : 'Yes'}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs text-slate-400 hover:bg-slate-800"
                      onClick={() => setResetConfirm(false)}
                      disabled={resetting}
                    >
                      No
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 border-slate-700 text-amber-200 hover:bg-slate-800 gap-1 text-xs"
                    onClick={() => { setResetConfirm(true); setResetError(''); }}
                    disabled={resetting || copyingWelcome}
                    title={isSelf ? 'Reset my password' : `Reset password for ${displayName}`}
                  >
                    <KeyRound className="h-3.5 w-3.5" />
                    Reset
                  </Button>
                )}
              </>
            )}
            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-500 hover:text-orange-400 hover:bg-slate-800" onClick={openEdit}>
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            {deleteConfirm ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-red-400">Remove?</span>
                <Button size="sm" variant="ghost" className="h-6 text-xs text-red-400 hover:bg-red-900/30" onClick={handleDelete}>Yes</Button>
                <Button size="sm" variant="ghost" className="h-6 text-xs text-slate-400 hover:bg-slate-800" onClick={() => setDeleteConfirm(false)}>No</Button>
              </div>
            ) : (
              <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-600 hover:text-red-400 hover:bg-slate-800" onClick={() => setDeleteConfirm(true)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
        {resetError && <p className="text-xs text-red-400 mt-2">{resetError}</p>}
        </div>
      )}
    </div>
  );
}

function mergeCrew(pendingUsers = [], users = []) {
  const map = new Map();
  users.forEach((u) => {
    const email = String(u.email || '').trim().toLowerCase();
    if (!email) return;
    map.set(email, {
      id: null,
      userId: u.id,
      email,
      full_name: u.full_name || '',
      role: u.role || 'user',
      inactive: !!u.inactive,
      last_login_at: u.last_login_at || '',
      first_login_at: u.first_login_at || '',
      awaiting_first_login: !!u.awaiting_first_login,
    });
  });
  pendingUsers.forEach((pu) => {
    const email = String(pu.email || '').trim().toLowerCase();
    if (!email) return;
    const existing = map.get(email);
    map.set(email, {
      id: pu.id,
      userId: existing?.userId || null,
      email,
      full_name: pu.full_name || existing?.full_name || '',
      role: existing?.role || pu.role || 'user',
      inactive: existing?.inactive ?? !!pu.inactive,
      last_login_at: existing?.last_login_at || '',
      first_login_at: existing?.first_login_at || '',
      awaiting_first_login: !!existing?.awaiting_first_login,
    });
  });
  return Array.from(map.values()).sort((a, b) =>
    (a.full_name || a.email).localeCompare(b.full_name || b.email)
  );
}

export default function ManageUsersSection() {
  const queryClient = useQueryClient();
  const { user } = useApp();
  const currentEmail = String(user?.email || '').toLowerCase();
  const [showAddForm, setShowAddForm] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState(false);
  const [includeSelf, setIncludeSelf] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [issuedResult, setIssuedResult] = useState(null);

  const mergeIssued = (result) => {
    setIssuedResult((prev) => {
      const map = new Map((prev?.issued || []).map((item) => [String(item.email || '').toLowerCase(), item]));
      for (const item of result?.issued || []) {
        map.set(String(item.email || '').toLowerCase(), item);
      }
      return {
        issued: Array.from(map.values()),
        skipped: result?.skipped || [],
      };
    });
  };

  const { data: pendingUsers = [] } = useQuery({
    queryKey: ['pendingUsers'],
    queryFn: () => base44.entities.PendingUser.list(),
  });

  const { data: loginUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: presenceRecords = [] } = useQuery({
    queryKey: ['userPresence'],
    queryFn: () => base44.entities.UserPresence.list(),
    refetchInterval: 30_000,
  });

  const presenceByEmail = Object.fromEntries(
    presenceRecords
      .filter((item) => item.user_email)
      .map((item) => [String(item.user_email).toLowerCase(), item])
  );

  const crew = mergeCrew(pendingUsers, loginUsers);
  const issuedLookup = Object.fromEntries(
    (issuedResult?.issued || []).map((item) => [String(item.email || '').toLowerCase(), item])
  );

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['pendingUsers'] });
    queryClient.invalidateQueries({ queryKey: ['allUsers'] });
  };

  const handleBulkReset = async () => {
    setError('');
    setBusy(true);
    try {
      const result = await base44.users.resetPasswords({ includeSelf });
      mergeIssued(result);
      setConfirmBulk(false);
      setIncludeSelf(false);
      refresh();
    } catch (err) {
      setError(err.message || 'Could not regenerate passwords');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="bg-slate-900 border-slate-800 mb-6">
      <CardHeader className="border-b border-slate-800 pb-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-slate-100 flex items-center gap-2">
            <Users className="h-5 w-5 text-orange-400" /> Manage Users ({crew.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            {!showAddForm && (
              <Button size="sm" onClick={() => setShowAddForm(true)}
                className="bg-orange-500 hover:bg-orange-400 gap-1.5 text-xs">
                <UserPlus className="h-3.5 w-3.5" /> Add User
              </Button>
            )}
            {!confirmBulk && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => { setConfirmBulk(true); setError(''); }}
                className="border-slate-700 text-slate-200 hover:bg-slate-800 gap-1.5 text-xs"
              >
                <KeyRound className="h-3.5 w-3.5" /> Regenerate passwords
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <p className="text-xs text-slate-500 mb-4">
          Use Reset on a person to issue a new temporary password. Live (green) means they are in the app now.
          Not signed in means they have not used the login you sent yet.
        </p>
        {issuedResult?.issued?.length > 0 && (
          <IssuedPasswords
            issued={issuedResult.issued}
            skipped={issuedResult.skipped}
            onDismiss={() => setIssuedResult(null)}
          />
        )}
        {confirmBulk && (
          <div className="mb-4 rounded-lg border border-slate-700 bg-slate-800/40 p-4 space-y-3">
            <p className="text-sm text-slate-200">Replace sign-in passwords for every active account?</p>
            <p className="text-xs text-slate-400">
              Your own password is left alone so you stay signed in. People marked “not in use” are skipped.
              The new list appears once — copy or download it before you leave. On next sign-in each person
              is prompted to change the generated password.
            </p>
            <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeSelf}
                onChange={(e) => setIncludeSelf(e.target.checked)}
                className="w-4 h-4 accent-blue-500"
              />
              Also reset my password ({user?.email})
            </label>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2 flex-wrap">
              <Button size="sm" className="bg-amber-600 hover:bg-amber-500 text-slate-950 h-8 text-xs" onClick={handleBulkReset} disabled={busy}>
                {busy ? 'Generating…' : 'Generate new passwords'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-slate-400 hover:text-slate-100 text-xs"
                onClick={() => { setConfirmBulk(false); setIncludeSelf(false); setError(''); }}
                disabled={busy}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
        {error && !confirmBulk && <p className="text-xs text-red-400 mb-3">{error}</p>}
        {showAddForm && (
          <AddUserForm
            onClose={() => setShowAddForm(false)}
            onAdded={refresh}
            onIssued={mergeIssued}
          />
        )}
        <div className="divide-y divide-slate-800 -mx-6 -mb-6">
          {crew.length === 0 && <p className="text-slate-500 text-sm p-6 text-center">No users added yet.</p>}
          {crew.map(pu => (
            <PendingUserRow
              key={pu.userId || pu.id || pu.email}
              pu={pu}
              onRefresh={refresh}
              currentEmail={currentEmail}
              onIssued={mergeIssued}
              issuedLookup={issuedLookup}
              presence={presenceByEmail[pu.email]}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}