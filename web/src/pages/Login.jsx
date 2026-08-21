import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth, homePath } from '../lib/auth.jsx';
import BrandMark, { BrandSubline } from '../components/BrandMark.jsx';

const DEMOS = [
  { email: 'operator@rom.demo', label: 'Remote' },
  { email: 'admin@rom.demo', label: 'Admin' },
  { email: 'accounts@rom.demo', label: 'Account' },
];

export default function Login() {
  const { user, login } = useAuth();
  const [email, setEmail] = useState('operator@rom.demo');
  const [password, setPassword] = useState('rom123');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [dest, setDest] = useState(null);

  if (user && !dest) return <Navigate to={homePath(user)} replace />;
  if (dest) return <Navigate to={dest} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await login(email, password);
      setDest(data.homePath || homePath(data.user));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rom-shell rom-grain flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md animate-rise-in">
        <BrandMark size="lg" />
        <BrandSubline className="mt-3 mb-2" />
        <p className="mb-8 text-mist-muted">
          Manage remote photographers, shoots, standby, and earnings.
        </p>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-mist-muted">Email</span>
            <input
              className="w-full border border-ink-600 bg-ink-900/80 px-3 py-3.5 text-mist outline-none focus:border-blue"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs uppercase tracking-wider text-mist-muted">Password</span>
            <input
              type="password"
              className="w-full border border-ink-600 bg-ink-900/80 px-3 py-3.5 text-mist outline-none focus:border-blue"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error && <p className="text-sm text-red-300">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="touch-target w-full bg-blue py-3.5 font-display text-sm font-bold text-white hover:bg-blue-deep disabled:opacity-60"
          >
            {busy ? 'Signing in…' : 'Enter shift'}
          </button>
        </form>
        <div className="mt-8 flex flex-wrap gap-2">
          {DEMOS.map((d) => (
            <button
              key={d.email}
              type="button"
              className="touch-target border border-ink-600 px-3 py-2 text-xs text-mist-muted hover:border-blue/40"
              onClick={() => {
                setEmail(d.email);
                setPassword('rom123');
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
