import React from 'react';
import { useAuth } from '@/lib/AuthContext';

export default function AuthBackdrop() {
  const { appPublicSettings } = useAuth();
  const backgroundUrl = appPublicSettings?.public_settings?.login_background_url || '';

  return (
    <div className="pointer-events-none absolute inset-0">
      {backgroundUrl ? (
        <>
          <div
            className="absolute inset-0 bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url("${backgroundUrl}")` }}
          />
          <div className="absolute inset-0 bg-slate-950/55" />
        </>
      ) : (
        <>
          <div className="rom-ambient absolute -top-24 -left-16 h-[28rem] w-[28rem] rounded-full bg-blue-500/20 blur-3xl" />
          <div className="rom-ambient absolute bottom-0 right-0 h-[22rem] w-[22rem] rounded-full bg-sky-400/10 blur-3xl" style={{ animationDelay: '2s' }} />
        </>
      )}
    </div>
  );
}
