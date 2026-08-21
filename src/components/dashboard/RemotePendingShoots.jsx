import React, { useState } from 'react';
import { format } from 'date-fns';
import { Clock, XCircle, MapPin, Calendar } from 'lucide-react';
import { removeEmail } from '@/utils/assignmentApproval';

const PAGE_SIZE = 4;

function PendingShootTile({ shoot, onCancel }) {
  return (
    <div className="bg-slate-900 border border-yellow-800/30 rounded-xl overflow-hidden hover:border-yellow-700/50 transition-colors">
      <div className="px-4 py-3">
        {/* Status pill */}
        <div className="flex items-center justify-between mb-2">
          <span className="flex items-center gap-1 text-[11px] bg-yellow-500/15 text-amber-400 border border-yellow-500/30 px-2 py-0.5 rounded-full font-medium">
            <Clock className="h-3 w-3" /> Pending Approval
          </span>
          <button
            onClick={() => onCancel(shoot)}
            className="flex items-center gap-1 text-xs text-red-400 hover:text-red-400 hover:bg-red-950/30 px-2 py-1 rounded-lg transition-colors"
          >
            <XCircle className="h-3.5 w-3.5" /> Cancel
          </button>
        </div>

        {/* Title */}
        <p className="text-sm font-semibold text-slate-100 truncate mb-1">{shoot.title}</p>

        {/* Meta */}
        <div className="space-y-0.5 text-xs text-slate-400">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 flex-shrink-0" />
            <span>{format(new Date(shoot.date + 'T12:00:00'), 'EEE, MMM d')}</span>
            {shoot.game_time && <span className="font-mono text-slate-500">· {shoot.game_time}</span>}
          </div>
          {shoot.location && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3 flex-shrink-0" />
              <span className="truncate">{shoot.location}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function RemotePendingShoots({ shoots = [], user, onUpdate }) {
  const [page, setPage] = useState(0);
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const pendingShoots = shoots
    .filter(s =>
      s.status !== 'cancelled' &&
      s.status !== 'completed' &&
      s.date >= todayStr &&
      (s.pending_operators || []).includes(user?.email)
    )
    .sort((a, b) => a.date.localeCompare(b.date) || (a.game_time || '').localeCompare(b.game_time || ''));

  const totalPages = Math.max(1, Math.ceil(pendingShoots.length / PAGE_SIZE));
  const visibleShoots = pendingShoots.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const handleCancel = async (shoot) => {
    const email = user?.email;
    if (!email) return;
    await onUpdate(shoot.id, {
      pending_operators: removeEmail(shoot.pending_operators, email),
      pre_approved_operators: removeEmail(shoot.pre_approved_operators, email),
    });
  };

  if (pendingShoots.length === 0) {
    return (
      <p className="py-8 text-center text-sm italic text-slate-500">No pending shoots awaiting approval.</p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-end">
        <div className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-500">
          Showing max 4
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {visibleShoots.map(shoot => (
          <PendingShootTile key={shoot.id} shoot={shoot} onCancel={handleCancel} />
        ))}
      </div>

      {pendingShoots.length > PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            className="rounded-md border border-slate-800 px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-30"
          >
            Previous
          </button>
          <span className="text-[10px] font-bold text-gray-600">
            SHOWING {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, pendingShoots.length)} OF {pendingShoots.length}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="rounded-md border border-blue-800/60 bg-blue-950/40 px-2.5 py-1 text-xs font-semibold text-blue-400 hover:bg-blue-950/40 disabled:opacity-30"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}