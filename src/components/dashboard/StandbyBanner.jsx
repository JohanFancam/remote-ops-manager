import React, { useEffect, useState } from 'react';
import { Phone } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

const OFFLINE_THRESHOLD = 3 * 60 * 1000; // 3 minutes

export default function StandbyBanner({ todayStr }) {
  const [onlineEmails, setOnlineEmails] = useState(new Set());
  const [now, setNow] = useState(new Date());

  // Fetch standby days directly — don't rely on prop
  const { data: standbyDays = [] } = useQuery({
    queryKey: ['standbyDays'],
    queryFn: () => base44.entities.StandbyDay.list('-date', 500),
  });

  // Fetch all users directly for name lookup
  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
  });

  const todayEntries = standbyDays.filter(s => s.date === todayStr);

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (todayEntries.length === 0) return;

    const load = async () => {
      try {
        const presences = await base44.entities.UserPresence.list();
        const nowTs = Date.now();
        const online = new Set(
          presences
            .filter(p => p.is_online && p.last_seen && (nowTs - new Date(p.last_seen).getTime()) < OFFLINE_THRESHOLD)
            .map(p => p.user_email)
        );
        setOnlineEmails(online);
      } catch (e) { /* ignore */ }
    };

    load();

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
  }, [todayStr, todayEntries.length]);

  const activeEntries = todayEntries.filter(entry => {
    if (!entry.end_time) return true;
    const [h, m] = entry.end_time.split(':').map(Number);
    const endDate = new Date();
    endDate.setHours(h, m, 0, 0);
    return now < endDate;
  });

  if (activeEntries.length === 0) return null;

  const getDisplayName = (entry) => {
    const u = allUsers.find(u => u.email === entry.admin_email);
    const fullName = u?.full_name?.trim();
    return fullName || entry.admin_name || entry.admin_email;
  };

  return (
    <div className="mb-4 bg-yellow-950/40 border border-yellow-800/60 rounded-xl px-4 py-3">
      <div className="flex items-start gap-3">
        <Phone className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-yellow-300 text-sm font-medium mb-1">
            Today's Standby Contact{activeEntries.length > 1 ? 's' : ''}:
          </p>
          <div className="space-y-1">
            {activeEntries.map((entry, i) => {
              const name = getDisplayName(entry);
              const isOnline = onlineEmails.has(entry.admin_email);
              return (
                <div key={entry.id || i} className="flex items-center gap-2 flex-wrap">
                  <span className="text-yellow-200 text-sm font-medium">{name}</span>
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
                  {activeEntries.length > 1 && i < activeEntries.length - 1 && (
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