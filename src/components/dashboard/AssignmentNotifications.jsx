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

  const now = new Date();
  const todayStr = format(now, 'yyyy-MM-dd');

  const futureShoots = shoots.filter(s =>
    s.status !== 'cancelled' && s.date >= todayStr
  );

  const notifications = [
    ...futureShoots
      .filter(s => s.pending_operators?.length > 0)
      .map(s => ({ key: `pending_${s.id}`, shoot: s, type: 'pending' })),
    ...futureShoots
      .filter(s => s.assigned_operators?.length > 0)
      .map(s => ({ key: `approved_${s.id}`, shoot: s, type: 'approved' })),
  ].sort((a, b) => a.shoot.date.localeCompare(b.shoot.date));

  // Pending approvals always show (never hidden by dismissal)
  const active = notifications.filter(n => n.type === 'pending' || !dismissed.includes(n.key));
  const pendingCount = active.filter(n => n.type === 'pending').length;
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
        className="relative w-full flex items-center justify-between px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
      >
        <span className="flex items-center gap-2 text-sm">
          <UserCheck className="h-4 w-4" /> Assignments
        </span>
        {pendingCount > 0 && (
          <span className="bg-yellow-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {pendingCount > 9 ? '9+' : pendingCount}
          </span>
        )}
        {pendingCount === 0 && count > 0 && (
          <span className="bg-purple-500 text-slate-100 text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-slate-800 border border-slate-800 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <span className="text-sm font-semibold text-slate-100">Assignment Status</span>
            {active.length > 0 && (
              <button onClick={dismissAll} className="text-xs text-slate-500 hover:text-slate-100">Clear all</button>
            )}
          </div>

          <div className="max-h-72 overflow-y-auto">
            {active.length === 0 ? (
              <div className="p-6 text-center">
                <UserCheck className="h-8 w-8 text-gray-700 mx-auto mb-2" />
                <p className="text-xs text-slate-500">No assignment updates</p>
              </div>
            ) : (
              active.map(n => (
                <div key={n.key} className={`mx-3 my-2 rounded-lg border p-3 ${
                  n.type === 'pending'
                    ? 'border-yellow-700/60 bg-yellow-950/20'
                    : 'border-emerald-800 bg-emerald-950/40'
                }`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-1">
                        {n.type === 'pending'
                          ? <><Clock className="h-3 w-3 text-amber-400" /><span className="text-xs font-medium text-amber-400">Needs Approval</span></>
                          : <><CheckCircle2 className="h-3 w-3 text-emerald-400" /><span className="text-xs font-medium text-green-300">Approved</span></>
                        }
                      </div>
                      <p className="text-sm font-semibold text-slate-100 truncate">{n.shoot.title}</p>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400">
                        <Calendar className="h-3 w-3" />
                        <span>{format(new Date(n.shoot.date + 'T12:00:00'), 'EEE, MMM d')}</span>
                        {n.shoot.game_time && <span>· {n.shoot.game_time}</span>}
                      </div>
                      {n.type === 'pending' && n.shoot.pending_operators?.length > 0 && (
                        <p className="text-xs text-amber-400/80 mt-0.5">{n.shoot.pending_operators.length} operator(s) waiting</p>
                      )}
                      {n.type === 'approved' && n.shoot.assigned_operators?.length > 0 && (
                        <p className="text-xs text-emerald-400/80 mt-0.5">{n.shoot.assigned_operators.length} operator(s) assigned</p>
                      )}
                    </div>
                    <button onClick={() => dismiss(n.key)} className="text-gray-600 hover:text-slate-400 flex-shrink-0">
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