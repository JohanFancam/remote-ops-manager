import React, { useEffect, useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { RefreshCw, X } from 'lucide-react';

// Shows a popup when AppSettings record with key='app_version' changes value
export default function RefreshReminder() {
  const [show, setShow] = useState(false);
  const versionRef = useRef(null);

  useEffect(() => {
    // Load initial version
    base44.entities.AppSettings.filter({ key: 'app_version' }).then(results => {
      if (results?.length > 0) {
        versionRef.current = results[0].value;
      }
    }).catch(() => {});

    // Subscribe to changes
    const unsub = base44.entities.AppSettings.subscribe((event) => {
      if (event.type === 'update' || event.type === 'create') {
        const s = event.data;
        if (s.key === 'app_version') {
          if (versionRef.current !== null && versionRef.current !== s.value) {
            setShow(true);
          }
          versionRef.current = s.value;
        }
      }
    });

    return unsub;
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-800 border border-blue-500 rounded-2xl shadow-2xl px-5 py-4 flex items-center gap-4 animate-in slide-in-from-bottom-4 max-w-sm w-full mx-4">
      <div className="flex-1">
        <p className="text-slate-100 font-semibold text-sm">Update Available</p>
        <p className="text-slate-400 text-xs mt-0.5">The app has been updated. Refresh to see the latest changes.</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={() => window.location.reload()}
          className="bg-blue-600 hover:bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
        <button onClick={() => setShow(false)} className="text-slate-500 hover:text-slate-100">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}