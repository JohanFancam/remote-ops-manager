import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function SettingsPage() {
  const [form, setForm] = useState(null);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [admins, setAdmins] = useState([]);
  const [standby, setStandby] = useState([]);
  const [standbyForm, setStandbyForm] = useState({
    adminId: '',
    startDate: '',
    startTime: '08:00',
    endDate: '',
    endTime: '23:59',
    notes: '',
  });

  const loadStandby = useCallback(async () => {
    const data = await api('/standby');
    setStandby(data.standby || []);
  }, []);

  useEffect(() => {
    api('/settings')
      .then(setForm)
      .catch((err) => setError(err.message));
    api('/admins')
      .then((list) => {
        setAdmins(list);
        setStandbyForm((f) => ({ ...f, adminId: list[0]?.id || '' }));
      })
      .catch(() => {});
    loadStandby().catch((err) => setError(err.message));
  }, [loadStandby]);

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

  async function addStandby(e) {
    e.preventDefault();
    try {
      await api('/standby', {
        method: 'POST',
        body: {
          ...standbyForm,
          endDate: standbyForm.endDate || standbyForm.startDate,
        },
      });
      setStandbyForm((f) => ({ ...f, startDate: '', endDate: '', notes: '' }));
      await loadStandby();
      setMsg('Standby scheduled');
    } catch (err) {
      setError(err.message);
    }
  }

  async function removeStandby(id) {
    await api(`/standby/${id}`, { method: 'DELETE' });
    await loadStandby();
  }

  if (!form) return <p className="text-mist-muted">Loading settings…</p>;

  return (
    <div>
      <h1 className="font-display text-3xl font-bold text-mist">Settings</h1>
      <p className="text-sm text-mist-muted">Rates, pairing, standby schedule</p>
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

      <section className="mt-12 max-w-xl border-t border-ink-700/60 pt-8">
        <h2 className="font-display text-xl font-bold text-mist">Admin standby</h2>
        <p className="text-sm text-mist-muted">
          Schedule who is on standby — shown on every Admin and Remote dashboard banner
        </p>
        <form onSubmit={addStandby} className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block text-xs text-mist-muted sm:col-span-2">
            Admin
            <select
              className="mt-1 w-full border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-mist"
              value={standbyForm.adminId}
              onChange={(e) => setStandbyForm({ ...standbyForm, adminId: e.target.value })}
              required
            >
              {admins.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.fullName}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Start date"
            type="date"
            value={standbyForm.startDate}
            onChange={(v) => setStandbyForm({ ...standbyForm, startDate: v })}
          />
          <Field
            label="Start time"
            type="time"
            value={standbyForm.startTime}
            onChange={(v) => setStandbyForm({ ...standbyForm, startTime: v })}
          />
          <Field
            label="End date"
            type="date"
            value={standbyForm.endDate}
            onChange={(v) => setStandbyForm({ ...standbyForm, endDate: v })}
          />
          <Field
            label="End time"
            type="time"
            value={standbyForm.endTime}
            onChange={(v) => setStandbyForm({ ...standbyForm, endTime: v })}
          />
          <Field
            label="Notes"
            value={standbyForm.notes}
            onChange={(v) => setStandbyForm({ ...standbyForm, notes: v })}
          />
          <button type="submit" className="bg-blue px-4 py-2 text-sm font-semibold text-white sm:col-span-2">
            Add standby period
          </button>
        </form>
        <ul className="mt-6 space-y-2">
          {standby.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-3 border-t border-ink-700/50 py-2 text-sm">
              <div>
                <p className="text-mist">{s.adminName}</p>
                <p className="text-xs text-mist-muted">
                  {s.startDate} {s.startTime} → {s.endDate} {s.endTime}
                </p>
              </div>
              <button type="button" className="text-xs text-red-300" onClick={() => removeStandby(s.id)}>
                Remove
              </button>
            </li>
          ))}
          {!standby.length && <li className="text-sm text-mist-muted">No standby periods</li>}
        </ul>
      </section>
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
        required={type === 'date' && label.startsWith('Start')}
      />
    </label>
  );
}
