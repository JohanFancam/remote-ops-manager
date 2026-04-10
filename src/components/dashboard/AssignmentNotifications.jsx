import React, { useState, useEffect, useRef } from 'react';
import { UserCheck, X, Clock, CheckCircle2, Calendar } from 'lucide-react';
import { format } from 'date-fns';

export default function AssignmentNotifications({ shoots = [], user }) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(localStorage.getItem('dismissed_assign_notifs') || '[]'); } catch { return []; }
  });
  const panelRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const email = user?.email?.toLowerCase()?.trim();
  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');

  // Pending: user requested assignment, waiting for admin approval
  const pendingShoots = shoots.filter(s =>
    s.status !== 'cancelled' &&
    s.date >= todayStr &&
    s.pending_operators?.some(e => e?.toLowerCase()?.trim() === email)
  );

  // Approved: user is in assigned_operators on a future/today shoot
  const approvedShoots = shoots.filter(s =>
    s.status !== 'cancelled' &&
    s.date >= todayStr &&
    s.assigned_operators?.some(e => e?.toLowerCase()?.trim() === email)
  );

  const notifications = [
    ...pendingShoots.map(s => ({ key: `pending_${s.id}`, shoot: s, type: 'pending' })),
    ...approvedShoots.map(s => ({ key: `approved_${s.id}`, shoot: s, type: 'approved' })),
  ];

  const active = notifications.filter(n => !dismissed.includes(n.key));
  const count = active.length;

  const dismiss = (key) => {
    const next = [...dismissed, key];
    setDismissed(next);
    localStorage.setItem('dismissed_assign_notifs', JSON.stringify(next));
  };

  const dismissAll = () => {
    const keys = active.map(n => n.key);
    const next = [...dismissed, ...keys];
    setDismissed(next);
    localStorage.setItem('dismissed_assign_notifs', JSON.stringify(next));
    setOpen(false);
  };

  return (
    <div className="relative w-full" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative w-full flex items-center justify-between px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
      >
        <span className="flex items-center gap-2 text-sm">
          <UserCheck className="h-4 w-4" /> Assignments
        </span>
        {count > 0 && (
          <span className="bg-purple-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
            <span className="text-sm font-semibold text-white">Assignment Status</span>
            {active.length > 0 && (
              <button onClick={dismissAll} className="text-xs text-gray-500 hover:text-white">Clear all</button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {active.length === 0 ? (
              <div className="p-6 text-center">
                <UserCheck className="h-8 w-8 text-gray-700 mx-auto mb-2" />
                <p className="text-xs text-gray-500">No assignment updates</p>
              </div>
            ) : (
              active.map(n => (
                <div key={n.key} className={`mx-3 my-2 rounded-lg border p-3 ${
                  n.type === 'pending'
                    ? 'border-yellow-700/60 bg-yellow-950/20'
                    : 'border-green-700/60 bg-green-950/20'
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        {n.type === 'pending'
                          ? <><Clock className="h-3 w-3 text-yellow-400" /><span className="text-xs font-medium text-yellow-300">Pending Approval</span></>
                          : <><CheckCircle2 className="h-3 w-3 text-green-400" /><span className="text-xs font-medium text-green-300">Approved ✓</span></>
                        }
                      </div>
                      <p className="text-sm font-semibold text-white truncate">{n.shoot.title}</p>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
                        <Calendar className="h-3 w-3" />
                        <span>{format(new Date(n.shoot.date + 'T12:00:00'), 'EEE, MMM d')}</span>
                        {n.shoot.game_time && <span>· {n.shoot.game_time}</span>}
                      </div>
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