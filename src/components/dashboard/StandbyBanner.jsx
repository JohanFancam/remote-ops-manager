import React, { useState, useEffect } from 'react';
import { Phone } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { getDisplayName } from '../utils/nameUtils';

export default function StandbyBanner({ todayStr }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(iv);
  }, []);

  const { data: standbyDays = [] } = useQuery({
    queryKey: ['standbyDays'],
    queryFn: () => base44.entities.StandbyDay.list('-start_date', 500),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
  });

  // Find entries where the standby period covers right now (date + time)
  const activeEntries = standbyDays.filter(entry => {
    const sd = entry.start_date || entry.date;
    const ed = entry.end_date || sd;
    if (!sd) return false;

    // Build start datetime
    const startDt = new Date(`${sd}T${entry.start_time || '00:00'}`);
    // Build end datetime
    const endDt = new Date(`${ed}T${entry.end_time || '23:59'}`);

    return now >= startDt && now <= endDt;
  });

  if (activeEntries.length === 0) return null;

  return (
    <div className="mb-4 bg-yellow-950/40 border border-yellow-800/60 rounded-xl px-4 py-3">
      <div className="flex items-start gap-3">
        <Phone className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-yellow-300 text-sm font-medium mb-1">
            On Standby Now{activeEntries.length > 1 ? ` (${activeEntries.length})` : ''}:
          </p>
          <div className="space-y-1">
            {activeEntries.map((entry, i) => {
              const u = allUsers.find(u => u.email === entry.admin_email);
              const name = getDisplayName(u, entry.admin_email, entry.admin_name);
              const sd = entry.start_date || entry.date;
              const ed = entry.end_date || sd;
              return (
                <div key={entry.id || i} className="flex items-center gap-2 flex-wrap">
                  <span className="text-yellow-200 text-sm font-medium">{name}</span>
                  <span className="text-yellow-600 text-xs">
                    {sd} {entry.start_time || ''} → {ed} {entry.end_time || ''}
                  </span>
                  {entry.notes && <span className="text-yellow-700 text-xs italic">{entry.notes}</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}