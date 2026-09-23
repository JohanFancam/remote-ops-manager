import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import AuthBackdrop from '@/components/auth/AuthBackdrop';
import BrandMark from '@/components/brand/BrandMark';

export default function Register() {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register({ email: email.trim(), password, full_name: fullName.trim() });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-6">
      <AuthBackdrop />

      <div className="rom-panel relative w-full max-w-[420px] rom-enter p-7 md:p-8">
        <div className="flex items-center gap-2.5 mb-8">
          <BrandMark className="h-9 w-9" />
          <div>
            <p className="rom-brand text-slate-50">Remote Ops</p>
            <p className="text-xs text-slate-500">Operations portal</p>
          </div>
        </div>

        <h1 className="rom-brand text-2xl text-slate-50">Create account</h1>
        <p className="text-sm text-slate-500 mt-1 mb-7">
          New crew sign up as a remote operator. An admin can change your role later.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="rom-input"
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">Email</label>
            <input
              type="email"
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
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rom-input"
              placeholder="At least 6 characters"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-800/80 bg-red-950/40 text-red-400 text-sm px-3 py-2">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className="rom-btn-primary w-full">
            {loading ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
