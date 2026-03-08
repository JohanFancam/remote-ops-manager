import React from 'react';

export default function UserNotRegisteredError() {
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <p className="text-white text-xl font-semibold mb-2">Access Denied</p>
        <p className="text-gray-400">You are not registered in this system. Please contact your admin.</p>
      </div>
    </div>
  );
}