import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export default function EarningsPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await api(`/pay?month=${month}`));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-mist">Earnings</h1>
          <p className="text-sm text-mist-muted">Your qualifying shoots only</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="border border-ink-600 px-3 py-2 text-sm" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
            Prev
          </button>
          <span className="font-mono text-blue-bright">{month}</span>
          <button type="button" className="border border-ink-600 px-3 py-2 text-sm" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
            Next
          </button>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      {!data ? (
        <p className="mt-8 text-mist-muted">Loading…</p>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap gap-8 border-t border-ink-600 pt-5">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-mist-muted">Total</p>
              <p className="font-mono text-3xl text-blue-bright">
                {data.currency} {data.total}
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-mist-muted">Shoots</p>
              <p className="font-mono text-3xl text-mist">
                {data.normalCount} + {data.additionalCount} add
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest text-mist-muted">Status</p>
              <p className="font-mono text-xl text-mist">
                {data.paid ? `Paid ${data.paidDate}` : 'Unpaid'}
              </p>
            </div>
          </div>
          <ul className="mt-8 divide-y divide-ink-700/50">
            {(data.lines || []).map((line) => (
              <li key={line.shootId} className="flex justify-between py-3 text-sm">
                <div>
                  <p className="text-mist">{line.title}</p>
                  <p className="text-xs text-mist-muted">
                    {line.date}
                    {line.isAdditional ? ' · additional' : ''}
                  </p>
                </div>
                <span className="font-mono text-blue-bright">{line.fee}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
