import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function SettingsPage() {
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api('/settings')
      .then(setForm)
      .catch((err) => setError(err.message));
  }, []);

  async function save(e) {
    e.preventDefault();
    try {
      await api('/settings', {
        method: 'PUT',
        body: {
          ...form,
          autoPairTeams: Array.isArray(form.autoPairTeams)
            ? form.autoPairTeams
            : String(form.autoPairTeams)
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
        },
      });
      setMsg('Saved');
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  if (!form) return <p className="text-mist-muted">Loading settings…</p>;

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-mist">Settings</h1>
      <p className="text-sm text-mist-muted">Rates, pairing, branding</p>
      {msg && <p className="mt-2 text-sm text-blue-bright">{msg}</p>}
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}

      <form onSubmit={save} className="mt-6 max-w-xl space-y-4">
        <Field label="Application name" value={form.applicationName} onChange={(v) => setForm({ ...form, applicationName: v })} />
        <Field label="Application logo URL" value={form.applicationLogo || ''} onChange={(v) => setForm({ ...form, applicationLogo: v })} />
        <Field label="Currency" value={form.currency} onChange={(v) => setForm({ ...form, currency: v })} />
        <Field label="Base rate" type="number" value={form.baseRate} onChange={(v) => setForm({ ...form, baseRate: Number(v) })} />
        <Field label="Additional rate" type="number" value={form.additionalRate} onChange={(v) => setForm({ ...form, additionalRate: Number(v) })} />
        <Field label="Pre-approved limit" type="number" value={form.preApprovedLimit} onChange={(v) => setForm({ ...form, preApprovedLimit: Number(v) })} />
        <Field
          label="Auto-pair teams (comma-separated)"
          value={Array.isArray(form.autoPairTeams) ? form.autoPairTeams.join(', ') : form.autoPairTeams}
          onChange={(v) => setForm({ ...form, autoPairTeams: v })}
        />
        <Field
          label="Auto-pair window (minutes)"
          type="number"
          value={form.autoPairWindowMinutes}
          onChange={(v) => setForm({ ...form, autoPairWindowMinutes: Number(v) })}
        />
        <Field
          label="Notification lead (hours)"
          type="number"
          value={form.notificationLeadHours}
          onChange={(v) => setForm({ ...form, notificationLeadHours: Number(v) })}
        />
        <button type="submit" className="bg-blue px-5 py-3 font-display text-sm font-bold text-white">
          Save settings
        </button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wider text-mist-muted">{label}</span>
      <input
        type={type}
        className="w-full border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-mist"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
