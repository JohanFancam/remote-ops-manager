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
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-[42%] relative overflow-hidden bg-zinc-900 text-zinc-900 flex-col justify-between p-10">
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 20%, rgba(15,118,110,0.55), transparent 45%), radial-gradient(circle at 80% 70%, rgba(255,255,255,0.08), transparent 40%)',
          }}
        />
        <div className="relative">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-teal-600 flex items-center justify-center">
              <Wifi className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-semibold tracking-tight">Remote Ops</p>
              <p className="text-xs text-zinc-400">Manager</p>
            </div>
          </div>
        </div>
        <div className="relative max-w-sm rom-enter">
          <h1 className="text-3xl font-semibold tracking-tight leading-snug">
            Run shoots with a quieter, clearer console.
          </h1>
          <p className="mt-4 text-sm text-zinc-400 leading-relaxed">
            Schedule, assign, and track remote crews without the Base44 scaffolding — just your ops, locally.
          </p>
        </div>
        <p className="relative text-xs text-zinc-500">Standalone web app · Express + SQLite</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-[380px] rom-enter-delay">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-lg bg-teal-700 flex items-center justify-center">
              <Wifi className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-semibold text-zinc-900 tracking-tight">Remote Ops</p>
              <p className="text-xs text-zinc-400">Manager</p>
            </div>
          </div>

          <h2 className="text-2xl font-semibold tracking-tight text-zinc-900">Sign in</h2>
          <p className="text-sm text-zinc-500 mt-1 mb-8">Use your crew account to continue.</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Email</label>
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
              <label className="block text-xs font-medium text-zinc-500 mb-1.5">Password</label>
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
              <div className="rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="rom-btn-primary w-full">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-sm text-zinc-500 mt-6">
            New here?{' '}
            <Link to="/register" className="text-teal-700 hover:text-teal-800 font-medium">
              Create an account
            </Link>
          </p>

          <div className="mt-8 rounded-lg border border-zinc-200 bg-white/70 p-3 text-xs text-zinc-500">
            <p className="font-medium text-zinc-600 mb-1">Demo</p>
            <p>admin@example.com / admin123</p>
            <p>operator@example.com / operator123</p>
          </div>
        </div>
      </div>
    </div>
  );
}
