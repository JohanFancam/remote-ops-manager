import React from 'react';
import { Wifi } from 'lucide-react';
import { useAuth } from '@/lib/AuthContext';
import ChangePasswordForm from '@/components/auth/ChangePasswordForm';

export default function ChangePassword() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-6">
      <div className="pointer-events-none absolute inset-0">
        <div className="rom-ambient absolute -top-24 -left-16 h-[28rem] w-[28rem] rounded-full bg-blue-500/20 blur-3xl" />
        <div className="rom-ambient absolute bottom-0 right-0 h-[22rem] w-[22rem] rounded-full bg-sky-400/10 blur-3xl" style={{ animationDelay: '2s' }} />
      </div>

      <div className="rom-panel relative w-full max-w-[420px] rom-enter p-7 md:p-8">
        <div className="flex items-center gap-2.5 mb-8">
          <div className="rom-mark h-9 w-9">
            <Wifi className="w-4 h-4" />
          </div>
          <div>
            <p className="rom-brand text-slate-50">Remote Ops</p>
            <p className="text-xs text-slate-500">Signal desk</p>
          </div>
        </div>

        <h1 className="rom-brand text-2xl text-slate-50">Choose a new password</h1>
        <p className="text-sm text-slate-500 mt-1 mb-7">
          You signed in with a generated password
          {user?.email ? ` for ${user.email}` : ''}. Pick one you will remember before continuing.
        </p>

        <ChangePasswordForm
          requireCurrent={false}
          submitLabel="Save and continue"
        />

        <button
          type="button"
          onClick={() => logout(true)}
          className="rom-btn-ghost w-full mt-4"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
