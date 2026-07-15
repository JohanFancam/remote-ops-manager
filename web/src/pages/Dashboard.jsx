import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import BrandMark, { BrandSubline } from '../components/BrandMark.jsx';
import ShootCard from '../components/ShootCard.jsx';
import CompleteModal from '../components/CompleteModal.jsx';

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [completeShoot, setCompleteShoot] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await api('/dashboard'));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, [load]);

  async function advance(shoot, status) {
    if (status === 'completed') {
      setCompleteShoot(shoot);
      return;
    }
    try {
      await api(`/shoots/${shoot.id}/status`, {
        method: 'POST',
        body: { status },
      });
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function confirmComplete() {
    if (!completeShoot) return;
    try {
      await api(`/shoots/${completeShoot.id}/status`, {
        method: 'POST',
        body: { status: 'completed', confirmComplete: true },
      });
      setCompleteShoot(null);
      await load();
    } catch (err) {
      setError(err.message);
    }
  }

  if (!data && !error) {
    return <BrandMark size="loading" className="animate-pulse-soft" />;
  }
  if (error && !data) return <p className="text-red-300">{error}</p>;

  return (
    <div className="animate-rise-in">
      <BrandMark size="lg" />
      <BrandSubline className="mt-2" />
      <h1 className="mt-4 font-display text-2xl font-bold text-mist md:text-3xl">{data.welcome}</h1>
      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}

      <section className="mt-8">
        <h2 className="text-xs uppercase tracking-widest text-mist-muted">Current / next shoot</h2>
        {data.focus ? (
          <div className="mt-3">
            <ShootCard
              shoot={data.focus}
              emphasized
              onAdvance={advance}
              canAdvance
            />
          </div>
        ) : (
          <p className="mt-3 text-mist-muted">No assigned shoot on cue.</p>
        )}
      </section>

      {data.role === 'operator' && (
        <>
          {data.pending?.length > 0 && (
            <section className="mt-10">
              <h2 className="text-xs uppercase tracking-widest text-mist-muted">Pending approval</h2>
              <ul className="mt-3 space-y-3">
                {data.pending.map((s) => (
                  <li key={s.id}>
                    <ShootCard shoot={s} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section className="mt-10">
            <h2 className="text-xs uppercase tracking-widest text-mist-muted">Earnings summary</h2>
            <p className="mt-2 font-mono text-2xl text-blue-bright">
              {data.earningsSummary.currency} {data.earningsSummary.total}
            </p>
            <p className="text-sm text-mist-muted">
              {data.earningsSummary.month} · {data.earningsSummary.shootCount} shoots
              {data.earningsSummary.paid ? ' · paid' : ' · unpaid'}
            </p>
            <Link to="/earnings" className="mt-3 inline-block text-sm text-blue-bright">
              View earnings →
            </Link>
          </section>
        </>
      )}

      {data.role === 'admin' && (
        <>
          <section className="mt-10">
            <h2 className="text-xs uppercase tracking-widest text-mist-muted">Monthly summary</h2>
            <p className="mt-2 text-mist">
              {data.monthlySummary.month}: {data.monthlySummary.total} shoots
            </p>
            <p className="text-sm text-mist-muted">
              {Object.entries(data.monthlySummary.byStatus || {})
                .map(([k, v]) => `${k} ${v}`)
                .join(' · ') || 'No data'}
            </p>
          </section>

          <section className="mt-10">
            <h2 className="text-xs uppercase tracking-widest text-mist-muted">Rig tests</h2>
            <p className="mt-2 text-sm text-mist-muted">{data.rigTestSummary.message}</p>
          </section>

          {data.assignmentNotifications?.length > 0 && (
            <section className="mt-10">
              <h2 className="text-xs uppercase tracking-widest text-mist-muted">Assignment requests</h2>
              <ul className="mt-3 space-y-2">
                {data.assignmentNotifications.map((n) => (
                  <li key={n.assignmentId} className="border-l-2 border-blue pl-3 text-sm">
                    <p className="text-mist">
                      {n.operatorName} → {n.title}
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Action
                        label="Approve"
                        onClick={async () => {
                          await api('/assignments/approve', {
                            method: 'POST',
                            body: { shootId: n.shootId, operatorId: n.operatorId },
                          });
                          load();
                        }}
                      />
                      <Action
                        label="Reject"
                        secondary
                        onClick={async () => {
                          await api('/assignments/reject', {
                            method: 'POST',
                            body: { shootId: n.shootId, operatorId: n.operatorId },
                          });
                          load();
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="mt-10">
            <h2 className="text-xs uppercase tracking-widest text-mist-muted">Presence</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {(data.presence || []).map((p) => (
                <li key={p.id} className="flex items-center gap-2 text-sm">
                  <span className={`h-2 w-2 rounded-full ${p.online ? 'bg-emerald-400' : 'bg-ink-600'}`} />
                  <span className="text-mist">{p.fullName}</span>
                  <span className="text-xs text-mist-muted">{p.role}</span>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-widest text-mist-muted">Assigned shoots</h2>
        <ul className="mt-3 space-y-3">
          {(data.assigned || [])
            .filter((s) => !data.focus || s.id !== data.focus.id)
            .map((s) => (
              <li key={s.id}>
                <ShootCard shoot={s} onAdvance={advance} canAdvance />
              </li>
            ))}
          {(data.assigned || []).length <= 1 && !data.focus && (
            <li className="text-sm text-mist-muted">None</li>
          )}
        </ul>
      </section>

      {data.notifications?.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xs uppercase tracking-widest text-mist-muted">Notifications</h2>
          <ul className="mt-3 space-y-2">
            {data.notifications.slice(0, 8).map((n) => (
              <li key={n.id} className="border-b border-ink-700/40 py-2 text-sm">
                <p className="text-mist">{n.title}</p>
                <p className="text-xs text-mist-muted">{n.message}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {completeShoot && (
        <CompleteModal
          shoot={completeShoot}
          onConfirm={confirmComplete}
          onCancel={() => setCompleteShoot(null)}
        />
      )}
    </div>
  );
}

function Action({ label, onClick, secondary }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`touch-target px-3 py-1.5 text-xs font-semibold ${
        secondary ? 'border border-ink-600 text-mist-muted' : 'bg-blue text-white'
      }`}
    >
      {label}
    </button>
  );
}
