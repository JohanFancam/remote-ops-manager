import React from 'react';
import { Plus, Minus, Clock, ShieldCheck, Radio } from 'lucide-react';
import { shortenTitle } from '../utils/scheduleUtils';
import { displayShootTime, isGameInProgress } from '../utils/timezoneUtils';
import { performSelfAssign } from '../utils/shootSelfAssign';
import { getDisplayName } from '../utils/nameUtils';
import { getStandbyColorMap, resolveStandbyColor } from '../utils/standbyColors';

const statusDot = {
  upcoming: 'bg-blue-600',
  confirmed: 'bg-green-600',
  in_progress: 'bg-yellow-600',
  completed: 'bg-gray-600',
  cancelled: 'bg-gray-600',
};

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

const isFancamOrMixed = (shoot, rigSettings) => {
  if (shoot.rig_type_override === 'Fancam' || shoot.rig_type_override === 'Data/Fancam') return true;
  if (shoot.rig_type_override === 'Data') return false;
  const rs = matchRig(shoot, rigSettings);
  return rs?.rig_type === 'Fancam' || rs?.rig_type === 'Data/Fancam';
};

// Compact single-line entry used inside the month grid and the "X more" popup.
export default function MonthEntry({
  shoot, user, isAdmin, isStandby, canStandby = false, isOperatorStandby = false, allUsers, allShoots, rigSettings, appSettings, todayStr,
  queryClient, onUpdate, onQuickView, getStandbyCoverageForShoot,
  primaryStandbyAdminEmail = '',
  fullTitle = false,
}) {
  const isPast = shoot.date < todayStr;
  const isAssigned = (shoot.assigned_operators || []).includes(user?.email);
  const isPending = (shoot.pending_operators || []).includes(user?.email);
  const added = isAssigned || isPending;
  const hasAssignedOperators = (shoot.assigned_operators || []).length > 0;
  const hasPending = (shoot.pending_operators || []).length > 0;
  const operatorNames = (shoot.assigned_operators || [])
    .map(email => {
      const u = allUsers?.find(x => x.email === email);
      return getDisplayName(u, email);
    })
    .join(', ');
  const fancam = isFancamOrMixed(shoot, rigSettings);
  const dot = isPast ? 'bg-gray-600' : fancam ? 'bg-orange-500' : (statusDot[shoot.status] || 'bg-blue-600');

  const standbyCoverage = getStandbyCoverageForShoot?.(shoot);
  const isMyStandby = standbyCoverage?.admin_email === user?.email;
  const showStandby = canStandby && !!standbyCoverage;
  // Per-user standby colour (admin-managed), with role-based fallback.
  const standbyColorMap = getStandbyColorMap(appSettings);
  const coverageColor = resolveStandbyColor(standbyCoverage?.admin_email, { colorMap: standbyColorMap, allUsers, currentUserEmail: user?.email });

  const matchedRig = matchRig(shoot, rigSettings);
  const liveData = !!matchedRig?.live_data;
  const gameLive = isGameInProgress(shoot);

  const handleAssign = async (e) => {
    e.stopPropagation();
    await performSelfAssign({ shoot, user, isAdmin, isStandby, allShoots, appSettings, todayStr, queryClient, onUpdate });
  };

  const label = added ? (isPending ? 'Cancel request' : 'Unassign me') : 'Assign me';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); onQuickView?.(shoot); }}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); onQuickView?.(shoot); } }}
      className={`group flex items-center gap-1.5 rounded-md px-1.5 py-1 hover:bg-gray-800/70 cursor-pointer text-left ${
        showStandby ? `border-l-2 ${coverageColor.borderL}` : ''
      }`}
    >
      <span className={`h-2 w-2 rounded-full flex-shrink-0 ${dot}`} />
      <span className="text-[11px] text-gray-400 flex-shrink-0">{displayShootTime(shoot)}</span>
      <div className="flex-1 min-w-0">
        {fullTitle
          ? <span className="text-[11px] text-white break-words block">{shoot.title}</span>
          : <span className="text-[11px] text-white truncate block">{shortenTitle(shoot.title)}</span>}
        {fullTitle && (operatorNames
          ? <span className="text-[10px] text-gray-400 truncate block">{operatorNames}</span>
          : <span className={`text-[10px] truncate block ${hasPending ? 'text-yellow-400' : 'text-gray-500'}`}>{hasPending ? 'Pending' : 'Unassigned'}</span>)}
      </div>
      {!fullTitle && hasPending && !hasAssignedOperators && (
        <span className="flex-shrink-0 text-[9px] px-1 rounded-full bg-yellow-500/15 text-yellow-300 border border-yellow-500/30">Pending</span>
      )}
      {liveData && (
        <span
          className={`flex-shrink-0 inline-flex items-center gap-0.5 text-[9px] font-bold px-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 ${gameLive ? 'animate-pulse' : ''}`}
          title="Live Data — priority shoot, attend immediately if there is an issue"
        >
          <Radio className="h-2.5 w-2.5" />LIVE
        </span>
      )}
      {showStandby && (
        <ShieldCheck
          className={`h-2.5 w-2.5 flex-shrink-0 ${coverageColor.shield}`}
          title={isMyStandby ? 'Your standby coverage' : `Standby: ${standbyCoverage.admin_name || standbyCoverage.admin_email}`}
        />
      )}
      {user?.email && !isPast && (added || (!hasAssignedOperators && !hasPending)) && (
        <button
          type="button"
          onClick={handleAssign}
          title={label}
          className={`flex-shrink-0 inline-flex h-4 w-4 items-center justify-center rounded-full border transition-colors ${
            added
              ? 'border-red-500/50 bg-red-500/15 text-red-300 hover:bg-red-500/25'
              : 'border-blue-500/50 bg-blue-500/10 text-blue-300 hover:bg-blue-500/25'
          }`}
        >
          {added ? (isPending ? <Clock className="h-2.5 w-2.5" /> : <Minus className="h-2.5 w-2.5" />) : <Plus className="h-2.5 w-2.5" />}
        </button>
      )}
    </div>
  );
}