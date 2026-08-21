import React from 'react';

export default function UserNotRegisteredError() {
  return (
    <div className="min-h-screen bg-slate-800 flex items-center justify-center">
      <div className="text-center">
        <p className="text-slate-100 text-xl font-semibold mb-2">Access Denied</p>
        <p className="text-slate-400">You are not registered in this system. Please contact your admin.</p>
      </div>
    </div>
  );
}