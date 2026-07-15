import { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

export default function AccountsPage() {
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);

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
    const id = setInterval(load, 20000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  async function markPaid(op) {
    const useToday = window.confirm('Use today\'s date? Cancel to enter a custom date.');
    let paidDate = new Date().toISOString().slice(0, 10);
    if (!useToday) {
      const custom = window.prompt('Paid date (YYYY-MM-DD)', paidDate);
      if (!custom) return;
      paidDate = custom;
    }
    setBusy(true);
    try {
      const result = await api('/pay/mark-paid', {
        method: 'POST',
        body: { operatorId: op.operatorId, periodMonth: month, paidDate },
      });
      setData(result.pay);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function markUnpaid(op) {
    setBusy(true);
    try {
      const result = await api('/pay/mark-unpaid', {
        method: 'POST',
        body: { operatorId: op.operatorId, periodMonth: month },
      });
      setData(result.pay);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function saveNote(op) {
    const note = window.prompt('Accounts note', op.note || '');
    if (note === null) return;
    await api('/pay/note', {
      method: 'POST',
      body: { operatorId: op.operatorId, periodMonth: month, note },
    });
    load();
  }

  return (
    <div className="animate-rise-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold text-mist">Accounts</h1>
          <p className="font-mono text-sm text-mist-muted">
            {now.toLocaleDateString()} · {now.toLocaleTimeString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" className="border border-ink-600 px-3 py-2 text-sm" onClick={() => setMonth((m) => shiftMonth(m, -1))}>
            Prev
          </button>
          <span className="font-mono text-blue-bright">{month}</span>
          <button type="button" className="border border-ink-600 px-3 py-2 text-sm" onClick={() => setMonth((m) => shiftMonth(m, 1))}>
            Next
          </button>
          <button type="button" className="border border-ink-600 px-3 py-2 text-sm" onClick={load}>
            Refresh
          </button>
          <a
            href={`/api/pay/export.csv?month=${month}`}
            className="bg-blue px-3 py-2 text-sm font-semibold text-white"
            onClick={async (e) => {
              e.preventDefault();
              const token = localStorage.getItem('rom_token');
              const res = await fetch(`/api/pay/export.csv?month=${month}`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              const blob = await res.blob();
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `Earnings_${month}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            CSV
          </a>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      {!data ? (
        <p className="mt-8 text-mist-muted">Loading…</p>
      ) : (
        <>
          <div className="mt-8 flex flex-wrap gap-8 border-t border-ink-600 pt-5">
            <Stat label="Payable" value={`${data.currency || 'ZAR'} ${data.monthlyTotal}`} />
            <Stat label="Operators" value={data.operatorCount} />
            <Stat label="Paid" value={data.paidCount} />
            <Stat label="Unpaid" value={data.unpaidCount} />
          </div>

          {!data.canSettle && (
            <p className="mt-4 text-sm text-mist-muted">View only — Accounts role required to settle.</p>
          )}

          <ul className="mt-8 space-y-6">
            {(data.operators || []).map((op) => (
              <li key={op.operatorId} className="border-t border-ink-700 pt-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h2 className="font-display text-xl font-bold text-mist">
                      {op.fullName}
                      {!op.active && (
                        <span className="ml-2 text-xs font-normal uppercase text-mist-muted">inactive</span>
                      )}
                    </h2>
                    <p className="text-xs text-mist-muted">{op.email}</p>
                    <p className="mt-1 font-mono text-sm text-blue-bright">
                      {op.shootCount} shoots · {data.currency} {op.amount}
                      {op.paid ? ` · paid ${op.paidDate}` : ' · unpaid'}
                    </p>
                    {op.note && <p className="mt-1 text-xs text-mist-muted">Note: {op.note}</p>}
                  </div>
                  {data.canSettle && (
                    <div className="flex flex-wrap gap-2">
                      {!op.paid ? (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => markPaid(op)}
                          className="bg-blue px-3 py-2 text-xs font-bold text-white disabled:opacity-60"
                        >
                          Mark paid
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => markUnpaid(op)}
                          className="border border-ink-600 px-3 py-2 text-xs"
                        >
                          Mark unpaid
                        </button>
                      )}
                      <button type="button" onClick={() => saveNote(op)} className="border border-ink-600 px-3 py-2 text-xs">
                        Note
                      </button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-widest text-mist-muted">{label}</p>
      <p className="mt-1 font-mono text-2xl text-mist">{value}</p>
    </div>
  );
}
