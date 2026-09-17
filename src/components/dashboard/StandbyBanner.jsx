import React, { useState, useEffect } from 'react';
import { Phone } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { getDisplayName } from '../utils/nameUtils';

export default function StandbyBanner({ todayStr, currentUser }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    // Tick every second for real-time accuracy
    const iv = setInterval(() => setNow(new Date()), 1000);
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

  // Find entries where the standby period covers right now (date + time).
  // An entry with no end_time on end_date stays active until 23:59 that day,
  // so multi-day standby overlapping into today is correctly shown.
  const activeEntries = standbyDays.filter(entry => {
    const sd = entry.start_date || entry.date;
    const ed = entry.end_date || sd;
    if (!sd) return false;

    const startDt = new Date(`${sd}T${entry.start_time || '00:00'}`);
    // If no end_time is set, use end of day so multi-day slots stay visible all day
    let endDt = new Date(`${ed}T${entry.end_time || '23:59:59'}`);
    // Overnight shift (18:00 → 06:00 stored on a single calendar day): the end is
    // at or before the start, so it crosses midnight — roll end forward one day so
    // the slot stays active through the early morning without assigning the next
    // calendar day as a new standby day.
    if (endDt <= startDt) {
      endDt = new Date(`${ed}T${entry.end_time || '06:00'}`);
      endDt.setDate(endDt.getDate() + 1);
    }

    return now >= startDt && now <= endDt;
  });

  const iAmOnStandby = currentUser && activeEntries.some(e => e.admin_email === currentUser.email);

  if (activeEntries.length === 0 && !iAmOnStandby) return null;

  // Format time as HH:MM:SS for live clock display
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr2 = now.toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="mb-4 space-y-2">
      {/* Real-time clock */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl px-4 py-2 flex items-center gap-3">
        <span className="text-gray-400 text-xs">{dateStr2}</span>
        <span className="ml-auto font-mono text-white text-sm font-semibold tracking-widest">{timeStr}</span>
      </div>

      {/* Active standby banner */}
      {activeEntries.length > 0 && (
        <div className={`border rounded-xl px-4 py-3 ${iAmOnStandby ? 'bg-yellow-600/20 border-yellow-500/60' : 'bg-yellow-950/40 border-yellow-800/60'}`}>
          <div className="flex items-start gap-3">
            <Phone className={`h-5 w-5 flex-shrink-0 mt-0.5 ${iAmOnStandby ? 'text-yellow-300' : 'text-yellow-400'}`} />
            <div className="flex-1">
              {iAmOnStandby && (
                <p className="text-yellow-200 text-sm font-bold mb-1">🔔 You are currently ON STANDBY</p>
              )}
              <p className="text-yellow-300 text-sm font-medium mb-1">
                On Standby Now{activeEntries.length > 1 ? ` (${activeEntries.length})` : ''}:
              </p>
              <div className="space-y-1">
                {activeEntries.map((entry, i) => {
                  const u = allUsers.find(u => u.email === entry.admin_email);
                  const name = getDisplayName(u, entry.admin_email, entry.admin_name);
                  const sd = entry.start_date || entry.date;
                  const ed = entry.end_date || sd;
                  const isMe = currentUser && entry.admin_email === currentUser.email;
                  return (
                    <div key={entry.id || i} className="flex items-center gap-2 flex-wrap">
                      <span className={`text-sm font-medium ${isMe ? 'text-yellow-100 font-bold' : 'text-yellow-200'}`}>
                        {name}{isMe ? ' (You)' : ''}
                      </span>
                      <span className="text-yellow-600 text-xs">
                        {sd} {entry.start_time ? `@ ${entry.start_time}` : ''} → {ed} {entry.end_time ? `@ ${entry.end_time}` : ''}
                      </span>
                      {entry.notes && <span className="text-yellow-700 text-xs italic">{entry.notes}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}