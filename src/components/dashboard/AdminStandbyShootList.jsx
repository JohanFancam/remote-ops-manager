import React from 'react';
import { Badge } from "@/components/ui/badge";
import { format } from 'date-fns';
import { getDisplayName } from '../utils/nameUtils';

const statusColors = {
  upcoming: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  confirmed: 'bg-green-500/20 text-green-400 border-green-500/30',
  in_progress: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  completed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

function getPhaseLabel(shoot) {
  const p = shoot.phase_status || {};
  if (p.shoot_complete) return { label: 'Complete', color: 'text-green-400' };
  if (p.game_started) return { label: 'Game In Progress', color: 'text-red-400' };
  if (p.sound_started) return { label: 'Sound Check', color: 'text-purple-400' };
  if (p.attention_started) return { label: 'Attention', color: 'text-orange-400' };
  if (p.pre_shoot_started) return { label: 'Pre-Shoot', color: 'text-yellow-400' };
  if (p.setup_complete) return { label: 'Setup', color: 'text-blue-400' };
  return null;
}

export default function AdminStandbyShootList({ shoots = [], allUsers = [], userEmail }) {
  if (shoots.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm italic">
        No upcoming shoots on your standby shift.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {shoots.map(shoot => {
        const phase = getPhaseLabel(shoot);
        const operators = (shoot.assigned_operators || []).map(e => {
          const u = allUsers.find(u => u.email === e);
          return getDisplayName(u, e);
        });
        const isSelfAssigned = shoot.assigned_operators?.includes(userEmail);

        return (
          <div
            key={shoot.id}
            className={`flex items-center justify-between gap-3 px-4 py-3 rounded-xl border transition-colors ${
              isSelfAssigned
                ? 'bg-blue-950/30 border-blue-800/50'
                : 'bg-gray-900 border-gray-800'
            }`}
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-white text-sm truncate">{shoot.title}</span>
                {shoot.client && shoot.client !== shoot.title && (
                  <span className="text-xs text-gray-500 truncate">{shoot.client}</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
                <span>{format(new Date(shoot.date + 'T12:00:00'), 'EEE, MMM d')}</span>
                {shoot.game_time && <span className="font-mono">{shoot.game_time}</span>}
                {operators.length > 0 && (
                  <span className="text-gray-400">
                    Op: {operators.join(', ')}
                  </span>
                )}
                {operators.length === 0 && (
                  <span className="text-orange-400 italic">Unassigned</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {phase && (
                <span className={`text-xs font-semibold ${phase.color}`}>{phase.label}</span>
              )}
              <Badge className={`text-xs border ${statusColors[shoot.status] || statusColors.upcoming}`}>
                {shoot.status}
              </Badge>
              {isSelfAssigned && (
                <span className="text-xs text-blue-400 bg-blue-950/40 border border-blue-700/30 px-1.5 py-0.5 rounded">You</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}