import React, { useState, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Phone } from 'lucide-react';
import { format } from 'date-fns';
import { getGameDateTime, getScheduleDateTimes, shortenTitle } from '../utils/scheduleUtils';
import { getDisplayName } from '../utils/nameUtils';
import ShootCompleteModal from '../shoots/ShootCompleteModal';

const statusColors = {
  upcoming: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  confirmed: 'bg-green-500/20 text-green-400 border-green-500/30',
  in_progress: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  completed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const RIG_TYPES = ['Data', 'Fancam', 'Data/Fancam'];

function formatCountdown(ms) {
  if (ms == null) return '—';
  if (ms <= 0) return 'NOW';

  const days = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);

  return `${days > 0 ? `${days}d ` : ''}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getLivePhase(phase, now, phaseDates, gameDate, showAttention, showSound) {
  if (phase.shoot_complete) return { label: 'Complete', color: 'bg-green-500/20 text-green-400 border-green-500/30' };
  if (phase.game_started || (gameDate && now >= gameDate)) return { label: 'Game Time', color: 'bg-red-500/20 text-red-400 border-red-500/30' };
  if (showSound && (phase.sound_started || (phaseDates.sound && now >= phaseDates.sound))) return { label: 'Sound Check', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
  if (showAttention && (phase.attention_started || (phaseDates.attention && now >= phaseDates.attention))) return { label: 'Attention', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };
  if (phase.pre_shoot_started || (phaseDates.pre_shoot && now >= phaseDates.pre_shoot)) return { label: 'Pre-Shoot', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' };
  if (phase.setup_complete || (phaseDates.setup && now >= phaseDates.setup)) return { label: 'Setup', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' };
  return null;
}

function PhaseQuickButton({ label, time, done, onClick, canClick }) {
  return (
    <button
      type="button"
      disabled={!canClick}
      onClick={canClick ? onClick : undefined}
      className={`inline-flex items-center gap-3 rounded-lg border px-5 py-2 text-sm transition-colors ${
        done
          ? 'border-green-700 bg-green-950/30 text-green-300'
          : 'border-blue-900/60 bg-gray-900/60 text-gray-200 hover:border-blue-600 hover:bg-gray-800/80'
      } ${canClick ? 'cursor-pointer' : 'cursor-default opacity-80'}`}
      style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
    >
      <span>{label}</span>
      <span className={`font-mono font-semibold ${done ? 'text-green-300' : 'text-blue-400'}`}>
        {time || '—'}
      </span>
    </button>
  );
}

export default function CountdownCard({
  shoot,
  isAdmin = false,
  rigSettings = [],
  onUpdate,
  userEmail,
  allUsers = []
}) {
  const [now, setNow] = useState(new Date());
  const [expanded, setExpanded] = useState(false);
  const [updatingRig, setUpdatingRig] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [localPhaseStatus, setLocalPhaseStatus] = useState(null);

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const matchedRig = rigSettings.find(
    (r) => r.team && shoot.client && r.team.toLowerCase().trim() === shoot.client.toLowerCase().trim()
  );

  const showAttention = matchedRig?.attention_enabled === true;
  const showSound = matchedRig?.sound === true;

  const gameDate = getGameDateTime(shoot);
  const phaseDates = getScheduleDateTimes(shoot);
  const isAssigned = shoot.assigned_operators?.includes(userEmail);
  const canMarkPhases = isAdmin || isAssigned;

  const COMPLETE_DELAY_MS = 2 * 60 * 60 * 1000;
  const canMarkShootComplete =
    canMarkPhases &&
    shoot.status !== 'completed' &&
    shoot.status !== 'cancelled' &&
    gameDate &&
    now >= new Date(gameDate.getTime() + COMPLETE_DELAY_MS);

  const effectivePhaseStatus = localPhaseStatus || shoot.phase_status || {};

  useEffect(() => {
    if (!onUpdate || !canMarkPhases || !shoot.date) return;

    const GRACE_MS = 5 * 60 * 1000;
    const candidates = [
      { key: 'setup_complete', date: phaseDates.setup },
      { key: 'pre_shoot_started', date: phaseDates.pre_shoot },
      showAttention ? { key: 'attention_started', date: phaseDates.attention } : null,
      showSound ? { key: 'sound_started', date: phaseDates.sound } : null,
    ].filter(Boolean);

    const updates = {};
    candidates.forEach((c) => {
      if (!effectivePhaseStatus[c.key] && c.date && (now - c.date) >= GRACE_MS) {
        updates[c.key] = c.date.toISOString();
      }
    });

    if (Object.keys(updates).length > 0) {
      onUpdate(shoot.id, { phase_status: { ...effectivePhaseStatus, ...updates } });
    }
  }, [
    now,
    onUpdate,
    canMarkPhases,
    shoot.date,
    shoot.id,
    phaseDates.setup,
    phaseDates.pre_shoot,
    phaseDates.attention,
    phaseDates.sound,
    showAttention,
    showSound,
    effectivePhaseStatus,
  ]);

  const nextPhaseTarget = (() => {
    const candidates = [
      { label: 'Setup', key: 'setup_complete', date: phaseDates.setup },
      { label: 'Pre-Shoot', key: 'pre_shoot_started', date: phaseDates.pre_shoot },
      showAttention ? { label: 'Attention', key: 'attention_started', date: phaseDates.attention } : null,
      showSound ? { label: 'Sound Check', key: 'sound_started', date: phaseDates.sound } : null,
      { label: 'Game Time', key: 'game_started', date: gameDate },
    ].filter(Boolean);

    for (const c of candidates) {
      if (!effectivePhaseStatus[c.key] && c.date) return c;
    }

    return { label: 'Game Time', date: gameDate };
  })();

  const targetDiff = nextPhaseTarget?.date ? nextPhaseTarget.date - now : null;
  const targetIsPast = targetDiff !== null && targetDiff <= 0;
  const countdown = targetDiff == null ? '—' : targetIsPast ? 'NOW' : formatCountdown(targetDiff);
  const countdownLabel = nextPhaseTarget?.label || 'Game Time';
  const livePhase = getLivePhase(effectivePhaseStatus, now, phaseDates, gameDate, showAttention, showSound);
  const rigLabel = matchedRig?.rig_type || shoot.rig_type_override || shoot.rig_type || null;

  const quickPhases = [
    {
      label: 'Setup',
      time: phaseDates.setup ? format(phaseDates.setup, 'HH:mm') : null,
      doneKey: 'setup_complete',
    },
    {
      label: 'Pre-Shoot',
      time: phaseDates.pre_shoot ? format(phaseDates.pre_shoot, 'HH:mm') : null,
      doneKey: 'pre_shoot_started',
    },
    showAttention
      ? {
          label: 'Attention',
          time: phaseDates.attention ? format(phaseDates.attention, 'HH:mm') : null,
          doneKey: 'attention_started',
        }
      : null,
    showSound
      ? {
          label: 'Sound Check',
          time: phaseDates.sound ? format(phaseDates.sound, 'HH:mm') : null,
          doneKey: 'sound_started',
        }
      : null,
  ].filter(Boolean);

  const handleRigTypeChange = async (type) => {
    if (!onUpdate) return;

    try {
      setUpdatingRig(true);
      await onUpdate(shoot.id, {
        rig_type_override: shoot.rig_type_override === type ? null : type
      });
    } finally {
      setUpdatingRig(false);
    }
  };

  const handlePhaseToggle = async (phaseKey) => {
    if (!onUpdate) return;

    const current = effectivePhaseStatus[phaseKey];
    const nextStatus = {
      ...effectivePhaseStatus,
      [phaseKey]: current ? null : new Date().toISOString()
    };

    setLocalPhaseStatus(nextStatus);

    try {
      await onUpdate(shoot.id, { phase_status: nextStatus });
    } catch (e) {
      setLocalPhaseStatus(effectivePhaseStatus);
    }
  };

  return (
    <>
      {showCompleteModal && (
        <ShootCompleteModal
          shoot={shoot}
          user={{
            email: userEmail,
            full_name: allUsers.find((u) => u.email === userEmail)?.full_name || ''
          }}
          onClose={(completed) => {
            setShowCompleteModal(false);

            if (completed) {
              onUpdate?.(shoot.id, {
                status: 'completed',
                phase_status: {
                  ...effectivePhaseStatus,
                  shoot_complete: new Date().toISOString()
                }
              });
            }
          }}
        />
      )}

      <div className={`rounded-xl border bg-gray-900/95 transition-all ${expanded ? 'border-gray-700' : 'border-gray-800'} hover:border-gray-600`}>
        <div className="px-4 py-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.2fr_0.9fr_auto] md:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-semibold text-white">
                  {shortenTitle(shoot.title)}
                </span>
                {rigLabel && <span className="text-xs font-medium text-blue-400">{rigLabel}</span>}
              </div>

              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                <span>{format(new Date(`${shoot.date}T12:00:00`), 'EEE, MMM d')}</span>
                {shoot.game_time && <span className="font-mono">{shoot.game_time}</span>}
                {phaseDates.setup && format(phaseDates.setup, 'yyyy-MM-dd') !== shoot.date && (
                  <span className="rounded bg-purple-950/30 px-1.5 py-0.5 font-mono text-purple-300">
                    setup {format(phaseDates.setup, 'EEE HH:mm')}
                  </span>
                )}
                {isAdmin && shoot.assigned_operators?.length > 0 ? (
                  <span className="text-gray-400">
                    {shoot.assigned_operators
                      .map((e) => getDisplayName(allUsers.find((u) => u.email === e), e))
                      .join(', ')}
                  </span>
                ) : !isAdmin && !shoot.assigned_operators?.length ? (
                  <span className="italic text-orange-400">Unassigned</span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center text-center">
              <div
                className={`font-mono text-2xl font-bold tracking-tight ${
                  targetIsPast
                    ? 'text-red-400'
                    : targetDiff !== null && targetDiff < 30 * 60000
                      ? 'text-yellow-400'
                      : 'text-blue-300'
                }`}
              >
                {countdown}
              </div>
              <div className="mt-0.5 text-xs text-gray-500">until {countdownLabel}</div>
            </div>

            <div className="flex items-center justify-between gap-2 md:flex-col md:items-end">
              {livePhase ? (
                <Badge className={`text-xs border ${livePhase.color}`}>{livePhase.label}</Badge>
              ) : (
                <Badge className={`text-xs border ${statusColors[shoot.status] || statusColors.upcoming}`}>
                  {shoot.status}
                </Badge>
              )}

              <button
                onClick={() => setExpanded((v) => !v)}
                className="p-1 text-gray-500 transition-colors hover:text-gray-300"
              >
                {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {quickPhases.map((phase) => (
              <PhaseQuickButton
                key={phase.label}
                label={phase.label}
                time={phase.time}
                done={!!effectivePhaseStatus[phase.doneKey]}
                canClick={canMarkPhases}
                onClick={() => handlePhaseToggle(phase.doneKey)}
              />
            ))}

            {canMarkShootComplete && (
              <button
                onClick={() => setShowCompleteModal(true)}
                className="inline-flex items-center justify-center rounded-lg border border-blue-600 bg-blue-600/80 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-500"
              >
                Mark Complete
              </button>
            )}

            {shoot.status === 'completed' && (
              <div className="inline-flex items-center justify-center rounded-lg border border-green-700 bg-green-950/20 px-6 py-2 text-sm font-medium text-green-400">
                ✓ Shoot Complete
              </div>
            )}
          </div>
        </div>

        {expanded && (
          <div className="space-y-3 border-t border-gray-800 px-4 py-4">
            {isAdmin && onUpdate && (
              <div>
                <p className="mb-1.5 text-xs uppercase tracking-wider text-gray-600">Rig Type Override</p>
                <div className="flex gap-1">
                  {RIG_TYPES.map((type) => (
                    <button
                      key={type}
                      disabled={updatingRig}
                      onClick={() => handleRigTypeChange(type)}
                      className={`flex-1 rounded border px-2 py-1.5 text-xs transition-colors ${
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

            {matchedRig?.notes && (
              <div className="rounded-lg border border-blue-900/20 bg-blue-900/10 p-2.5">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-400">Rig Notes</p>
                <p className="text-xs italic leading-relaxed text-blue-200/90">{matchedRig.notes}</p>
              </div>
            )}

            {(shoot.description || shoot.notes) && (
              <div>
                <p className="mb-1 text-xs uppercase tracking-wider text-gray-600">Notes</p>
                <p className="text-xs text-gray-300">{shoot.description || shoot.notes}</p>
              </div>
            )}

            {shoot.assigned_operators?.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs uppercase tracking-wider text-gray-600">Operators</p>
                <div className="flex flex-wrap gap-1">
                  {shoot.assigned_operators.map((e) => {
                    const u = allUsers.find((x) => x.email === e);
                    return (
                      <span key={e} className="rounded-full bg-gray-800 px-2 py-0.5 text-xs text-gray-300">
                        {getDisplayName(u, e)}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {shoot.standby_admin && (
              <div className="flex items-center gap-1.5 text-xs text-yellow-400">
                <Phone className="h-3 w-3" />
                Standby: {getDisplayName(allUsers.find((u) => u.email === shoot.standby_admin), shoot.standby_admin)}
              </div>
            )}

            <a
              href={`/Calendar?shootId=${shoot.id}`}
              className="block pt-1 text-center text-xs text-blue-500 hover:text-blue-400"
            >
              Open full detail in Calendar →
            </a>
          </div>
        )}
      </div>
    </>
  );
}