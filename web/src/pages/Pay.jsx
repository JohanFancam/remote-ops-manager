import { useCallback, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth.jsx';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export default function Pay() {
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonth);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const blocked = user.role === 'standby';

  const load = useCallback(async () => {
    if (blocked) return;
    try {
      const payload = await api(`/pay?month=${month}`);
      setData(payload);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [month, blocked]);

  useEffect(() => {
    load();
  }, [load]);

  if (blocked) {
    return <Navigate to="/" replace />;
  }

  async function markPaid(operatorEmail, recordIds) {
    setBusy(true);
    try {
      const result = await api('/pay/mark-paid', {
        method: 'POST',
        body: recordIds?.length
          ? { recordIds, periodMonth: month }
          : { periodMonth: month, operatorEmail },
      });
      setData(result.pay);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-mist">Pay</h1>
          <p className="mt-1 text-sm text-mist-muted">
            {data?.mode === 'settle' ? 'Settle operator earnings' : 'Your earnings'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="border border-ink-600 px-3 py-2 text-sm text-mist-muted"
            onClick={() => setMonth((m) => shiftMonth(m, -1))}
          >
            Prev
          </button>
          <span className="font-mono text-sm text-lime">{month}</span>
          <button
            type="button"
            className="border border-ink-600 px-3 py-2 text-sm text-mist-muted"
            onClick={() => setMonth((m) => shiftMonth(m, 1))}
          >
            Next
          </button>
        </div>
      </div>

      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}

      {!data ? (
        <p className="mt-10 text-mist-muted">Loading…</p>
      ) : data.mode === 'earnings' ? (
        <EarningsView data={data} />
      ) : (
        <SettleView data={data} busy={busy} onMarkPaid={markPaid} />
      )}
    </div>
  );
}

function EarningsView({ data }) {
  return (
    <div className="mt-10 animate-rise-in">
      <div className="flex flex-wrap gap-8 border-t border-ink-600 pt-6">
        <Stat label="Unpaid" value={data.unpaid} />
        <Stat label="Paid" value={data.paid} />
        <Stat label="Total" value={data.total} accent />
      </div>
      <ul className="mt-10 divide-y divide-ink-700/50">
        {data.lines.map((line) => (
          <li key={line.id} className="flex items-baseline justify-between gap-3 py-3 text-sm">
            <div>
              <p className="text-mist">{line.title}</p>
              <p className="text-xs text-mist-muted">
                {line.date}
                {line.isAdditional ? ' · additional' : ''}
                {line.paid ? ` · paid ${line.paidDate}` : ''}
              </p>
            </div>
            <span className={`font-mono ${line.paid ? 'text-mist-muted' : 'text-lime'}`}>
              ${line.fee}
            </span>
          </li>
        ))}
        {data.lines.length === 0 && (
          <li className="py-8 text-sm text-mist-muted">No earnings this month yet.</li>
        )}
      </ul>
    </div>
  );
}

function SettleView({ data, busy, onMarkPaid }) {
  return (
    <div className="mt-10 space-y-10">
      {data.operators.map((op) => (
        <section key={op.email} className="animate-rise-in border-t border-ink-600 pt-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-bold text-mist">{op.name || op.email}</h2>
              <p className="text-xs text-mist-muted">{op.email}</p>
            </div>
            <div className="flex items-center gap-4">
              <p className="font-mono text-sm text-mist-muted">
                unpaid <span className="text-lime">${op.unpaid}</span>
              </p>
              {op.unpaid > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onMarkPaid(op.email)}
                  className="bg-lime px-3 py-2 font-display text-xs font-bold text-ink-950 disabled:opacity-60"
                >
                  Mark paid
                </button>
              )}
            </div>
          </div>
          <ul className="mt-4 divide-y divide-ink-700/40">
            {op.lines.map((line) => (
              <li key={line.id} className="flex justify-between py-2 text-sm">
                <span className="text-mist-muted">
                  {line.date} · {line.title}
                  {line.isAdditional ? ' · add' : ''}
                </span>
                <span className={`font-mono ${line.paid ? 'text-mist-muted line-through' : 'text-mist'}`}>
                  ${line.fee}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {data.operators.length === 0 && (
        <p className="text-sm text-mist-muted">No pay lines for this month.</p>
      )}
    </div>
  );
}

function Stat({ label, value, accent }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-widest text-mist-muted">{label}</p>
      <p className={`mt-1 font-mono text-3xl ${accent ? 'text-lime' : 'text-mist'}`}>
        ${value}
      </p>
    </div>
  );
}
