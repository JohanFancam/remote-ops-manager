import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, getToken } from '../lib/api';
import { useAuth } from '../lib/auth.jsx';
import Countdown from '../components/Countdown.jsx';
import RigRecipe from '../components/RigRecipe.jsx';
import PhaseMessage from '../components/PhaseMessage.jsx';
import BrandMark, { BrandSubline } from '../components/BrandMark.jsx';

export default function Today() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    try {
      const payload = await api('/me/today');
      setData(payload);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const token = getToken();
    if (!token) return undefined;
    const es = new EventSource(`/api/me/today/stream?token=${encodeURIComponent(token)}`);
    // EventSource can't send Authorization header — use polling fallback + try stream without token query
    es.close();

    // SSE with fetch stream polyfill via EventSource won't get JWT; use polling + beacon endpoint with cookie-less auth:
    // We'll open SSE by appending nothing and relying on a custom approach — use fetch ReadableStream instead.
    let cancelled = false;
    let controller = new AbortController();

    async function connect() {
      try {
        const res = await fetch('/api/me/today/stream', {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream' },
          signal: controller.signal,
        });
        if (!res.ok || !res.body) return;
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!cancelled) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          if (buffer.includes('event: shoot_updated') || buffer.includes('event: phase_advanced')) {
            buffer = '';
            load();
          }
          if (buffer.length > 4000) buffer = buffer.slice(-500);
        }
      } catch {
        /* ignore abort / network */
      }
    }
    connect();

    const poll = setInterval(load, 60000);
    return () => {
      cancelled = true;
      controller.abort();
      clearInterval(poll);
    };
  }, [load]);

  async function advancePhase() {
    const focus = data?.focus;
    if (!focus?.shoot?.id || !focus.primaryPhase) return;
    setBusy(true);
    setError('');
    try {
      const result = await api(`/shoots/${focus.shoot.id}/phases/${focus.primaryPhase}`, {
        method: 'POST',
      });
      setMessage(result.message);
      setFlash(true);
      setTimeout(() => setFlash(false), 700);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!data && !error) {
    return <BrandMark size="loading" className="animate-pulse-glow" />;
  }

  if (error && !data) {
    return <p className="text-red-300">{error}</p>;
  }

  if (data.surface === 'my_cue') {
    return (
      <OperatorToday
        data={data}
        flash={flash}
        busy={busy}
        error={error}
        message={message}
        onClearMessage={() => setMessage(null)}
        onAdvance={advancePhase}
        user={user}
      />
    );
  }
  if (data.surface === 'coverage') {
    return <StandbyToday data={data} />;
  }
  if (data.surface === 'gaps') {
    return <AdminToday data={data} />;
  }
  return (
    <div className="animate-rise-in">
      <BrandMark size="lg" />
      <BrandSubline className="mt-3" />
      <h1 className="mt-4 font-display text-3xl font-bold text-mist">{data.headline}</h1>
      <p className="mt-2 text-mist-muted">{data.message}</p>
      <Link
        to="/pay"
        className="touch-target mt-8 inline-flex items-center bg-lime px-5 py-3 font-display text-sm font-bold text-ink-950"
      >
        Open Pay
      </Link>
    </div>
  );
}

