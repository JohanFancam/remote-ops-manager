import React from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Pencil, Users, Plus, Minus, Clock, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { shortenTitle } from '../utils/scheduleUtils';
import { displayShootTime, tzAbbrev } from '../utils/timezoneUtils';
import { getDisplayName } from '../utils/nameUtils';
import { performSelfAssign } from '../utils/shootSelfAssign';

const matchRig = (shoot, rigSettings) => {
  if (!shoot) return null;
  const client = (shoot.client || '').toLowerCase().trim();
  const title = (shoot.title || '').toLowerCase().trim();
  return rigSettings.find(r => {
    const team = (r.team || '').toLowerCase().trim();
    if (!team) return false;
    return team === client || team === title ||
      client.includes(team) || title.includes(team) ||
      team.includes(client) || team.includes(title);
  }) || null;
};

// Quick view modal — shows the basics (time + rig type) and gives admins a button
// to open the full edit / operator-assign settings.
export default function ShootQuickView({
  shoot, user, isAdmin, isStandby, allUsers, allShoots, rigSettings, appSettings, todayStr,
  queryClient, onUpdate, onEdit, onAssignOperators, onClose, standbyCoverage,
}) {
  if (!shoot) return null;

  const matched = matchRig(shoot, rigSettings);
  const rigType = shoot.rig_type_override || matched?.rig_type || 'Data';
  const isFancamBase = rigType === 'Fancam' || rigType === 'Data/Fancam';
  const isAssigned = (shoot.assigned_operators || []).includes(user?.email);
  const isPending = (shoot.pending_operators || []).includes(user?.email);
  const added = isAssigned || isPending;
  const isPast = shoot.date < todayStr;
  const hasAssignedOperators = (shoot.assigned_operators || []).length > 0;
  const operators = (shoot.assigned_operators || []).map(e => getDisplayName(allUsers.find(u => u.email === e), e));

  const handleAssign = async (e) => {
    e.stopPropagation();
    await performSelfAssign({ shoot, user, isAdmin, isStandby, allShoots, appSettings, todayStr, queryClient, onUpdate });
  };

  return (
    <Dialog open={!!shoot} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogContent className="bg-gray-900 border-gray-700 max-w-md text-white">
        <div className="flex items-start gap-3">
          <span className={`mt-1.5 h-3 w-3 rounded-full flex-shrink-0 ${isFancamBase ? 'bg-orange-500' : 'bg-blue-600'}`} />
          <div className="flex-1 min-w-0">
            <p className="text-white font-semibold leading-tight">{shortenTitle(shoot.title)}</p>
            <p className="text-xs text-gray-400 mt-1.5">
              {format(new Date(shoot.date + 'T12:00:00'), 'EEEE, MMMM d')} · {displayShootTime(shoot)} <span className="text-gray-500">({tzAbbrev()})</span>
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-[11px] px-2 py-0.5 rounded-full border ${isFancamBase ? 'bg-orange-500/15 text-orange-300 border-orange-500/30' : 'bg-blue-500/15 text-blue-300 border-blue-500/30'}`}>
                {rigType}
              </span>
              {shoot.location && <span className="text-[11px] text-gray-400">{shoot.location}</span>}
              <span className="text-[11px] text-gray-500 capitalize">{(shoot.status || 'upcoming').replace('_', ' ')}</span>
            </div>
            {operators.length > 0 && (
              <p className="text-xs text-gray-400 mt-2">
                <span className="text-gray-500">Operators: </span>{operators.join(', ')}
              </p>
            )}
            {!isAdmin && !isStandby && standbyCoverage && (
              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                <ShieldCheck className="h-3 w-3 text-blue-300 flex-shrink-0" />
                <span className="text-gray-500">Standby: </span>{standbyCoverage.admin_name || standbyCoverage.admin_email}
              </p>
            )}
            {isPending && <p className="text-[11px] text-yellow-400 mt-1">Your assignment is pending approval.</p>}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          {user?.email && !isPast && (added || !hasAssignedOperators) && (
            <button
              onClick={handleAssign}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                added
                  ? 'border-red-700/60 bg-red-950/20 text-red-300 hover:bg-red-950/40'
                  : 'border-blue-700/60 bg-blue-950/20 text-blue-300 hover:bg-blue-950/40'
              }`}
            >
              {added ? (isPending ? <><Clock className="h-3.5 w-3.5" />Cancel Request</> : <><Minus className="h-3.5 w-3.5" />Unassign Me</>) : <><Plus className="h-3.5 w-3.5" />Assign Me</>}
            </button>
          )}
          {isAdmin && (
            <>
              <button onClick={() => onEdit?.(shoot)} className="inline-flex items-center gap-1.5 rounded-md border border-gray-700 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-800 transition-colors">
                <Pencil className="h-3.5 w-3.5" />Edit Settings
              </button>
              <button onClick={() => onAssignOperators?.(shoot)} className="inline-flex items-center gap-1.5 rounded-md border border-gray-700 px-3 py-1.5 text-xs text-gray-200 hover:bg-gray-800 transition-colors">
                <Users className="h-3.5 w-3.5" />Operators
              </button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}