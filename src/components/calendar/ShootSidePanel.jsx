import React from 'react';
import { Edit2, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { format } from 'date-fns';

const timeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
};

const minutesToTime = (minutes) => {
  if (typeof minutes !== 'number' || isNaN(minutes)) return '00:00';

  // Wrap around 24h instead of clamping
  const normalizedMinutes = ((minutes % 1440) + 1440) % 1440;

  const h = Math.floor(normalizedMinutes / 60).toString().padStart(2, '0');
  const m = (normalizedMinutes % 60).toString().padStart(2, '0');

  return `${h}:${m}`;
};

const calculateScheduleTime = (gameTime, offset) => {
  if (!gameTime || offset === undefined) return null;
  const gameMinutes = timeToMinutes(gameTime);
  const scheduleMinutes = gameMinutes + offset;
  return minutesToTime(scheduleMinutes);
};

const getRigTypeLabel = (shoot, rig) => {
  if (shoot?.rig_type_override) {
    const parts = [shoot.rig_type_override];
    if (rig?.sound) parts.push('Sound');
    return parts.join('/');
  }
  if (!rig) return null;
  const parts = [];
  if (rig.rig_type) parts.push(rig.rig_type);
  if (rig.sound) parts.push('Sound');
  return parts.length > 0 ? parts.join('/') : null;
};

