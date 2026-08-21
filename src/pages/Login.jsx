import React, { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Wifi } from 'lucide-react';

export default function Login() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = params.get('next') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (isAuthenticated) navigate(next, { replace: true });
  }, [isAuthenticated, navigate, next]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate(next, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="rom-ambient absolute -top-24 -left-16 h-[28rem] w-[28rem] rounded-full bg-blue-500/20 blur-3xl" />
        <div className="rom-ambient absolute bottom-0 right-0 h-[22rem] w-[22rem] rounded-full bg-sky-400/10 blur-3xl" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative w-full max-w-5xl grid lg:grid-cols-[1.1fr_0.9fr] gap-8 lg:gap-12 items-center">
        <div className="hidden lg:block rom-enter">
          <div className="flex items-center gap-3 mb-10">
            <div className="rom-mark h-11 w-11">
              <Wifi className="w-5 h-5" />
            </div>
            <div>
              <p className="rom-brand text-lg text-slate-50">Remote Ops</p>
              <p className="text-xs text-slate-500 tracking-wide">Signal desk</p>
            </div>
          </div>
          <p className="rom-kicker mb-4">Crew console</p>
          <h1 className="rom-title max-w-md leading-[1.05]">
            A quieter night desk for remote shoots.
          </h1>
          <p className="mt-5 max-w-md text-slate-400 leading-relaxed">
            Assign operators, watch phases, and keep standby coverage in one place — rebuilt outside Base44.
          </p>
          <div className="mt-10 flex items-center gap-6 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2"><span className="rom-live-dot" /> Live sync</span>
            <span>JWT auth</span>
            <span>Local SQLite</span>
          </div>
        </div>

        <div className="rom-panel rom-enter-delay w-full max-w-md mx-auto lg:mx-0 p-7 md:p-8">
          <div className="lg:hidden flex items-center gap-2.5 mb-7">
            <div className="rom-mark h-9 w-9">
              <Wifi className="w-4 h-4" />
            </div>
            <div>
              <p className="rom-brand text-slate-50">Remote Ops</p>
              <p className="text-xs text-slate-500">Signal desk</p>
            </div>
          </div>

          <h2 className="rom-brand text-2xl text-slate-50">Sign in</h2>
          <p className="text-sm text-slate-500 mt-1 mb-7">Continue to your crew workspace.</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Email</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rom-input"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1.5">Password</label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rom-input"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-800/80 bg-red-950/40 text-red-400 text-sm px-3 py-2">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="rom-btn-primary w-full">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            New here?{' '}
            <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium">
              Create an account
            </Link>
          </p>

          <div className="mt-7 rounded-xl border border-[color:var(--rom-line)] bg-[#070d1c]/80 p-3 text-xs text-slate-500 rom-mono">
            <p className="font-medium text-slate-400 mb-1 font-sans">Demo</p>
            <p>admin@example.com / admin123</p>
            <p>operator@example.com / operator123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