function OperatorToday({ data, flash, busy, error, message, onClearMessage, onAdvance, user }) {
  const focus = data.focus;

  return (
    <div>
      {/* First viewport: brand + next shoot only */}
      <section className="flex min-h-[min(78vh,calc(100dvh-8rem))] flex-col justify-center pb-10">
        <BrandMark size="lg" />
        <BrandSubline className="mt-3" />
        <p className="mt-2 text-sm uppercase tracking-[0.28em] text-mist-muted">{data.headline}</p>

        {!focus ? (
          <div className="mt-14 max-w-lg animate-rise-in">
            <h1 className="font-display text-3xl font-bold text-mist">No shoot on your cue</h1>
            <p className="mt-3 text-mist-muted">
              Claim a slot on the Board when you&apos;re ready for the next window.
            </p>
            <Link
              to="/board"
              className="touch-target mt-8 inline-flex items-center bg-lime px-5 py-3 font-display text-sm font-bold text-ink-950"
            >
              Open Board
            </Link>
          </div>
        ) : (
          <div className={`mt-10 max-w-xl animate-rise-in sm:mt-12 ${flash ? 'animate-phase-flash' : ''}`}>
            <p className="font-mono text-xs uppercase tracking-widest text-mist-muted">
              {focus.shoot.client} · {focus.shoot.gameTime}
            </p>
            <h1 className="mt-2 font-display text-3xl font-bold leading-tight text-mist md:text-4xl">
              {focus.shoot.title}
            </h1>
            <p className="mt-2 text-mist-muted">{focus.shoot.location}</p>

            <div className="mt-8">
              <Countdown targetIso={focus.countdownTarget} />
            </div>

            {focus.primaryPhase ? (
              <button
                type="button"
                disabled={busy}
                onClick={onAdvance}
                className="touch-target mt-10 w-full bg-lime py-4 font-display text-base font-bold tracking-wide text-ink-950 transition hover:bg-lime-glow disabled:opacity-60 md:w-auto md:min-w-[280px]"
              >
                {busy ? 'Updating…' : `Advance · ${focus.primaryLabel}`}
              </button>
            ) : (
              <p className="mt-10 font-display text-lime">All phases complete</p>
            )}

            {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
            {message && (
              <div className="mt-4">
                <PhaseMessage message={message} onClose={onClearMessage} />
              </div>
            )}
            <p className="mt-6 text-xs text-mist-muted">Signed in as {user.fullName}</p>
          </div>
        )}
      </section>

      {/* Below the fold: rig recipe */}
      {focus?.shoot?.rig && (
        <section className="border-t border-ink-700/60 pb-8 pt-12">
          <h2 className="font-display text-xl font-bold text-mist">Rig recipe</h2>
          <p className="mt-1 text-sm text-mist-muted">House settings for {focus.shoot.client}</p>
          <div className="mt-6">
            <RigRecipe rig={focus.shoot.rig} />
          </div>
          {data.later?.length > 0 && (
            <div className="mt-10">
              <h3 className="text-xs uppercase tracking-widest text-mist-muted">Later today</h3>
              <ul className="mt-3 space-y-2">
                {data.later.map((s) => (
                  <li key={s.id} className="flex justify-between border-b border-ink-700/50 py-2 text-sm">
                    <span>{s.title}</span>
                    <span className="font-mono text-mist-muted">{s.gameTime}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function StandbyToday({ data }) {
  return (
    <div className="animate-rise-in">
      <BrandMark size="lg" />
      <BrandSubline className="mt-3" />
      <h1 className="mt-4 font-display text-3xl font-bold text-mist">{data.headline}</h1>
      <p className="mt-2 text-mist-muted">
        {data.quota.covered}/{data.quota.total} covered · {data.quota.gaps} gaps · {data.quota.pending} pending
      </p>

      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-widest text-mist-muted">Window</h2>
        <ul className="mt-3 divide-y divide-ink-700/50">
          {data.windowShoots.map((s) => (
            <li key={s.id} className="flex items-baseline justify-between gap-3 py-3">
              <div>
                <p className="font-medium text-mist">{s.title}</p>
                <p className="text-xs text-mist-muted">
                  {s.assignedOperators.length
                    ? s.assignedOperators.join(', ')
                    : s.pendingOperators.length
                      ? `Pending: ${s.pendingOperators.join(', ')}`
                      : 'Unassigned'}
                </p>
              </div>
              <span className="shrink-0 font-mono text-sm text-lime">{s.gameTime}</span>
            </li>
          ))}
        </ul>
      </section>

      {data.gaps?.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xs uppercase tracking-widest text-mist-muted">Gaps</h2>
          <ul className="mt-3 space-y-2">
            {data.gaps.map((s, i) => (
              <li
                key={s.id}
                className="animate-rise-in border-l-2 border-lime pl-3 text-sm"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                {s.title} · {s.gameTime}
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.rigTestsDue?.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xs uppercase tracking-widest text-mist-muted">Rig tests due</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {data.rigTestsDue.map((t) => (
              <li key={t.id}>
                {t.title} · due {t.dueDate || t.scheduledDate}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function AdminToday({ data }) {
  const ex = data.exceptions;
  const sections = [
    {
      key: 'unassigned',
      title: 'Unassigned tonight',
      items: ex.unassignedTonight.map((s) => `${s.title} · ${s.gameTime}`),
    },
    {
      key: 'overcap',
      title: 'Over-cap pendings',
      items: ex.overCapPendings.map((o) => `${o.name || o.email} · ${o.count} pre-approved`),
    },
    {
      key: 'stuck',
      title: 'Stuck phases',
      items: ex.stuckPhases.map((s) => `${s.title} · next ${s.nextPhase}`),
    },
    {
      key: 'rig',
      title: 'Missing rig checks',
      items: ex.missingRigChecks.map((t) => `${t.title} · ${t.dueDate}`),
    },
  ];

  return (
    <div className="animate-rise-in">
      <BrandMark size="lg" />
      <BrandSubline className="mt-3" />
      <h1 className="mt-4 font-display text-3xl font-bold text-mist">{data.headline}</h1>
      <p className="mt-2 text-mist-muted">Exceptions only — quiet when the shift is clean.</p>

      <div className="mt-12 space-y-10">
        {sections.map((sec) => (
          <section key={sec.key}>
            <h2 className="text-xs uppercase tracking-widest text-mist-muted">{sec.title}</h2>
            {sec.items.length === 0 ? (
              <p className="mt-3 text-sm text-mist-muted/70">None</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {sec.items.map((text, i) => (
                  <li
                    key={`${sec.key}-${i}`}
                    className="animate-rise-in border-l-2 border-lime/80 pl-3 text-sm text-mist"
                    style={{ animationDelay: `${i * 70}ms` }}
                  >
                    {text}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