export default function ShootSidePanel({
  shoot,
  user,
  isAdmin,
  isStandby,
  rigSettings,
  allUsers = [],
  onUpdate,
  onEdit,
  onDuplicate,
  onDelete,
  onAssignRigTest,
  onClose,
}) {
  if (!shoot) return null;

  const shootDate = new Date(shoot.date + 'T12:00:00');
  const dayName = format(shootDate, 'EEEE');
  const dateStr = format(shootDate, 'MMM d, yyyy');
  const timeStr = shoot.game_time || 'TBA';

  const client = (shoot.client || '').toLowerCase().trim();
  const titleLower = (shoot.title || '').toLowerCase().trim();
  const rig = rigSettings.find(r => {
    const team = (r.team || '').toLowerCase().trim();
    if (!team) return false;
    return team === client || team === titleLower ||
      client.includes(team) || titleLower.includes(team) ||
      team.includes(client) || team.includes(titleLower);
  });
  const rigTypeLabel = getRigTypeLabel(shoot, rig) || 'Data';

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full bg-gray-900 border-l border-gray-800 p-0 [&_button[type='button']]:text-white overflow-y-auto transition-all duration-300">
        <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-800 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-white truncate">{shoot.title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {dayName}, {dateStr} · {timeStr}
            </p>
          </div>
        </div>

        {/* Shoot Type Badge */}
        <div className="px-4 py-3 border-b border-gray-800 flex-shrink-0">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Shoot Type</p>
          <div className="flex items-center gap-2">
            <span className={`inline-flex px-3 py-1 rounded-full text-xs font-medium border ${
              rigTypeLabel === 'Fancam' || rigTypeLabel === 'Data/Fancam'
                ? 'bg-orange-500/15 text-orange-300 border-orange-500/30'
                : 'bg-blue-500/15 text-blue-300 border-blue-500/30'
            }`}>
              {rigTypeLabel}
            </span>
            {isAdmin && (
              <div className="flex items-center gap-1 text-[11px]">
                {['Data', 'Fancam', 'Data/Fancam'].map(type => (
                  <button
                    key={type}
                    onClick={() => onUpdate(shoot.id, { rig_type_override: shoot.rig_type_override === type ? null : type })}
                    className={`px-2 py-1 rounded border transition-colors ${
                      shoot.rig_type_override === type
                        ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                        : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-300 hover:border-gray-600'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Rig Type & Details */}
        {(isAdmin || isStandby) && rig && (
          <div className="px-4 py-3 border-b border-gray-800 flex-shrink-0 space-y-2">
            <p className="text-xs text-gray-500 uppercase tracking-wider">Rig Details</p>
            <div className="space-y-2">
              {rig.rig_type && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Rig Type</span>
                  <span className="text-white font-medium">{rig.rig_type}</span>
                </div>
              )}
              {rig.hd_enabled && (
                <div className="text-[11px] text-gray-300 bg-gray-800/50 px-2 py-1.5 rounded border border-gray-700">
                  <div className="font-semibold mb-1">HD Camera Enabled</div>
                </div>
              )}
              {rig.wide_enabled && (
                <div className="text-[11px] text-gray-300 bg-gray-800/50 px-2 py-1.5 rounded border border-gray-700">
                  <div className="font-semibold">Wide Camera Enabled</div>
                </div>
              )}
              {rig.attention_enabled && (
                <div className="text-[11px] text-gray-300 bg-gray-800/50 px-2 py-1.5 rounded border border-gray-700">
                  <div className="font-semibold">Attention Camera Enabled</div>
                </div>
              )}
              {rig.sound && (
                <div className="text-[11px] text-gray-300 bg-gray-800/50 px-2 py-1.5 rounded border border-gray-700">
                  <div className="font-semibold">Sound System Enabled</div>
                </div>
              )}
              {rig.remote_rigs && rig.remote_rigs.length > 0 && (
                <div className="text-[11px] text-gray-300">
                  <div className="font-semibold mb-1">Remote Rigs</div>
                  <div className="flex flex-wrap gap-1">
                    {rig.remote_rigs.map((r, idx) => (
                      <span key={idx} className="bg-gray-700 px-2 py-1 rounded">{r}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Schedule Info */}
         <div className="px-4 py-3 border-b border-gray-800 flex-shrink-0 space-y-2">
           <div>
             <p className="text-xs text-gray-500 uppercase tracking-wider">Date & Time</p>
             <p className="text-sm text-white mt-1">{dayName}, {dateStr}</p>
             <p className="text-sm text-gray-300">{timeStr}</p>
           </div>
          
          {/* Schedule Timeline */}
          <div className="mt-3 pt-3 border-t border-gray-700">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-3">Schedule</p>
            <div className="space-y-2">
              {shoot.setup_offset !== undefined && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Setup</span>
                  <span className="text-gray-200 font-mono">{calculateScheduleTime(shoot.game_time, shoot.setup_offset)}</span>
                </div>
              )}
              {shoot.pre_shoot_offset !== undefined && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Pre-Shoot</span>
                  <span className="text-gray-200 font-mono">{calculateScheduleTime(shoot.game_time, shoot.pre_shoot_offset)}</span>
                </div>
              )}
              {shoot.attention_offset !== undefined && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Attention</span>
                  <span className="text-gray-200 font-mono">{calculateScheduleTime(shoot.game_time, shoot.attention_offset)}</span>
                </div>
              )}
              {shoot.sound_offset !== undefined && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400">Sound Check</span>
                  <span className="text-gray-200 font-mono">{calculateScheduleTime(shoot.game_time, shoot.sound_offset)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs border-t border-gray-700 pt-2 mt-2">
                <span className="text-gray-300 font-medium">Game Time</span>
                <span className="text-gray-200 font-mono">{shoot.game_time || 'TBA'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-4 py-3 border-b border-gray-800 flex-shrink-0 flex gap-2 flex-wrap">
          {isAdmin && (
            <>
              <Button size="sm" onClick={() => onEdit(shoot)} className="bg-blue-600 hover:bg-blue-700 text-xs h-8">
                <Edit2 className="h-3.5 w-3.5 mr-1" /> Edit
              </Button>
              <Button size="sm" onClick={() => onDuplicate(shoot)} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 text-xs h-8">
                <Copy className="h-3.5 w-3.5 mr-1" /> Duplicate
              </Button>
              <Button size="sm" onClick={() => onDelete(shoot.id)} variant="outline" className="border-red-700/60 text-red-300 hover:bg-red-950/30 text-xs h-8">
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
              </Button>
            </>
          )}
          {(isAdmin || isStandby) && onAssignRigTest && (
            <Button size="sm" onClick={() => onAssignRigTest(shoot)} className="bg-teal-600 hover:bg-teal-700 text-xs h-8">
              🔧 Assign Rig Test
            </Button>
          )}
        </div>

        {/* More Details */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 text-sm">
            {shoot.client && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Client/Team</p>
                <p className="text-white">{shoot.client}</p>
              </div>
            )}
            {shoot.location && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Location</p>
                <p className="text-white">{shoot.location}</p>
              </div>
            )}
            {shoot.status && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Status</p>
                <p className="text-white capitalize">{shoot.status.replace('_', ' ')}</p>
              </div>
            )}
            {(shoot.assigned_operators || []).length > 0 && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Assigned Operators</p>
                <div className="space-y-1">
                  {shoot.assigned_operators.map((email) => {
                    const user = allUsers.find(u => u.email === email);
                    const displayName = user?.full_name || email;
                    return <p key={email} className="text-white">{displayName}</p>;
                  })}
                </div>
              </div>
            )}
            {(shoot.pending_operators || []).length > 0 && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Pending Approval</p>
                <div className="space-y-1">
                  {shoot.pending_operators.map((email) => {
                    const user = allUsers.find(u => u.email === email);
                    const displayName = user?.full_name || email;
                    return <p key={email} className="text-yellow-300">{displayName} (pending)</p>;
                  })}
                </div>
              </div>
            )}
            {shoot.description && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Description</p>
                <p className="text-gray-300">{shoot.description}</p>
              </div>
            )}
            {shoot.notes && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Notes</p>
                <p className="text-gray-300">{shoot.notes}</p>
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}