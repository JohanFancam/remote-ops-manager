import React, { useEffect, useState } from 'react';
import { Phone, Wifi } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const OFFLINE_THRESHOLD = 3 * 60 * 1000; // 3 minutes

export default function StandbyBanner({ standbyDays = [], allUsers = [], todayStr }) {
  const todayEntries = standbyDays.filter(s => s.date === todayStr);
  const [onlineEmails, setOnlineEmails] = useState(new Set());

  useEffect(() => {
    if (todayEntries.length === 0) return;

    const load = async () => {
      try {
        const presences = await base44.entities.UserPresence.list();
        const now = Date.now();
        const online = new Set(
          presences
            .filter(p => p.is_online && p.last_seen && (now - new Date(p.last_seen).getTime()) < OFFLINE_THRESHOLD)
            .map(p => p.user_email)
        );
        setOnlineEmails(online);
      } catch (e) { /* ignore */ }
    };

    load();

    // Subscribe to real-time presence updates
    const unsub = base44.entities.UserPresence.subscribe((event) => {
      if (event.type === 'update' || event.type === 'create') {
        const p = event.data;
        const isRecent = p.last_seen && (Date.now() - new Date(p.last_seen).getTime()) < OFFLINE_THRESHOLD;
        const isOnline = p.is_online && isRecent;
        setOnlineEmails(prev => {
          const next = new Set(prev);
          if (isOnline) next.add(p.user_email);
          else next.delete(p.user_email);
          return next;
        });
      }
    });

    return unsub;
  }, [todayStr]);

  if (todayEntries.length === 0) return null;

  return (
    <div className="mb-4 bg-yellow-950/40 border border-yellow-800/60 rounded-xl px-4 py-3">
      <div className="flex items-start gap-3">
        <Phone className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-yellow-300 text-sm font-medium mb-1">
            Today's Standby Contact{todayEntries.length > 1 ? 's' : ''}:
          </p>
          <div className="space-y-1">
            {todayEntries.map((entry, i) => {
              const u = allUsers.find(u => u.email === entry.admin_email);
              const name = u?.full_name || entry.admin_name || entry.admin_email;
              const isOnline = onlineEmails.has(entry.admin_email);
              return (
                <div key={entry.id || i} className="flex items-center gap-2 flex-wrap">
                  <span className="text-yellow-200 text-sm font-medium">{name}</span>
                  {/* Online indicator */}
                  <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border font-medium ${
                    isOnline
                      ? 'bg-green-900/40 border-green-700/50 text-green-400'
                      : 'bg-gray-800/60 border-gray-700/50 text-gray-500'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-green-400' : 'bg-gray-600'}`} />
                    {isOnline ? 'Online' : 'Offline'}
                  </span>
                  {(entry.start_time || entry.end_time) && (
                    <span className="text-yellow-600 text-xs">
                      {entry.start_time && `from ${entry.start_time}`}
                      {entry.start_time && entry.end_time && ' → '}
                      {entry.end_time && `until ${entry.end_time}`}
                    </span>
                  )}
                  {todayEntries.length > 1 && i < todayEntries.length - 1 && (
                    <span className="text-yellow-800 text-xs">then →</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}