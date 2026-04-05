import React, { useState, useEffect, useRef } from 'react';
import { Bell, X, Calendar, CheckCheck } from 'lucide-react';
import { format } from 'date-fns';

function getSetupTime(shoot) {
  if (!shoot.game_time) return null;
  const [h, m] = shoot.game_time.split(':').map(Number);
  const gameMinutes = h * 60 + m;
  const offsetMinutes = shoot.setup_offset ?? -150;
  const setupMinutes = gameMinutes + offsetMinutes;
  const sh = Math.floor(setupMinutes / 60);
  const sm = setupMinutes % 60;
  const d = new Date(shoot.date + 'T00:00:00');
  d.setHours(sh, sm, 0, 0);
  return d;
}

export default function ShootNotifications({ shoots = [], user, notifyHours = 5 }) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dismissed_notifs') || '[]'); } catch { return []; }
  });
  const panelRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const now = new Date();
  const myAssigned = shoots.filter(s =>
    s.assigned_operators?.includes(user?.email) &&
    s.status !== 'cancelled' && s.status !== 'completed'
  );

  // Build notifications: upcoming shoot reminders
  const notifications = myAssigned.map(shoot => {
    const setupTime = getSetupTime(shoot);
    if (!setupTime) return null;
    const msUntilSetup = setupTime - now;
    const hoursUntilSetup = msUntilSetup / 3600000;
    const isUpcoming = hoursUntilSetup > 0 && hoursUntilSetup <= notifyHours;
    const isToday = shoot.date === format(now, 'yyyy-MM-dd');
    const isTomorrow = (() => {
      const tom = new Date(now);
      tom.setDate(tom.getDate() + 1);
      return shoot.date === format(tom, 'yyyy-MM-dd');
    })();

    if (!isUpcoming && !isToday && !isTomorrow) return null;

    const key = `shoot_${shoot.id}`;
    const urgency = isUpcoming ? 'urgent' : isToday ? 'today' : 'tomorrow';
    return { key, shoot, setupTime, hoursUntilSetup, urgency };
  }).filter(Boolean);

  const active = notifications.filter(n => !dismissed.includes(n.key));
  const count = active.length;

  const dismiss = (key) => {
    const next = [...dismissed, key];
    setDismissed(next);
    localStorage.setItem('dismissed_notifs', JSON.stringify(next));
  };

  const dismissAll = () => {
    const keys = active.map(n => n.key);
    const next = [...dismissed, ...keys];
    setDismissed(next);
    localStorage.setItem('dismissed_notifs', JSON.stringify(next));
    setOpen(false);
  };

  const urgencyStyles = {
    urgent: 'border-red-700/60 bg-red-950/30',
    today: 'border-yellow-700/60 bg-yellow-950/20',
    tomorrow: 'border-blue-700/60 bg-blue-950/20',
  };
  const urgencyLabel = {
    urgent: '🔴 Setup soon!',
    today: '🟡 Today',
    tomorrow: '🔵 Tomorrow',
  };

  return (
    <div className="relative w-full" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative w-full flex items-center justify-between px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
      >
        <span className="flex items-center gap-2 text-sm">
          <Bell className="h-4 w-4" /> Notifications
        </span>
        {count > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <span className="text-sm font-semibold text-white">Shoot Notifications</span>
            {active.length > 0 && (
              <button onClick={dismissAll} className="text-xs text-gray-500 hover:text-white flex items-center gap-1">
                <CheckCheck className="h-3.5 w-3.5" /> Clear all
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto">
            {active.length === 0 ? (
              <div className="p-6 text-center">
                <Bell className="h-8 w-8 text-gray-700 mx-auto mb-2" />
                <p className="text-xs text-gray-500">No new notifications</p>
              </div>
            ) : (
              active.map(n => (
                <div key={n.key} className={`mx-3 my-2 rounded-lg border p-3 ${urgencyStyles[n.urgency]}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-xs font-medium text-gray-300">{urgencyLabel[n.urgency]}</span>
                      </div>
                      <p className="text-sm font-semibold text-white truncate">{n.shoot.title}</p>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
                        <Calendar className="h-3 w-3" />
                        <span>{format(new Date(n.shoot.date + 'T12:00:00'), 'EEE, MMM d')}</span>
                        {n.shoot.game_time && <span>· Game {n.shoot.game_time}</span>}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Setup: {format(n.setupTime, 'HH:mm')}
                        {n.urgency === 'urgent' && ` (in ${Math.round(n.hoursUntilSetup * 10) / 10}h)`}
                      </p>
                    </div>
                    <button onClick={() => dismiss(n.key)} className="text-gray-600 hover:text-gray-400 flex-shrink-0">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}