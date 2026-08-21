import React from 'react';

export default function UserNotRegisteredError() {
  return (
    <div className="min-h-screen bg-zinc-100 flex items-center justify-center">
      <div className="text-center">
        <p className="text-zinc-900 text-xl font-semibold mb-2">Access Denied</p>
        <p className="text-zinc-500">You are not registered in this system. Please contact your admin.</p>
      </div>
    </div>
  );
}