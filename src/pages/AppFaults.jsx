import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AlertTriangle, Check, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

function formatWhen(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-ZA', {
      timeZone: 'Africa/Johannesburg',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function LogFaultForm({ onSaved }) {
  const { user } = useApp();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!title.trim() && !notes.trim()) {
      toast.error('Add a short title or describe the fault');
      return;
    }
    setSaving(true);
    try {
      await base44.entities.AppFault.create({
        title: title.trim() || 'App fault',
        notes: notes.trim(),
        page: window.location.pathname,
        status: 'open',
        created_at: new Date().toISOString(),
        reported_by_email: user?.email || '',
        reported_by_name: user?.full_name || user?.email || '',
        reported_by_role: user?.role || '',
      });
      setTitle('');
      setNotes('');
      toast.success('Fault logged. Admins have been notified.');
      onSaved?.();
    } catch (err) {
      toast.error(err.message || 'Could not log that fault');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-100">Log an app fault</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Anyone can log a problem with the app. Only admins see the list and get notified.
        </p>
      </div>
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Short title, e.g. Calendar will not load"
        className="bg-slate-800 border-slate-800 text-slate-100"
      />
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="What happened, which screen, and what you expected."
        rows={4}
        className="w-full bg-slate-800 border border-slate-800 text-slate-100 rounded-md px-3 py-2 text-sm placeholder:text-slate-500 resize-none"
      />
      <Button type="submit" disabled={saving} className="bg-orange-500 hover:bg-orange-400">
        {saving ? 'Sending…' : 'Send to admins'}
      </Button>
    </form>
  );
}

export default function AppFaults() {
  const { isAdmin, user } = useApp();
  const queryClient = useQueryClient();
  const [busyId, setBusyId] = useState('');

  const { data: faults = [] } = useQuery({
    queryKey: ['appFaults'],
    queryFn: () => base44.entities.AppFault.list('-created_date', 300),
    enabled: isAdmin,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['appFaults'] });

  const handleResolve = async (fault) => {
    setBusyId(fault.id);
    try {
      await base44.entities.AppFault.update(fault.id, {
        status: 'resolved',
        resolved_at: new Date().toISOString(),
        resolved_by_email: user?.email || '',
      });
      refresh();
    } finally {
      setBusyId('');
    }
  };

  const handleDelete = async (fault) => {
    setBusyId(fault.id);
    try {
      await base44.entities.AppFault.delete(fault.id);
      refresh();
    } finally {
      setBusyId('');
    }
  };

  const openFaults = faults.filter((item) => item.status !== 'resolved');
  const resolvedFaults = faults.filter((item) => item.status === 'resolved');

  return (
    <div className="rom-page">
      <div className="rom-page-inner max-w-3xl">
        <header className="mb-6">
          <p className="rom-kicker mb-2">Support</p>
          <h1 className="rom-title flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-400" /> App faults
          </h1>
          <p className="rom-subtitle">
            Report something broken in Remote Ops Manager. Admins get an in-app notification.
          </p>
        </header>

        <LogFaultForm onSaved={isAdmin ? refresh : undefined} />

        {isAdmin && (
          <section className="mt-8 space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-200">Open faults ({openFaults.length})</h2>
              <p className="text-xs text-slate-500 mt-0.5">Only admins can see this list.</p>
            </div>
            {openFaults.length === 0 && (
              <p className="text-sm text-slate-500 rounded-xl border border-slate-800 bg-slate-900 px-4 py-6 text-center">
                No open app faults.
              </p>
            )}
            {openFaults.map((fault) => (
              <article key={fault.id} className="rounded-xl border border-amber-500/20 bg-slate-900 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-100">{fault.title || 'App fault'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {fault.reported_by_name || fault.reported_by_email} · {formatWhen(fault.created_at || fault.created_date)} SAST
                      {fault.page ? ` · ${fault.page}` : ''}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === fault.id}
                      onClick={() => handleResolve(fault)}
                      className="border-slate-700 text-slate-200 hover:bg-slate-800 h-8 gap-1"
                    >
                      <Check className="h-3.5 w-3.5" /> Resolve
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      disabled={busyId === fault.id}
                      onClick={() => handleDelete(fault)}
                      className="h-8 w-8 text-slate-500 hover:text-red-400"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {fault.notes ? <p className="text-sm text-slate-300 mt-3 whitespace-pre-wrap">{fault.notes}</p> : null}
              </article>
            ))}

            {resolvedFaults.length > 0 && (
              <div className="pt-4">
                <h2 className="text-sm font-semibold text-slate-400 mb-3">Resolved ({resolvedFaults.length})</h2>
                <ul className="space-y-2">
                  {resolvedFaults.map((fault) => (
                    <li key={fault.id} className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-sm text-slate-400">
                      <span className="text-slate-300">{fault.title}</span>
                      <span className="text-xs text-slate-600"> · {fault.reported_by_name || fault.reported_by_email} · {formatWhen(fault.resolved_at || fault.created_date)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
