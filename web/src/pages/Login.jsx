import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
import BrandMark, { BrandSubline } from '../components/BrandMark.jsx';

const DEMOS = [
  { email: 'operator@rom.demo', label: 'Operator' },
  { email: 'admin@rom.demo', label: 'Admin' },
  { email: 'standby@rom.demo', label: 'Standby' },
  { email: 'accounts@rom.demo', label: 'Accounts' },
];

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('operator@rom.demo');
  const [password, setPassword] = useState('rom123');
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
    <div className="rom-atmosphere rom-grain flex min-h-dvh items-center justify-center px-4 py-[max(1.5rem,env(safe-area-inset-top))]">
      <div className="rom-content w-full max-w-md pb-[max(1rem,env(safe-area-inset-bottom))]">
        <BrandMark size="lg" className="mb-2" />
        <BrandSubline className="mb-3" />
        <p className="mb-10 max-w-sm text-mist-muted">
          Shift console for remote sports-camera crews — organized by time and role.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-mist-muted">Email</span>
            <input
              className="w-full border border-ink-600 bg-ink-900/70 px-3 py-3.5 font-body text-base text-mist outline-none transition focus:border-lime/50 md:text-sm"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              inputMode="email"
              enterKeyHint="next"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-mist-muted">Password</span>
            <input
              type="password"
              className="w-full border border-ink-600 bg-ink-900/70 px-3 py-3.5 font-body text-base text-mist outline-none transition focus:border-lime/50 md:text-sm"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              enterKeyHint="go"
            />
          </label>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="touch-target w-full bg-lime py-3.5 font-display text-sm font-bold tracking-wide text-ink-950 transition hover:bg-lime-glow disabled:opacity-60"
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
                setPassword('rom123');
              }}
              className="touch-target border border-ink-600 px-3 py-2 text-xs text-mist-muted transition hover:border-lime/40 hover:text-mist"
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
