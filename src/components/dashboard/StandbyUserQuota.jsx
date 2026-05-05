import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Target, CheckCircle2, AlertTriangle, Calendar } from 'lucide-react';

const QUOTA = 10;
const GRACE = 5;

export default function StandbyUserQuota({ user, shoots = [] }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const myAssigned = shoots.filter(s =>
    s.status !== 'cancelled' &&
    s.assigned_operators?.includes(user?.email)
  );

  const myCompleted = myAssigned.filter(s =>
    s.date < todayStr || s.phase_status?.shoot_complete || s.status === 'completed'
  );

  const myUpcoming = myAssigned.filter(s =>
    s.date >= todayStr && !s.phase_status?.shoot_complete && s.status !== 'completed'
  );

  const quota = user?.shoot_quota ?? QUOTA;
  const grace = GRACE;
  const total = quota + grace;

  const completedCount = myCompleted.length;
  const assignedCount = myAssigned.length;
  const remaining = Math.max(0, quota - assignedCount);
  const progressPct = Math.min(100, (assignedCount / total) * 100);
  const quotaReached = assignedCount >= quota;
  const graceReached = assignedCount >= total;

  const barColor = graceReached
    ? 'bg-red-500'
    : quotaReached
      ? 'bg-yellow-500'
      : 'bg-blue-500';

  return (
    <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-4 md:p-5 mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Target className="h-4 w-4 text-blue-400 flex-shrink-0" />
        <h2 className="text-base font-semibold text-white">Shoot Quota</h2>
        {graceReached && (
          <span className="ml-auto text-xs bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Grace limit reached
          </span>
        )}
        {quotaReached && !graceReached && (
          <span className="ml-auto text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Quota met — in grace period
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
          <span>{assignedCount} / {quota} required</span>
          <span className="text-gray-500">(+{grace} grace = {total} max)</span>
        </div>
        <div className="relative h-3 w-full rounded-full bg-gray-800 overflow-hidden">
          {/* Grace zone indicator */}
          <div
            className="absolute top-0 bottom-0 bg-yellow-900/40 border-l border-yellow-700/40"
            style={{ left: `${(quota / total) * 100}%`, right: 0 }}
          />
          {/* Progress fill */}
          <div
            className={`h-full rounded-full transition-all duration-500 ${barColor}`}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-gray-600 mt-1">
          <span>0</span>
          <span className="text-yellow-700">quota: {quota}</span>
          <span className="text-red-700">max: {total}</span>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3 mt-4">
        <div className="rounded-lg bg-gray-800/60 border border-gray-700/40 p-3 text-center">
          <p className="text-xl font-bold text-blue-300">{assignedCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">Total Assigned</p>
        </div>
        <div className="rounded-lg bg-gray-800/60 border border-gray-700/40 p-3 text-center">
          <p className="text-xl font-bold text-green-300">{completedCount}</p>
          <p className="text-xs text-gray-400 mt-0.5">Completed</p>
        </div>
        <div className={`rounded-lg border p-3 text-center ${remaining > 0 ? 'bg-blue-950/30 border-blue-700/40' : 'bg-green-950/30 border-green-700/40'}`}>
          <p className={`text-xl font-bold ${remaining > 0 ? 'text-blue-300' : 'text-green-300'}`}>
            {remaining > 0 ? remaining : '✓'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">{remaining > 0 ? 'Still Needed' : 'Quota Met'}</p>
        </div>
      </div>

      {myUpcoming.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-800">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" /> Your Upcoming Shoots ({myUpcoming.length})
          </p>
          <div className="space-y-1">
            {myUpcoming.slice(0, 5).map(s => (
              <div key={s.id} className="flex items-center justify-between text-sm py-1 border-b border-gray-800/60">
                <span className="text-gray-300 truncate">{s.title}</span>
                <span className="text-gray-500 font-mono text-xs ml-3 flex-shrink-0">
                  {format(new Date(s.date + 'T12:00:00'), 'MMM d')}{s.game_time ? ` · ${s.game_time}` : ''}
                </span>
              </div>
            ))}
            {myUpcoming.length > 5 && (
              <p className="text-xs text-gray-600 text-right">+{myUpcoming.length - 5} more</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}