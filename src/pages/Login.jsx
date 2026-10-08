import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import AuthBackdrop from '@/components/auth/AuthBackdrop';
import BrandMark from '@/components/brand/BrandMark';
import AppIconHead from '@/components/brand/AppIconHead';
import { homePathForUser } from '@/utils/homePath';

export default function Login() {
  const { login, isAuthenticated, user, appPublicSettings } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (isAuthenticated) navigate(homePathForUser(user), { replace: true });
  }, [isAuthenticated, navigate, user]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const currentUser = await login(email.trim(), password);
      navigate(homePathForUser(currentUser), { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4 sm:p-6">
      <AppIconHead logoUrl={appPublicSettings?.public_settings?.app_logo_url} />
      <AuthBackdrop />

      <div className="relative w-full max-w-5xl grid lg:grid-cols-[1.1fr_0.9fr] gap-8 lg:gap-12 items-center">
        <div className="hidden lg:block rom-enter">
          <div className="flex items-center gap-3 mb-10">
            <BrandMark className="h-11 w-11" />
            <div>
              <p className="rom-brand text-lg text-slate-50">Remote Ops</p>
              <p className="text-xs text-slate-500 tracking-wide">Operations portal</p>
            </div>
          </div>
          <p className="rom-kicker mb-4">Operations portal</p>
          <h1 className="rom-title max-w-md leading-[1.05]">
            The portal for remote operators, standby, and scheduling.
          </h1>
          <p className="mt-5 max-w-md text-slate-400 leading-relaxed">
            Assign operators, cover standby windows, and keep the shoot calendar in one managing tool.
          </p>
          <div className="mt-10 flex items-center gap-6 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2"><span className="rom-live-dot" /> Live sync</span>
            <span>JWT auth</span>
            <span>Local SQLite</span>
          </div>
        </div>

        <div className="rom-panel rom-enter-delay w-full max-w-md mx-auto lg:mx-0 p-7 md:p-8">
          <div className="lg:hidden flex items-center gap-2.5 mb-7">
            <BrandMark className="h-9 w-9" />
            <div>
              <p className="rom-brand text-slate-50">Remote Ops</p>
              <p className="text-xs text-slate-500">Operations portal</p>
            </div>
          </div>

          <h2 className="rom-brand text-2xl text-slate-50">Sign in</h2>
          <p className="text-sm text-slate-500 mt-1 mb-7">Continue to your operations portal.</p>

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
            New remote operator?{' '}
            <Link to="/register" className="text-orange-400 hover:text-orange-300 font-medium">
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
