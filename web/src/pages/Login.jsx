import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';

const DEMOS = [
  { email: 'operator@cueboard.demo', label: 'Operator' },
  { email: 'admin@cueboard.demo', label: 'Admin' },
  { email: 'standby@cueboard.demo', label: 'Standby' },
  { email: 'accounts@cueboard.demo', label: 'Accounts' },
];

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('operator@cueboard.demo');
  const [password, setPassword] = useState('cueboard123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cue-atmosphere cue-grain flex min-h-screen items-center justify-center px-4">
      <div className="cue-content w-full max-w-md">
        <p className="mb-2 font-display text-5xl font-extrabold tracking-[0.12em] text-lime md:text-6xl">
          CUEBOARD
        </p>
        <p className="mb-10 max-w-sm text-mist-muted">
          Shift console for remote sports-camera crews — organized by time and role.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-mist-muted">Email</span>
            <input
              className="w-full border border-ink-600 bg-ink-900/70 px-3 py-3 font-body text-mist outline-none transition focus:border-lime/50"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-mist-muted">Password</span>
            <input
              type="password"
              className="w-full border border-ink-600 bg-ink-900/70 px-3 py-3 font-body text-mist outline-none transition focus:border-lime/50"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-lime py-3 font-display text-sm font-bold tracking-wide text-ink-950 transition hover:bg-lime-glow disabled:opacity-60"
          >
            {busy ? 'Signing in…' : 'Enter shift'}
          </button>
        </form>

        <div className="mt-8 flex flex-wrap gap-2">
          {DEMOS.map((d) => (
            <button
              key={d.email}
              type="button"
              onClick={() => {
                setEmail(d.email);
                setPassword('cueboard123');
              }}
              className="border border-ink-600 px-2.5 py-1 text-xs text-mist-muted transition hover:border-lime/40 hover:text-mist"
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
