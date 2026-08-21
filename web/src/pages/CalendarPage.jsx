import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth.jsx';
import RigRecipe from '../components/RigRecipe.jsx';

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtDay(dateStr) {
  return new Date(`${dateStr}T12:00:00Z`).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export default function CalendarPage() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const isRemote = user.role === 'operator';
  const [mode, setMode] = useState('week');
  const [start, setStart] = useState(() => startOfWeek());
  const [board, setBoard] = useState(null);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState(null);
  const [toast, setToast] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [operators, setOperators] = useState([]);
  const [csvText, setCsvText] = useState('');
  const [icsText, setIcsText] = useState('');
  const [googleUrl, setGoogleUrl] = useState('');

  const daysCount = mode === 'month' ? 35 : 7;

  const load = useCallback(async () => {
    try {
      const data = await api(`/calendar?start=${start}&days=${daysCount}`);
      setBoard(data);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [start, daysCount]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!isAdmin) return;
    api('/operators').then(setOperators).catch(() => {});
  }, [isAdmin]);

  const days = useMemo(() => (board ? Object.keys(board.daysByDate).sort() : []), [board]);

  async function claim(shoot) {
    try {
      const result = await api(`/shoots/${shoot.id}/claim`, { method: 'POST', body: {} });
      setToast(
        result.status === 'pending'
          ? `Pending — ${result.reason || 'over limit'}`
          : result.paired
            ? `Claimed + paired ${result.paired.teamName || result.paired.title}`
            : 'Claimed'
      );
      setSheet(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function withdraw(shoot) {
    try {
      await api(`/shoots/${shoot.id}/withdraw`, { method: 'POST', body: {} });
      setToast('Withdrawn');
      setSheet(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function createShoot(e) {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await api('/shoots', {
        method: 'POST',
        body: {
          title: fd.get('title'),
          teamName: fd.get('teamName'),
          opponent: fd.get('opponent'),
          date: fd.get('date'),
          setupTime: fd.get('setupTime'),
          gameTime: fd.get('gameTime'),
          venue: fd.get('venue'),
          shootType: fd.get('shootType') || 'Data',
        },
      });
      setFormOpen(false);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function importCsv() {
    const lines = csvText.trim().split('\n').filter(Boolean);
    const header = lines.shift();
    if (!header) return;
    const cols = header.split(',').map((c) => c.trim());
    const rows = lines.map((line) => {
      const vals = line.split(',').map((v) => v.trim());
      const obj = {};
      cols.forEach((c, i) => {
        obj[c] = vals[i];
      });
      return {
        title: obj.title || obj.Title,
        teamName: obj.teamName || obj.team || obj.Team,
        opponent: obj.opponent || obj.Opponent,
        date: obj.date || obj.Date,
        setupTime: obj.setupTime || obj.setup,
        gameTime: obj.gameTime || obj.game || '19:00',
        venue: obj.venue || obj.Venue,
      };
    });
    try {
      const result = await api('/shoots/import', { method: 'POST', body: { rows } });
      setToast(`Imported ${result.created} from CSV`);
      setCsvText('');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function importIcs() {
    try {
      const result = await api('/shoots/import/ics', { method: 'POST', body: { ics: icsText } });
      setToast(`Imported ${result.created} from ICS`);
      setIcsText('');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function importGoogle() {
    try {
      const result = await api('/shoots/import/url', { method: 'POST', body: { url: googleUrl } });
      setToast(`Imported ${result.created} from Google Calendar`);
      setGoogleUrl('');
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  function shootStatusLabel(s) {
    if (s.myAssignment?.status) return s.myAssignment.status;
    if (s.isTaken) return 'taken';
    return 'open';
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-mist">Calendar</h1>
          <p className="text-sm text-mist-muted">
            {isAdmin ? 'All shoots · assign · import' : 'Assign yourself to open shoots'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="border border-ink-600 px-3 py-2 text-sm" onClick={() => setMode('week')}>
            Week
          </button>
          {isAdmin && (
            <button type="button" className="border border-ink-600 px-3 py-2 text-sm" onClick={() => setMode('month')}>
              Month
            </button>
          )}
          <button type="button" className="border border-ink-600 px-3 py-2 text-sm" onClick={() => setStart(addDays(start, mode === 'month' ? -28 : -7))}>
            Prev
          </button>
          <button type="button" className="border border-ink-600 px-3 py-2 text-sm" onClick={() => setStart(startOfWeek())}>
            Today
          </button>
          <button type="button" className="border border-ink-600 px-3 py-2 text-sm" onClick={() => setStart(addDays(start, mode === 'month' ? 28 : 7))}>
            Next
          </button>
          {isAdmin && (
            <button type="button" className="bg-blue px-3 py-2 text-sm font-semibold text-white" onClick={() => setFormOpen(true)}>
              New shoot
            </button>
          )}
        </div>
      </div>

      {isRemote && board && (
        <p className="mt-3 font-mono text-xs text-mist-muted">
          Pre-approved: {board.myPreApprovedCount}/{board.preApproveLimit}
        </p>
      )}
      {toast && <p className="mt-2 text-sm text-blue-bright">{toast}</p>}
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}

      {!board ? (
        <p className="mt-8 text-mist-muted">Loading…</p>
      ) : (
        <div className="mt-6 -mx-4 flex gap-3 overflow-x-auto px-4 pb-4 snap-x snap-mandatory md:mx-0 md:grid md:grid-cols-7 md:overflow-visible md:px-0 md:snap-none">
          {days.map((date) => (
            <div key={date} className="min-w-[75vw] snap-start border-t border-ink-600 pt-3 sm:min-w-[200px] md:min-w-0">
              <p className="font-mono text-[10px] uppercase tracking-wider text-mist-muted">{fmtDay(date)}</p>
              <ul className="mt-2 space-y-2">
                {(board.daysByDate[date] || []).map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setSheet(s)}
                      className="w-full border border-transparent bg-ink-900/50 px-2 py-2 text-left hover:border-blue/30"
                    >
                      <div className="flex justify-between gap-1">
                        <span className="font-mono text-[10px] text-blue-bright">{s.gameTime}</span>
                        <span className="text-[10px] uppercase text-mist-muted">{shootStatusLabel(s)}</span>
                      </div>
                      <p className="truncate text-sm text-mist">{s.teamName || s.title}</p>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        <section className="mt-10 space-y-8 border-t border-ink-700/50 pt-6">
          <div>
            <h2 className="font-display text-lg font-bold text-mist">CSV import</h2>
            <p className="text-xs text-mist-muted">Columns: title,teamName,opponent,date,setupTime,gameTime,venue</p>
            <textarea
              className="mt-3 w-full border border-ink-600 bg-ink-900/70 p-3 font-mono text-xs text-mist"
              rows={3}
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="title,teamName,opponent,date,setupTime,gameTime,venue"
            />
            <button type="button" onClick={importCsv} className="mt-2 bg-blue px-4 py-2 text-sm font-semibold text-white">
              Import CSV
            </button>
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-mist">ICS import</h2>
            <p className="text-xs text-mist-muted">Paste a .ics / iCal file contents</p>
            <textarea
              className="mt-3 w-full border border-ink-600 bg-ink-900/70 p-3 font-mono text-xs text-mist"
              rows={3}
              value={icsText}
              onChange={(e) => setIcsText(e.target.value)}
              placeholder="BEGIN:VCALENDAR..."
            />
            <button type="button" onClick={importIcs} className="mt-2 bg-blue px-4 py-2 text-sm font-semibold text-white">
              Import ICS
            </button>
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-mist">Google Calendar</h2>
            <p className="text-xs text-mist-muted">
              Paste the calendar&apos;s secret ICS URL (Google Calendar → Settings → Integrate calendar)
            </p>
            <input
              className="mt-3 w-full border border-ink-600 bg-ink-900/70 px-3 py-2 font-mono text-xs text-mist"
              value={googleUrl}
              onChange={(e) => setGoogleUrl(e.target.value)}
              placeholder="https://calendar.google.com/calendar/ical/..."
            />
            <button type="button" onClick={importGoogle} className="mt-2 bg-blue px-4 py-2 text-sm font-semibold text-white">
              Pull from Google
            </button>
          </div>
        </section>
      )}

      {sheet && (
        <Sheet
          shoot={sheet}
          user={user}
          operators={operators}
          onClose={() => setSheet(null)}
          onClaim={() => claim(sheet)}
          onWithdraw={() => withdraw(sheet)}
          onReload={async () => {
            setSheet(null);
            await load();
          }}
          setError={setError}
          setToast={setToast}
        />
      )}

      {formOpen && (
        <div className="fixed inset-0 z-40 flex items-end bg-ink-950/80 md:items-center md:justify-center">
          <button type="button" className="absolute inset-0" onClick={() => setFormOpen(false)} aria-label="Close" />
          <form
            onSubmit={createShoot}
            className="relative z-10 w-full max-w-lg space-y-3 border border-ink-600 bg-ink-900 p-5"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            <h2 className="font-display text-xl font-bold">New shoot</h2>
            {['title', 'teamName', 'opponent', 'date', 'setupTime', 'gameTime', 'venue'].map((name) => (
              <input
                key={name}
                name={name}
                required={name === 'title' || name === 'date'}
                placeholder={name}
                type={name === 'date' ? 'date' : 'text'}
                className="w-full border border-ink-600 bg-ink-950 px-3 py-2 text-sm"
              />
            ))}
            <button type="submit" className="w-full bg-blue py-3 font-semibold text-white">
              Create
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function Sheet({ shoot, user, operators, onClose, onClaim, onWithdraw, onReload, setError, setToast }) {
  const isAdmin = user.role === 'admin';
  const isRemote = user.role === 'operator';
  const mine = shoot.myAssignment?.status;
  const takenByOther = shoot.isTaken && !mine;
  const [opId, setOpId] = useState(operators[0]?.id || '');
  const [override, setOverride] = useState(false);

  const rigDisplay = shoot.rig
    ? {
        venueType: shoot.rig.venueType,
        sport: shoot.rig.recipe?.sport,
        rigType: shoot.rig.shootType || shoot.shootType,
        shootPlan: shoot.rig.recipe?.shootPlan,
        dataEnabled: shoot.rig.recipe?.dataEnabled !== false,
        dataHd: shoot.rig.recipe?.dataHd,
        dataWide: shoot.rig.recipe?.dataWide,
        attentionEnabled: shoot.rig.recipe?.attentionEnabled,
        attentionHd: shoot.rig.recipe?.attentionHd,
        soundEnabled: shoot.rig.recipe?.soundEnabled,
        remoteRigs: shoot.rig.recipe?.remoteRigs,
        notes: shoot.rig.recipe?.notes,
      }
    : null;

  return (
    <div className="fixed inset-0 z-40 flex items-end bg-ink-950/80 md:items-center md:justify-center">
      <button type="button" className="absolute inset-0" onClick={onClose} aria-label="Close" />
      <div
        className="relative z-10 max-h-[90dvh] w-full max-w-lg overflow-y-auto border border-ink-600 bg-ink-900 p-5"
        style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
      >
        <p className="font-mono text-xs text-mist-muted">
          {shoot.date} · {shoot.gameTime}
          {shoot.calendarSource ? ` · ${shoot.calendarSource}` : ''}
        </p>
        <h2 className="mt-1 font-display text-2xl font-bold text-mist">{shoot.title}</h2>
        <p className="text-sm text-mist-muted">
          {shoot.venue} · {shoot.shootType}
        </p>
        {shoot.description && <p className="mt-2 text-sm text-mist">{shoot.description}</p>}
        {shoot.notes && <p className="mt-1 text-sm text-mist-muted">{shoot.notes}</p>}
        <p className="mt-3 text-sm">
          Assigned: {shoot.assignedOperators?.map((o) => o.fullName).join(', ') || '—'}
        </p>
        <p className="text-sm">
          Pending: {shoot.pendingOperators?.map((o) => o.fullName).join(', ') || '—'}
        </p>
        {takenByOther && (
          <p className="mt-2 text-sm text-amber-200">This shoot is taken — you cannot assign yourself.</p>
        )}

        {rigDisplay && (
          <div className="mt-5 border-t border-ink-700 pt-4">
            <p className="text-[10px] uppercase tracking-widest text-mist-muted">Rig settings</p>
            <div className="mt-3">
              <RigRecipe rig={rigDisplay} />
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {isRemote && !mine && !takenByOther && shoot.status !== 'cancelled' && shoot.status !== 'completed' && (
            <button type="button" onClick={onClaim} className="bg-blue px-4 py-3 text-sm font-bold text-white">
              Assign myself
            </button>
          )}
          {isRemote && mine && (
            <button type="button" onClick={onWithdraw} className="border border-ink-600 px-4 py-3 text-sm">
              Unassign
            </button>
          )}
          {isAdmin &&
            shoot.pendingOperators?.map((p) => (
              <div key={p.id} className="flex w-full gap-2">
                <button
                  type="button"
                  className="bg-blue px-3 py-2 text-xs font-bold text-white"
                  onClick={async () => {
                    await api('/assignments/approve', {
                      method: 'POST',
                      body: { shootId: shoot.id, operatorId: p.id },
                    });
                    setToast('Approved');
                    onReload();
                  }}
                >
                  Approve {p.fullName}
                </button>
                <button
                  type="button"
                  className="border border-ink-600 px-3 py-2 text-xs"
                  onClick={async () => {
                    await api('/assignments/reject', {
                      method: 'POST',
                      body: { shootId: shoot.id, operatorId: p.id },
                    });
                    setToast('Rejected');
                    onReload();
                  }}
                >
                  Reject
                </button>
              </div>
            ))}
          {isAdmin && (
            <div className="mt-2 w-full space-y-2 border-t border-ink-700 pt-3">
              <p className="text-xs uppercase tracking-wider text-mist-muted">Manual assign</p>
              <select
                className="w-full border border-ink-600 bg-ink-950 px-2 py-2 text-sm"
                value={opId}
                onChange={(e) => setOpId(e.target.value)}
              >
                {operators.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.fullName}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs text-mist-muted">
                <input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />
                Override warnings
              </label>
              <button
                type="button"
                className="bg-blue px-3 py-2 text-sm font-semibold text-white"
                onClick={async () => {
                  try {
                    await api('/assignments/assign', {
                      method: 'POST',
                      body: { shootId: shoot.id, operatorId: opId, override },
                    });
                    setToast('Assigned');
                    onReload();
                  } catch (err) {
                    setError(err.message + (err.warnings?.length ? ` (${err.warnings.map((w) => w.message || w.code).join(', ')})` : ''));
                  }
                }}
              >
                Assign
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="border border-ink-600 px-3 py-2 text-xs"
                  onClick={async () => {
                    await api(`/shoots/${shoot.id}/duplicate`, { method: 'POST', body: {} });
                    setToast('Duplicated');
                    onReload();
                  }}
                >
                  Duplicate
                </button>
                <button
                  type="button"
                  className="border border-ink-600 px-3 py-2 text-xs text-red-300"
                  onClick={async () => {
                    await api(`/shoots/${shoot.id}/cancel`, { method: 'POST', body: {} });
                    setToast('Cancelled');
                    onReload();
                  }}
                >
                  Cancel shoot
                </button>
              </div>
            </div>
          )}
          <button type="button" onClick={onClose} className="ml-auto border border-ink-600 px-4 py-3 text-sm text-mist-muted">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
