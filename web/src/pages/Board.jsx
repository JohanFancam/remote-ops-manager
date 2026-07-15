import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth.jsx';

function startOfWeek(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay(); // 0 Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtDay(dateStr) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function Board() {
  const { user } = useAuth();
  const [start, setStart] = useState(() => startOfWeek());
  const [board, setBoard] = useState(null);
  const [error, setError] = useState('');
  const [sheetShoot, setSheetShoot] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await api(`/board?start=${start}&days=7`);
      setBoard(data);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [start]);

  useEffect(() => {
    load();
  }, [load]);

  const days = useMemo(() => {
    if (!board) return [];
    return Object.keys(board.daysByDate).sort();
  }, [board]);

  async function claim(shoot, assignDirect = false) {
    setBusy(true);
    setError('');
    try {
      const result = await api(`/shoots/${shoot.id}/claim`, {
        method: 'POST',
        body: assignDirect ? { assignDirect: true } : {},
      });
      setToast(
        result.state === 'pending'
          ? `Pending approval — ${result.reason || 'over 6-cap'}`
          : result.paired
            ? `Claimed + auto-paired ${result.paired.client}`
            : 'Claimed'
      );
      setSheetShoot(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function unclaim(shoot) {
    setBusy(true);
    try {
      await api(`/shoots/${shoot.id}/unclaim`, { method: 'POST', body: {} });
      setToast('Released');
      setSheetShoot(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function approve(shoot, operatorEmail) {
    setBusy(true);
    try {
      await api('/assignments/approve', {
        method: 'POST',
        body: { shootId: shoot.id, operatorEmail },
      });
      setToast('Approved');
      setSheetShoot(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function reject(shoot, operatorEmail) {
    setBusy(true);
    try {
      await api('/assignments/reject', {
        method: 'POST',
        body: { shootId: shoot.id, operatorEmail },
      });
      setToast('Rejected');
      setSheetShoot(null);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const isStaff = user.role === 'admin' || user.role === 'standby';

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-mist">Board</h1>
          <p className="mt-1 text-sm text-mist-muted">Week strip · claim via sheet · server enforces rules</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="border border-ink-600 px-3 py-2 text-sm text-mist-muted hover:border-lime/40"
            onClick={() => setStart(addDays(start, -7))}
          >
            Prev
          </button>
          <button
            type="button"
            className="border border-ink-600 px-3 py-2 text-sm text-mist-muted hover:border-lime/40"
            onClick={() => setStart(startOfWeek())}
          >
            This week
          </button>
          <button
            type="button"
            className="border border-ink-600 px-3 py-2 text-sm text-mist-muted hover:border-lime/40"
            onClick={() => setStart(addDays(start, 7))}
          >
            Next
          </button>
        </div>
      </div>

      {board && user.role === 'user' && (
        <p className="mt-4 font-mono text-xs text-mist-muted">
          Pre-approved slots: {board.myPreApprovedCount}/{board.preApproveLimit}
        </p>
      )}
      {toast && (
        <p className="mt-3 text-sm text-lime" onAnimationEnd={() => setTimeout(() => setToast(''), 2500)}>
          {toast}
        </p>
      )}
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

      {!board ? (
        <p className="mt-10 text-mist-muted">Loading week…</p>
      ) : (
        <div className="mt-8 flex gap-3 overflow-x-auto pb-4">
          {days.map((date) => (
            <div
              key={date}
              className="min-w-[220px] flex-1 border-t border-ink-600 pt-3"
            >
              <p className="font-mono text-xs uppercase tracking-wider text-mist-muted">
                {fmtDay(date)}
              </p>
              <ul className="mt-3 space-y-2">
                {(board.daysByDate[date] || []).map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setSheetShoot(s)}
                      className="w-full border border-transparent bg-ink-900/40 px-3 py-3 text-left transition hover:border-lime/30 hover:bg-ink-800/50"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-mono text-xs text-lime">{s.gameTime}</span>
                        <StatePill shoot={s} />
                      </div>
                      <p className="mt-1 text-sm font-medium text-mist">{s.client || s.title}</p>
                      <p className="truncate text-xs text-mist-muted">{s.title}</p>
                    </button>
                  </li>
                ))}
                {(board.daysByDate[date] || []).length === 0 && (
                  <li className="py-6 text-xs text-mist-muted/60">Quiet</li>
                )}
              </ul>
            </div>
          ))}
        </div>
      )}

      {sheetShoot && (
        <ClaimSheet
          shoot={sheetShoot}
          user={user}
          isStaff={isStaff}
          busy={busy}
          onClose={() => setSheetShoot(null)}
          onClaim={() => claim(sheetShoot)}
          onUnclaim={() => unclaim(sheetShoot)}
          onApprove={(email) => approve(sheetShoot, email)}
          onReject={(email) => reject(sheetShoot, email)}
        />
      )}
    </div>
  );
}

function StatePill({ shoot }) {
  if (shoot.myState === 'assigned') {
    return <span className="text-[10px] uppercase tracking-wider text-lime">Mine</span>;
  }
  if (shoot.myState === 'pending') {
    return <span className="text-[10px] uppercase tracking-wider text-amber-300">Pending</span>;
  }
  if (shoot.assignedOperators.length) {
    return <span className="text-[10px] uppercase tracking-wider text-mist-muted">Covered</span>;
  }
  if (shoot.pendingOperators.length) {
    return <span className="text-[10px] uppercase tracking-wider text-amber-300">Pending</span>;
  }
  return <span className="text-[10px] uppercase tracking-wider text-mist-muted">Open</span>;
}

function ClaimSheet({
  shoot,
  user,
  isStaff,
  busy,
  onClose,
  onClaim,
  onUnclaim,
  onApprove,
  onReject,
}) {
  const mine =
    shoot.myState === 'assigned' || shoot.myState === 'pending';
  const canSelfClaim = user.role === 'user' && !mine;

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-ink-950/70 p-0 md:items-center md:p-6">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg animate-rise-in border border-ink-600 bg-ink-900 p-5 shadow-cue md:rounded-sm">
        <p className="font-mono text-xs uppercase tracking-widest text-mist-muted">
          {shoot.date} · {shoot.gameTime}
        </p>
        <h2 className="mt-2 font-display text-2xl font-bold text-mist">{shoot.title}</h2>
        <p className="mt-1 text-sm text-mist-muted">
          {shoot.location} · {shoot.client}
        </p>

        <div className="mt-5 space-y-1 text-sm">
          <p>
            Assigned:{' '}
            <span className="text-mist">
              {shoot.assignedOperators.length ? shoot.assignedOperators.join(', ') : '—'}
            </span>
          </p>
          <p>
            Pending:{' '}
            <span className="text-mist">
              {shoot.pendingOperators.length ? shoot.pendingOperators.join(', ') : '—'}
            </span>
          </p>
        </div>

        <div className="mt-6 flex flex-wrap gap-2">
          {canSelfClaim && (
            <button
              type="button"
              disabled={busy}
              onClick={onClaim}
              className="bg-lime px-4 py-3 font-display text-sm font-bold text-ink-950 disabled:opacity-60"
            >
              Claim
            </button>
          )}
          {mine && (
            <button
              type="button"
              disabled={busy}
              onClick={onUnclaim}
              className="border border-ink-600 px-4 py-3 text-sm text-mist disabled:opacity-60"
            >
              Release
            </button>
          )}
          {isStaff &&
            shoot.pendingOperators.map((email) => (
              <div key={email} className="flex w-full flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onApprove(email)}
                  className="bg-lime px-4 py-3 font-display text-sm font-bold text-ink-950"
                >
                  Approve {email}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onReject(email)}
                  className="border border-ink-600 px-4 py-3 text-sm"
                >
                  Reject
                </button>
              </div>
            ))}
          <button
            type="button"
            onClick={onClose}
            className="ml-auto border border-ink-600 px-4 py-3 text-sm text-mist-muted"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
