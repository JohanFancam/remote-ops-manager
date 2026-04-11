import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin, Calendar, Clock, Camera, Zap, Volume2, AlertTriangle,
  ChevronDown, ChevronUp, Phone, Tv2, Flag
} from 'lucide-react';
import { format } from 'date-fns';
import { getGameDateTime, getSchedule } from '../utils/scheduleUtils';
import { getDisplayName } from '../utils/nameUtils';
import ShootCompleteModal from '../shoots/ShootCompleteModal';

const statusColors = {
  upcoming: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  confirmed: 'bg-green-500/20 text-green-400 border-green-500/30',
  in_progress: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  completed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

// Derive the current live phase label from phase_status + schedule times
function getLivePhase(shoot, now, schedule, gameDate, showAttention, showSound) {
  const phase = shoot.phase_status || {};
  if (phase.shoot_complete) return { label: 'Complete', color: 'bg-green-500/20 text-green-400 border-green-500/30' };

  if (!schedule) return null;

  const toDate = (timeStr) => {
    if (!timeStr || !shoot.date) return null;
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date(shoot.date + 'T00:00:00');
    d.setHours(h, m, 0, 0);
    return d;
  };

  const setupTime = toDate(schedule.setup);
  const preShootTime = toDate(schedule.pre_shoot);
  const attentionTime = showAttention ? toDate(schedule.attention) : null;
  const soundTime = showSound ? toDate(schedule.sound) : null;

  // Walk through phases newest-first to find current active phase
  if (phase.game_started) {
    return { label: 'Game In Progress', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
  }
  if (gameDate && now >= gameDate) {
    return { label: 'Game Time', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
  }
  if (phase.sound_started || (soundTime && now >= soundTime && showSound)) {
    return { label: 'Sound Check', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
  }
  if (phase.attention_started || (attentionTime && now >= attentionTime && showAttention)) {
    return { label: 'Attention', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };
  }
  if (phase.pre_shoot_started || (preShootTime && now >= preShootTime)) {
    return { label: 'Pre-Shoot', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
  }
  if (phase.setup_complete || (setupTime && now >= setupTime)) {
    return { label: 'Setup', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
  }
  return null;
}

// Find the next upcoming phase and return its time + label
function getNextPhase(shoot, now, schedule, gameDate, showAttention, showSound) {
  const phase = shoot.phase_status || {};
  if (phase.shoot_complete || !schedule) return null;

  const toDate = (timeStr) => {
    if (!timeStr || !shoot.date) return null;
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date(shoot.date + 'T00:00:00');
    d.setHours(h, m, 0, 0);
    return d;
  };

  const candidates = [
    { label: 'Setup', key: 'setup_complete', time: toDate(schedule.setup) },
    { label: 'Pre-Shoot', key: 'pre_shoot_started', time: toDate(schedule.pre_shoot) },
    showAttention && { label: 'Attention', key: 'attention_started', time: toDate(schedule.attention) },
    showSound && { label: 'Sound Check', key: 'sound_started', time: toDate(schedule.sound) },
    { label: 'Game Time', key: 'game_started', time: gameDate },
  ].filter(Boolean);

  for (const c of candidates) {
    if (c.key && phase[c.key]) continue; // already done
    if (c.time && c.time > now) return c;
  }
  return null;
}

const RIG_TYPES = ['Data', 'Fancam', 'Data/Fancam'];

function PhaseRow({ label, time, Icon, done, active, countdown, onClick, canClick }) {
  return (
    <button
      type="button"
      disabled={!canClick}
      onClick={canClick ? onClick : undefined}
      className={`w-full text-left flex items-center justify-between py-1.5 px-2 rounded-lg transition-colors ${
        done ? 'bg-green-950/40 border border-green-800/50' :
        active ? 'bg-blue-950/40 border border-blue-800/50' :
        'bg-transparent border border-transparent'
      } ${canClick ? 'cursor-pointer hover:border-gray-600 hover:bg-gray-800/50 active:opacity-70' : 'cursor-default'}`}
      style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
    >
      <span className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${done ? 'text-green-400' : active ? 'text-blue-400' : 'text-gray-600'}`} />
        <span className={`text-xs ${done ? 'text-green-300 line-through' : active ? 'text-blue-200 font-semibold' : 'text-gray-500'}`}>{label}</span>
        {done && <span className="text-xs text-green-500">✓</span>}
      </span>
      <div className="text-right flex items-center gap-2">
        <div>
          <span className={`font-mono text-xs ${done ? 'text-green-400' : active ? 'text-blue-300 font-bold' : 'text-gray-600'}`}>{time}</span>
          {!done && countdown && <p className="text-xs text-gray-600 font-mono">{countdown}</p>}
        </div>
        {canClick && (
          <span className={`text-xs px-1.5 py-0.5 rounded border ${done ? 'border-green-700 text-green-500 bg-green-950/50' : 'border-gray-700 text-gray-500 bg-gray-800/50'}`}>
            {done ? 'undo' : 'mark done'}
          </span>
        )}
      </div>
    </button>
  );
}

export default function CountdownCard({ shoot, standbyAdmins = [], isAdmin = false, rigSettings = [], onUpdate, userEmail, allUsers = [] }) {
  const [now, setNow] = useState(new Date());
  const [expanded, setExpanded] = useState(false);
  const [updatingRig, setUpdatingRig] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [localPhaseStatus, setLocalPhaseStatus] = useState(null);

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  // Auto-confirm phases: if a phase time has passed by 5+ minutes and it hasn't been marked done, auto-mark it
  useEffect(() => {
    if (!onUpdate || !canMarkPhases || !schedule || !shoot.date) return;
    const GRACE_MS = 5 * 60 * 1000;
    const toDate = (timeStr) => {
      if (!timeStr) return null;
      const [h, m] = timeStr.split(':').map(Number);
      const d = new Date(shoot.date + 'T00:00:00');
      d.setHours(h, m, 0, 0);
      return d;
    };
    const phase = shoot.phase_status || {};
    const candidates = [
      { key: 'setup_complete', time: toDate(schedule.setup) },
      { key: 'pre_shoot_started', time: toDate(schedule.pre_shoot) },
      showAttention ? { key: 'attention_started', time: toDate(schedule.attention) } : null,
      showSound ? { key: 'sound_started', time: toDate(schedule.sound) } : null,
    ].filter(Boolean);

    const updates = {};
    candidates.forEach(c => {
      if (!phase[c.key] && c.time && (now - c.time) >= GRACE_MS) {
        updates[c.key] = c.time.toISOString(); // use the actual phase time, not now
      }
    });
    if (Object.keys(updates).length > 0) {
      onUpdate(shoot.id, { phase_status: { ...phase, ...updates } });
    }
  }, [now]);

  const gameDate = getGameDateTime(shoot);
  const schedule = getSchedule(shoot);

  const formatCountdown = (ms) => {
    if (ms <= 0) return 'NOW';
    const days = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${days > 0 ? `${days}d ` : ''}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const matchedRig = rigSettings.find(r =>
    r.team && shoot.client &&
    r.team.toLowerCase().trim() === shoot.client.toLowerCase().trim()
  );
  const showAttention = matchedRig?.attention_enabled === true;
  const showSound = matchedRig?.sound === true;

  const isAssigned = shoot.assigned_operators?.includes(userEmail);
  const canMarkPhases = isAdmin || isAssigned;
  const effectivePhaseStatus = localPhaseStatus || shoot.phase_status || {};

  // Count down to next incomplete phase
  const getNextPhaseTarget = () => {
    if (!schedule || !shoot.date) return { label: 'Game Time', date: gameDate };
    const phase = effectivePhaseStatus;
    const toDate = (t) => {
      if (!t) return null;
      const [h, m] = t.split(':').map(Number);
      const d = new Date(shoot.date + 'T00:00:00');
      d.setHours(h, m, 0, 0);
      return d;
    };
    const candidates = [
      { label: 'Setup', key: 'setup_complete', date: toDate(schedule.setup) },
      { label: 'Pre-Shoot', key: 'pre_shoot_started', date: toDate(schedule.pre_shoot) },
      showAttention ? { label: 'Attention', key: 'attention_started', date: toDate(schedule.attention) } : null,
      showSound ? { label: 'Sound Check', key: 'sound_started', date: toDate(schedule.sound) } : null,
      { label: 'Game Time', key: 'game_started', date: gameDate },
    ].filter(Boolean);
    for (const c of candidates) {
      if (!phase[c.key] && c.date) return c;
    }
    return { label: 'Game Time', date: gameDate };
  };

  const nextPhaseTarget = getNextPhaseTarget();
  const targetDiff = nextPhaseTarget?.date ? nextPhaseTarget.date - now : null;
  const targetIsPast = targetDiff !== null && targetDiff <= 0;
  const countdown = targetDiff === null ? '—' : targetIsPast ? 'NOW' : formatCountdown(targetDiff);
  const countdownLabel = nextPhaseTarget?.label || 'Game Time';

  const shootWithEffectivePhase = { ...shoot, phase_status: effectivePhaseStatus };
  const livePhase = getLivePhase(shootWithEffectivePhase, now, schedule, gameDate, showAttention, showSound);
  const nextPhase = getNextPhase(shootWithEffectivePhase, now, schedule, gameDate, showAttention, showSound);
  const nextCountdown = nextPhase?.time ? nextPhase.time - now : null;

  // Effective rig type: shoot override first, then rig setting
  const effectiveRigType = shoot.rig_type_override || matchedRig?.rig_type;
  const rigLabel = effectiveRigType ? (matchedRig?.sound ? `${effectiveRigType}/Sound` : effectiveRigType) : null;

  // Clear optimistic state
  useEffect(() => {
    setLocalPhaseStatus(null);
  }, [shoot.phase_status]);

  const handlePhaseToggle = async (doneKey) => {
    if (!onUpdate || !doneKey) return;
    const current = localPhaseStatus || shoot.phase_status || {};
    const newPhaseStatus = {
      ...current,
      [doneKey]: current[doneKey] ? null : new Date().toISOString(),
    };
    setLocalPhaseStatus(newPhaseStatus);
    await onUpdate(shoot.id, { phase_status: newPhaseStatus });
    // Do NOT clear localPhaseStatus here — wait for shoot prop to update
  };

  const handleRigTypeChange = async (type) => {
    if (!onUpdate) return;
    setUpdatingRig(true);
    await onUpdate(shoot.id, { rig_type_override: shoot.rig_type_override === type ? null : type });
    setUpdatingRig(false);
  };

  const isStandby = !shoot.assigned_operators?.includes('__self__'); // will be determined by parent

  return (
    <>
    {showCompleteModal && (
      <ShootCompleteModal
        shoot={shoot}
        user={{ email: userEmail }}
        onClose={(completed) => {
          setShowCompleteModal(false);
          if (completed && onUpdate) {
            onUpdate(shoot.id, {
              status: 'completed',
              phase_status: { ...shoot.phase_status, shoot_complete: new Date().toISOString() }
            });
          }
        }}
      />
    )}
    <div className={`rounded-xl border transition-colors ${
      targetIsPast ? 'border-red-800/50 bg-red-950/10' : 'bg-gray-900 border-gray-800'
    } hover:border-gray-600`}>
      {/* Collapsed row */}
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white text-sm truncate">{shoot.title}</span>
            {rigLabel && <span className="text-xs text-blue-400 font-medium">{rigLabel}</span>}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500 flex-wrap">
            <span>{format(new Date(shoot.date + 'T12:00:00'), 'EEE, MMM d')}</span>
            {shoot.game_time && <span className="font-mono">{shoot.game_time}</span>}
            {shoot.assigned_operators?.length > 0 ? (
              <span className="text-gray-400">
                {shoot.assigned_operators.map(e => getDisplayName(allUsers.find(u => u.email === e), e)).join(', ')}
              </span>
            ) : (
              <span className="text-orange-400 italic">Unassigned</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <div className={`font-mono font-bold text-sm ${
              targetIsPast ? 'text-red-400' : targetDiff !== null && targetDiff < 30 * 60000 ? 'text-yellow-400' : 'text-blue-300'
            }`}>{countdown}</div>
            <div className="text-xs text-gray-600">until {countdownLabel}</div>
          </div>
          {livePhase ? (
            <Badge className={`text-xs border ${livePhase.color}`}>{livePhase.label}</Badge>
          ) : (
            <Badge className={`text-xs border ${statusColors[shoot.status] || statusColors.upcoming}`}>{shoot.status}</Badge>
          )}
          <button onClick={() => setExpanded(!expanded)} className="p-1 text-gray-500 hover:text-gray-300 transition-colors">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-800 px-4 py-4 space-y-3">
          {/* Admin rig type quick toggle */}
          {isAdmin && onUpdate && (
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wider mb-1.5">Rig Type Override</p>
              <div className="flex gap-1">
                {RIG_TYPES.map(type => (
                  <button
                    key={type}
                    disabled={updatingRig}
                    onClick={() => handleRigTypeChange(type)}
                    className={`flex-1 text-xs py-1.5 px-2 rounded border transition-colors ${
                      shoot.rig_type_override === type
                        ? 'bg-orange-600 border-orange-500 text-white font-medium'
                        : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Schedule phases */}
          {schedule && (
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wider mb-2">Schedule</p>
              {(() => {
                const toDate = (timeStr) => {
                  if (!timeStr || !shoot.date) return null;
                  const [h, m] = timeStr.split(':').map(Number);
                  const d = new Date(shoot.date + 'T00:00:00');
                  d.setHours(h, m, 0, 0);
                  return d;
                };
                const phase = effectivePhaseStatus;
                const phases = [
                  { label: 'Setup', time: schedule.setup, Icon: Zap, doneKey: 'setup_complete', date: toDate(schedule.setup) },
                  { label: 'Pre-Shoot', time: schedule.pre_shoot, Icon: Camera, doneKey: 'pre_shoot_started', date: toDate(schedule.pre_shoot) },
                  showAttention && { label: 'Attention', time: schedule.attention, Icon: AlertTriangle, doneKey: 'attention_started', date: toDate(schedule.attention) },
                  showSound && { label: 'Sound Check', time: schedule.sound, Icon: Volume2, doneKey: 'sound_started', date: toDate(schedule.sound) },
                  { label: 'Game Time', time: schedule.game, Icon: Flag, doneKey: 'game_started', date: gameDate },
                ].filter(Boolean);
                return (
                  <div className="space-y-1">
                    {phases.map((p, i) => {
                      const done = p.doneKey ? !!phase[p.doneKey] : (gameDate && now > gameDate && shoot.status === 'completed');
                      const active = !done && p.date && now >= (phases[i - 1]?.date || new Date(0)) && now < p.date;
                      const msTo = p.date ? p.date - now : null;
                      const cdLabel = msTo !== null && msTo > 0 ? `in ${formatCountdown(msTo)}` : null;
                      return <PhaseRow key={p.label} {...p} done={done} active={active} countdown={cdLabel} canClick={canMarkPhases && !!p.doneKey} onClick={() => handlePhaseToggle(p.doneKey)} />;
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Rig settings */}
          {matchedRig && (
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wider mb-1.5">Rig Config</p>
              {(matchedRig.sport || matchedRig.venue_type) && (
                <div className="flex gap-3 text-xs mb-2">
                  {matchedRig.sport && <span className="text-gray-400">Sport: <span className="text-gray-200">{matchedRig.sport}</span></span>}
                  {matchedRig.venue_type && <span className="text-gray-400">Venue: <span className="text-gray-200">{matchedRig.venue_type}</span></span>}
                </div>
              )}
              {matchedRig.remote_rigs?.length > 0 && (
                <p className="text-xs text-gray-400 mb-2">Remotes: <span className="text-gray-200">{matchedRig.remote_rigs.join(', ')}</span></p>
              )}
              <div className="space-y-1 mb-2">
                {[
                  { label: 'HD', enabled: matchedRig.hd_enabled !== false, cam: matchedRig.hd },
                  { label: 'Wide', enabled: matchedRig.wide_enabled !== false, cam: matchedRig.wide },
                  { label: 'Attention', enabled: !!matchedRig.attention_enabled, cam: matchedRig.attention },
                ].map(({ label, enabled, cam }) => enabled ? (
                  <div key={label} className="flex items-center justify-between bg-gray-800/50 rounded px-2 py-1">
                    <span className="text-xs text-gray-400 w-16">{label}</span>
                    <span className="text-xs text-gray-300 font-mono">{cam?.shutter || '—'} · {cam?.aperture || '—'} · ISO {cam?.iso || '—'}</span>
                  </div>
                ) : null)}
                {matchedRig.sound && (
                  <div className="flex items-center gap-1.5 bg-green-950/20 rounded px-2 py-1">
                    <Volume2 className="h-3 w-3 text-green-400" />
                    <span className="text-xs text-green-400">Sound Recording</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {matchedRig?.notes && (
            <div className="bg-blue-900/10 border border-blue-900/20 rounded-lg p-2.5">
              <p className="text-xs text-blue-400 uppercase tracking-wider mb-1 font-semibold">📝 Rig Notes</p>
              <p className="text-xs text-blue-200/90 italic leading-relaxed">{matchedRig.notes}</p>
            </div>
          )}

          {(shoot.description || shoot.notes) && (
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Notes</p>
              <p className="text-xs text-gray-300">{shoot.description || shoot.notes}</p>
            </div>
          )}

          {shoot.assigned_operators?.length > 0 && (
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wider mb-1.5">Operators</p>
              <div className="flex flex-wrap gap-1">
                {shoot.assigned_operators.map(e => {
                  const u = allUsers.find(u => u.email === e);
                  return <span key={e} className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">{getDisplayName(u, e)}</span>;
                })}
              </div>
            </div>
          )}

          {shoot.standby_admin && (
            <div className="flex items-center gap-1.5 text-xs text-yellow-400">
              <Phone className="h-3 w-3" />
              Standby: {getDisplayName(allUsers.find(u => u.email === shoot.standby_admin), shoot.standby_admin)}
            </div>
          )}

          {canMarkPhases && shoot.status !== 'completed' && shoot.status !== 'cancelled' && (
            <button
              onClick={() => setShowCompleteModal(true)}
              className="w-full mt-1 py-2 rounded-lg border border-green-700 bg-green-950/30 text-green-400 text-xs font-semibold hover:bg-green-950/60 transition-colors"
            >
              ✓ Mark Shoot Complete
            </button>
          )}

          {shoot.status === 'completed' && (
            <div className="w-full mt-1 py-2 rounded-lg border border-green-800 bg-green-950/20 text-green-500 text-xs font-semibold text-center">
              ✓ Shoot Complete
            </div>
          )}

          <a href={`/Calendar?shootId=${shoot.id}`} className="block text-center text-xs text-blue-500 hover:text-blue-400 pt-1">
            Open full detail in Calendar →
          </a>
        </div>
      )}
    </div>
    </>
  );
}