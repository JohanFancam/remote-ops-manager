import React from 'react';
import { Phone } from 'lucide-react';

export default function StandbyBanner({ standbyDays = [], allUsers = [], todayStr }) {
  const todayEntries = standbyDays.filter(s => s.date === todayStr);
  if (todayEntries.length === 0) return null;

  return (
    <div className="mb-4 bg-yellow-950/40 border border-yellow-800/60 rounded-xl px-4 py-3">
      <div className="flex items-start gap-3">
        <Phone className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-yellow-300 text-sm font-medium mb-1">
            Today's Standby Contact{todayEntries.length > 1 ? 's' : ''}:
          </p>
          <div className="space-y-0.5">
            {todayEntries.map((entry, i) => {
              const u = allUsers.find(u => u.email === entry.admin_email);
              const name = u?.full_name || entry.admin_name || entry.admin_email;
              return (
                <div key={entry.id || i} className="flex items-center gap-2 flex-wrap">
                  <span className="text-yellow-200 text-sm font-medium">{name}</span>
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