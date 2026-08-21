import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';
import RigRecipe from '../components/RigRecipe.jsx';
import { useAuth } from '../lib/auth.jsx';

const emptyForm = {
  name: '',
  teamName: '',
  venueType: 'Outdoor',
  shootType: 'Data',
  sport: 'MLB',
  shootPlan: '',
  notes: '',
  dataHd: { shutter: '1/1000', aperture: 'f/4', iso: '800' },
  dataWide: { shutter: '1/500', aperture: 'f/2.8', iso: '1600' },
  attentionEnabled: false,
  attentionHd: { shutter: '1/1000', aperture: 'f/4', iso: '800' },
  soundEnabled: false,
  remoteRigs: '',
};

export default function RigsPage() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin';
  const [rigs, setRigs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api('/rigs');
      setRigs(data.rigs || []);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function startCreate() {
    setEditing('new');
    setForm(emptyForm);
    setSelected(null);
  }

  function startEdit(rig) {
    setEditing(rig.id);
    setSelected(rig);
    const r = rig.recipe || {};
    setForm({
      name: rig.name || '',
      teamName: rig.teamName || '',
      venueType: rig.venueType || 'Outdoor',
      shootType: rig.shootType || 'Data',
      sport: r.sport || '',
      shootPlan: r.shootPlan || '',
      notes: r.notes || '',
      dataHd: r.dataHd || emptyForm.dataHd,
      dataWide: r.dataWide || emptyForm.dataWide,
      attentionEnabled: !!r.attentionEnabled,
      attentionHd: r.attentionHd || emptyForm.attentionHd,
      soundEnabled: !!r.soundEnabled,
      remoteRigs: (r.remoteRigs || []).join(', '),
    });
  }

  async function save(e) {
    e.preventDefault();
    const body = {
      name: form.name,
      teamName: form.teamName,
      venueType: form.venueType,
      shootType: form.shootType,
      sport: form.sport,
      shootPlan: form.shootPlan,
      notes: form.notes,
      dataHd: form.dataHd,
      dataWide: form.dataWide,
      attentionEnabled: form.attentionEnabled,
      attentionHd: form.attentionHd,
      soundEnabled: form.soundEnabled,
      remoteRigs: form.remoteRigs
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    };
    try {
      if (editing === 'new') {
        await api('/rigs', { method: 'POST', body });
      } else {
        await api(`/rigs/${editing}`, { method: 'PUT', body });
      }
      setEditing(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  const displayRig = selected
    ? {
        venueType: selected.venueType,
        sport: selected.recipe?.sport,
        rigType: selected.shootType,
        shootPlan: selected.recipe?.shootPlan,
        dataEnabled: selected.recipe?.dataEnabled !== false,
        dataHd: selected.recipe?.dataHd,
        dataWide: selected.recipe?.dataWide,
        attentionEnabled: selected.recipe?.attentionEnabled,
        attentionHd: selected.recipe?.attentionHd,
        soundEnabled: selected.recipe?.soundEnabled,
        remoteRigs: selected.recipe?.remoteRigs,
        notes: selected.recipe?.notes,
      }
    : null;

  return (
    <div className="animate-rise-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-mist">Rig settings</h1>
          <p className="text-sm text-mist-muted">
            House recipes pull through to matching calendar shoots by team name
          </p>
        </div>
        {canManage && (
          <button type="button" onClick={startCreate} className="bg-blue px-4 py-2 text-sm font-semibold text-white">
            New rig
          </button>
        )}
      </div>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_1fr]">
        <ul className="space-y-1">
          {rigs.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => {
                  setSelected(r);
                  setEditing(null);
                }}
                className={`w-full border-l-2 px-3 py-2 text-left text-sm ${
                  selected?.id === r.id
                    ? 'border-blue bg-ink-900/70 text-mist'
                    : 'border-transparent text-mist-muted hover:bg-ink-900/40'
                }`}
              >
                <span className="block font-medium">{r.teamName || r.name}</span>
                <span className="text-[10px] uppercase tracking-wider">{r.shootType}</span>
                {!r.active && <span className="ml-2 text-[10px]">inactive</span>}
              </button>
            </li>
          ))}
        </ul>

        <div>
          {editing ? (
            <form onSubmit={save} className="grid max-w-2xl gap-3 sm:grid-cols-2">
              <h2 className="sm:col-span-2 font-display text-xl font-bold">
                {editing === 'new' ? 'Create rig' : 'Edit rig'}
              </h2>
              {[
                ['name', 'Name'],
                ['teamName', 'Team name'],
                ['sport', 'Sport'],
                ['shootPlan', 'Shoot plan'],
                ['remoteRigs', 'Remote rigs (comma-separated)'],
                ['notes', 'Notes'],
              ].map(([key, label]) => (
                <label key={key} className="block text-xs text-mist-muted sm:col-span-2">
                  {label}
                  <input
                    className="mt-1 w-full border border-ink-600 bg-ink-950 px-3 py-2 text-sm text-mist"
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    required={key === 'name' || key === 'teamName'}
                  />
                </label>
              ))}
              <label className="block text-xs text-mist-muted">
                Venue
                <select
                  className="mt-1 w-full border border-ink-600 bg-ink-950 px-3 py-2 text-sm"
                  value={form.venueType}
                  onChange={(e) => setForm({ ...form, venueType: e.target.value })}
                >
                  {['Outdoor', 'Indoor', 'Arena'].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs text-mist-muted">
                Shoot type
                <select
                  className="mt-1 w-full border border-ink-600 bg-ink-950 px-3 py-2 text-sm"
                  value={form.shootType}
                  onChange={(e) => setForm({ ...form, shootType: e.target.value })}
                >
                  {['Data', 'Fancam', 'Data/Fancam'].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              {['dataHd', 'dataWide', 'attentionHd'].map((cam) => (
                <fieldset key={cam} className="sm:col-span-2 border border-ink-700 p-3">
                  <legend className="px-1 text-xs uppercase tracking-wider text-mist-muted">{cam}</legend>
                  <div className="grid grid-cols-3 gap-2">
                    {['shutter', 'aperture', 'iso'].map((f) => (
                      <input
                        key={f}
                        placeholder={f}
                        className="border border-ink-600 bg-ink-950 px-2 py-2 font-mono text-xs"
                        value={form[cam]?.[f] || ''}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            [cam]: { ...form[cam], [f]: e.target.value },
                          })
                        }
                      />
                    ))}
                  </div>
                </fieldset>
              ))}
              <label className="flex items-center gap-2 text-sm text-mist">
                <input
                  type="checkbox"
                  checked={form.attentionEnabled}
                  onChange={(e) => setForm({ ...form, attentionEnabled: e.target.checked })}
                />
                Attention camera
              </label>
              <label className="flex items-center gap-2 text-sm text-mist">
                <input
                  type="checkbox"
                  checked={form.soundEnabled}
                  onChange={(e) => setForm({ ...form, soundEnabled: e.target.checked })}
                />
                Sound
              </label>
              <div className="sm:col-span-2 flex gap-2">
                <button type="submit" className="bg-blue px-4 py-2 text-sm font-semibold text-white">
                  Save
                </button>
                <button
                  type="button"
                  className="border border-ink-600 px-4 py-2 text-sm"
                  onClick={() => setEditing(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : selected ? (
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-display text-2xl font-bold text-mist">
                    {selected.teamName || selected.name}
                  </h2>
                  <p className="text-sm text-mist-muted">{selected.name}</p>
                </div>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => startEdit(selected)}
                    className="border border-ink-600 px-3 py-2 text-xs"
                  >
                    Edit
                  </button>
                )}
              </div>
              <div className="mt-6">
                <RigRecipe rig={displayRig} />
              </div>
            </div>
          ) : (
            <p className="text-mist-muted">Select a rig or create one</p>
          )}
        </div>
      </div>
    </div>
  );
}
