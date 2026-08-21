import { useEffect, useState } from 'react';

function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function formatCountdown(ms) {
  if (ms == null) return '—';
  if (ms <= 0) return 'NOW';
  const days = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${days > 0 ? `${days}d ` : ''}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function DashboardBanner({ standby, nextShoot, currentUser }) {
  const now = useClock();
  const current = standby?.current || [];
  const next = standby?.next || null;
  const iAmOnStandby = current.some(
    (e) => e.adminEmail === currentUser?.email || e.adminId === currentUser?.id
  );

  let nextMs = null;
  if (nextShoot?.date) {
    const t = nextShoot.setupTime || nextShoot.gameTime || '19:00';
    nextMs = new Date(`${nextShoot.date}T${t}:00`).getTime() - now.getTime();
  }

  return (
    <div className="animate-rise-in border border-ink-600/80 bg-ink-900/55 px-4 py-4 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700/60 pb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-mist-muted">
          {now.toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
        <p className="font-mono text-sm tracking-widest text-mist">
          {now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </p>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300/90">
            Standby
          </p>
          {current.length > 0 ? (
            <div className="mt-2 space-y-1">
              {iAmOnStandby && (
                <p className="text-sm font-semibold text-amber-200">You are on standby</p>
              )}
              {current.map((e) => (
                <p key={e.id} className="text-sm text-mist">
                  {e.adminName}
                  {e.adminEmail === currentUser?.email ? ' (you)' : ''}
                  <span className="text-mist-muted">
                    {' '}
                    · until {e.endDate} {e.endTime}
                  </span>
                </p>
              ))}
            </div>
          ) : next ? (
            <p className="mt-2 text-sm text-mist">
              Next: <span className="text-mist">{next.adminName}</span>
              <span className="text-mist-muted">
                {' '}
                · {next.startDate} {next.startTime}
              </span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-mist-muted">No standby scheduled</p>
          )}
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-bright">
            Next shoot
          </p>
          {nextShoot ? (
            <div className="mt-2">
              <p className="font-display text-lg font-bold text-mist">
                {nextShoot.teamName || nextShoot.title}
              </p>
              <p className="text-sm text-mist-muted">
                {nextShoot.date} · {nextShoot.gameTime}
                {nextShoot.venue ? ` · ${nextShoot.venue}` : ''}
              </p>
              <p className="mt-1 font-mono text-sm text-blue-bright">{formatCountdown(nextMs)}</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-mist-muted">No upcoming assigned shoot</p>
          )}
        </div>
      </div>
    </div>
  );
}
