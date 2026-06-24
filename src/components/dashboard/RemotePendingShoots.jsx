import React from 'react';
import { format } from 'date-fns';
import { Clock, XCircle, MapPin, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { removeEmail } from '@/utils/assignmentApproval';

export default function RemotePendingShoots({ shoots = [], user, onUpdate }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const pendingShoots = shoots
    .filter(s =>
      s.status !== 'cancelled' &&
      s.status !== 'completed' &&
      s.date >= todayStr &&
      (s.pending_operators || []).includes(user?.email)
    )
    .sort((a, b) => a.date.localeCompare(b.date) || (a.game_time || '').localeCompare(b.game_time || ''));

  const handleCancelPending = async (shoot) => {
    const email = user?.email;
    if (!email) return;
    await onUpdate(shoot.id, {
      pending_operators: removeEmail(shoot.pending_operators, email),
      pre_approved_operators: removeEmail(shoot.pre_approved_operators, email),
    });
  };

  if (pendingShoots.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-3 text-center">No pending shoots awaiting approval.</p>
    );
  }

  return (
    <div className="space-y-2">
      {pendingShoots.map(shoot => (
        <div key={shoot.id} className="flex items-start justify-between gap-3 rounded-lg border border-yellow-700/30 bg-yellow-950/20 px-3 py-3">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-semibold text-white truncate">{shoot.title}</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(shoot.date + 'T12:00:00'), 'EEE, MMM d')}
                {shoot.game_time ? ` · ${shoot.game_time}` : ''}
              </span>
              {shoot.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {shoot.location}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            <span className="flex items-center gap-1 text-[11px] bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 px-2 py-0.5 rounded-full">
              <Clock className="h-3 w-3" /> Pending Approval
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => handleCancelPending(shoot)}
              className="h-7 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30 px-2"
            >
              <XCircle className="h-3.5 w-3.5 mr-1" /> Cancel
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}