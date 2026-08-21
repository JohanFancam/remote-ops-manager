import React, { useState, useEffect, useMemo } from 'react';
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, Phone, Copy, Check, UserX } from 'lucide-react';
import { format } from 'date-fns';
import { getGameDateTime, getScheduleDateTimes, shortenTitle } from '../utils/scheduleUtils';
import { getDisplayName } from '../utils/nameUtils';
import ShootCompleteModal from '../shoots/ShootCompleteModal';
import { removeEmail, hasEmail, findPairedShootForUnassign } from '@/utils/assignmentApproval';

const statusColors = {
  upcoming: 'bg-teal-600/20 text-teal-400 border-teal-800',
  confirmed: 'bg-green-500/20 text-emerald-400 border-green-500/30',
  in_progress: 'bg-yellow-500/20 text-amber-400 border-yellow-500/30',
  completed: 'bg-gray-500/20 text-zinc-400 border-gray-500/30',
  cancelled: 'bg-red-950/400/20 text-red-400 border-red-800',
};

const RIG_TYPES = ['Data', 'Fancam'];

function formatCountdown(ms) {
  if (ms == null) return '—';
  if (ms <= 0) return 'NOW';

  const days = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);

  return `${days > 0 ? `${days}d ` : ''}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getLivePhase(shoot, phase, now, phaseDates, gameDate, showAttention, showSound) {
  if (shoot.status === 'completed') {
    return { label: 'Complete', color: 'bg-gray-500/20 text-zinc-400 border-gray-500/30' };
  }
  if (phase.game_started || (gameDate && now >= gameDate)) {
    return { label: 'Game Started', color: 'bg-red-950/400/20 text-red-400 border-red-800' };
  }
  if (showSound && (phase.sound_started || (phaseDates.sound && now >= phaseDates.sound))) {
    return { label: 'Sound Check', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' };
  }
  if (showAttention && (phase.attention_started || (phaseDates.attention && now >= phaseDates.attention))) {
    return { label: 'Attention', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' };
  }
  if (phase.pre_shoot_started || (phaseDates.pre_shoot && now >= phaseDates.pre_shoot)) {
    return { label: 'Pre-Shoot', color: 'bg-yellow-500/20 text-amber-400 border-yellow-500/30' };
  }
  if (phase.setup_complete || (phaseDates.setup && now >= phaseDates.setup)) {
    return { label: 'Setup', color: 'bg-teal-600/20 text-teal-400 border-teal-800' };
  }
  return null;
}

function PhaseQuickButton({ label, time, done, onClick, canClick }) {
  return (
    <button
      type="button"
      disabled={!canClick}
      onClick={canClick ? onClick : undefined}
      className={`inline-flex h-8 min-w-[118px] items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors ${
        done
          ? 'border-emerald-800 bg-emerald-950/40 text-green-300'
          : 'border-zinc-800 bg-zinc-800/70 text-gray-200 hover:border-blue-500/70 hover:bg-teal-950/40 hover:text-zinc-100'
      } ${canClick ? 'cursor-pointer' : 'cursor-default opacity-70'}`}
      style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
    >
      <span>{label}</span>
      <span className={`font-mono font-semibold ${done ? 'text-green-300' : 'text-teal-400'}`}>
        {time || '—'}
      </span>
    </button>
  );
}

function formatCameraValue(cam) {
  if (!cam || typeof cam !== 'object') return null;
  const shutter = cam.shutter || '—';
  const aperture = cam.aperture || '—';
  const iso = cam.iso || '—';
  return `${shutter} · ${aperture} · ISO ${iso}`;
}

function RigConfigRow({ label, value, accent = false }) {
  if (!value) return null;

  return (
    <div className={`flex items-center justify-between rounded-md px-3 py-2 text-xs ${
      accent ? 'bg-emerald-950/30 text-emerald-300' : 'bg-zinc-800/70'
    }`}>
      <span className={accent ? 'text-emerald-300' : 'text-zinc-400'}>{label}</span>
      <span className={`font-mono ${accent ? 'text-emerald-200' : 'text-gray-100'}`}>{value}</span>
    </div>
  );
}

export default function CountdownCard({
  shoot,
  isAdmin = false,
  rigSettings = [],
  onUpdate,
  userEmail,
  allUsers = [],
  allShoots = [],
  appSettings = [],
  showReadyMessage = true,
  onContextMenu,
  onCardClick,
}) {
  const [now, setNow] = useState(new Date());
  const [expanded, setExpanded] = useState(false);
  const [updatingRig, setUpdatingRig] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [readyCopied, setReadyCopied] = useState(false);
  const [localPhaseStatus, setLocalPhaseStatus] = useState(null);

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const matchedRig = useMemo(() => {
    const client = (shoot.client || '').toLowerCase().trim();
    const title = (shoot.title || '').toLowerCase().trim();
    return rigSettings.find((r) => {
      const team = (r.team || '').toLowerCase().trim();
      if (!team) return false;
      return (
        team === client || team === title ||
        client.includes(team) || title.includes(team) ||
        team.includes(client) || team.includes(title)
      );
    }) || null;
  }, [rigSettings, shoot.client, shoot.title]);

  const showAttention = matchedRig?.attention_enabled === true;
  const showSound = matchedRig?.sound_enabled === true;

  const gameDate = getGameDateTime(shoot);
  const phaseDates = getScheduleDateTimes(shoot);
  const isAssigned = shoot.assigned_operators?.includes(userEmail);
  const canMarkPhases = isAdmin || isAssigned;

  const canOpenShootComplete =
    canMarkPhases &&
    shoot.status !== 'completed' &&
    shoot.status !== 'cancelled';

  const effectivePhaseStatus = localPhaseStatus || shoot.phase_status || {};

  useEffect(() => {
    if (!onUpdate || !canMarkPhases || !shoot.date || shoot.status === 'completed') return;

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
    shoot.status,
    phaseDates.setup,
    phaseDates.pre_shoot,
    phaseDates.attention,
    phaseDates.sound,
    showAttention,
    showSound,
    effectivePhaseStatus,
  ]);

  const nextPhaseTarget = (() => {
    if (shoot.status === 'completed') return { label: 'Complete', date: null };

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
  const countdown =
    shoot.status === 'completed'
      ? 'Completed'
      : targetDiff == null
        ? '—'
        : targetIsPast
          ? 'NOW'
          : formatCountdown(targetDiff);

  const countdownLabel = shoot.status === 'completed' ? 'shoot complete' : (nextPhaseTarget?.label || 'Game Time');
  const livePhase = getLivePhase(shoot, effectivePhaseStatus, now, phaseDates, gameDate, showAttention, showSound);
  const rigLabel = shoot.rig_type_override || matchedRig?.rig_type || shoot.rig_type || null;
  const effectiveRigType = shoot.rig_type_override || matchedRig?.rig_type || 'Data';
  const highlightData = effectiveRigType === 'Data' || effectiveRigType === 'Data/Fancam';
  const highlightFancam = effectiveRigType === 'Fancam' || effectiveRigType === 'Data/Fancam';
  const shootTypeLabel = (() => {
    const baseType = shoot.rig_type_override || matchedRig?.rig_type || shoot.rig_type || 'Data';
    const parts = [baseType];
    if (matchedRig?.sound_enabled && !String(baseType).toLowerCase().includes('sound')) parts.push('Sound');
    return parts.filter(Boolean).join('/');
  })();

  const buildReadyMessage = () => {
    const team = matchedRig?.team || shoot.client || shoot.title || 'Unknown Team';
    const timeLabel = (value) => value ? format(value, 'HH:mm') : 'TBC';
    const lines = [
      'Shoots ready for today :',
      '',
      `• Team: ${team}`,
      '',
      `• Setup: ${timeLabel(phaseDates.setup)}`,
      `• Pre-Shoot: ${timeLabel(phaseDates.pre_shoot)}`,
      showAttention ? `• Attention: ${timeLabel(phaseDates.attention)}` : null,
      showSound ? `• Sound Check: ${timeLabel(phaseDates.sound)}` : null,
      `• Game Time: ${timeLabel(gameDate)}`,
      '',
      `• Venue: ${shoot.location || 'TBC'}`,
      `• Shoot Type: ${shootTypeLabel}`,
    ].filter((line) => line !== null);
    return lines.join('\n');
  };

  const handleCopyReadyMessage = async () => {
    await navigator.clipboard.writeText(buildReadyMessage());
    setReadyCopied(true);
    setTimeout(() => setReadyCopied(false), 2000);
  };


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
    {
      label: 'Game Start',
      time: gameDate ? format(gameDate, 'HH:mm') : null,
      doneKey: 'game_started',
    },
  ].filter(Boolean);

  const handleUnassignSelf = async () => {
    if (!userEmail || !onUpdate) return;
    const autoAssignTeams = (() => {
      const raw = appSettings.find(s => s.key === 'auto_assign_teams')?.value;
      return raw ? JSON.parse(raw) : ['Reds', 'Red Sox', 'Rangers'];
    })();
    const windowMins = (() => {
      const raw = appSettings.find(s => s.key === 'auto_assign_window_hours')?.value;
      return (raw ? Number(raw) : 2) * 60;
    })();

    const paired = findPairedShootForUnassign(shoot, allShoots, autoAssignTeams, windowMins, userEmail);
    const confirmMsg = paired
      ? `Are you sure you want to unassign from this shoot and its paired shoot?`
      : `Are you sure you want to unassign from this shoot?`;
    if (!window.confirm(confirmMsg)) return;

    await onUpdate(shoot.id, {
      assigned_operators: removeEmail(shoot.assigned_operators, userEmail),
      pending_operators: removeEmail(shoot.pending_operators, userEmail),
      pre_approved_operators: removeEmail(shoot.pre_approved_operators, userEmail),
      auto_assigned_for: removeEmail(shoot.auto_assigned_for, userEmail),
    });
    if (paired) {
      await onUpdate(paired.id, {
        assigned_operators: removeEmail(paired.assigned_operators, userEmail),
        pending_operators: removeEmail(paired.pending_operators, userEmail),
        pre_approved_operators: removeEmail(paired.pre_approved_operators, userEmail),
        auto_assigned_for: removeEmail(paired.auto_assigned_for, userEmail),
      });
    }
  };

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
    if (!onUpdate || shoot.status === 'completed') return;

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

  const dataHdValue = matchedRig?.data_enabled !== false && matchedRig?.data_hd ? formatCameraValue(matchedRig.data_hd) : null;
  const dataWideValue = matchedRig?.data_enabled !== false && matchedRig?.data_wide_enabled !== false && matchedRig?.data_wide ? formatCameraValue(matchedRig.data_wide) : null;
  const fancamDayHdValue = matchedRig?.fancam_day_enabled && matchedRig?.fancam_day_hd ? formatCameraValue(matchedRig.fancam_day_hd) : null;
  const fancamDayWideValue = matchedRig?.fancam_day_enabled && matchedRig?.fancam_day_wide_enabled !== false && matchedRig?.fancam_day_wide ? formatCameraValue(matchedRig.fancam_day_wide) : null;
  const fancamNightHdValue = matchedRig?.fancam_night_enabled && matchedRig?.fancam_night_hd ? formatCameraValue(matchedRig.fancam_night_hd) : null;
  const fancamNightWideValue = matchedRig?.fancam_night_enabled && matchedRig?.fancam_night_wide_enabled !== false && matchedRig?.fancam_night_wide ? formatCameraValue(matchedRig.fancam_night_wide) : null;
  const attentionValue = showAttention && matchedRig?.attention_hd ? formatCameraValue(matchedRig.attention_hd) : null;
  const soundValue = showSound ? 'Enabled' : null;

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

      <div
        className={`rounded-xl border transition-all ${
          shoot.status === 'completed'
            ? 'border-zinc-800 bg-zinc-900 opacity-70'
            : expanded
              ? 'border-zinc-800 bg-zinc-900/95'
              : 'border-zinc-800 bg-zinc-900/95'
        } hover:border-zinc-700`}
        onContextMenu={onContextMenu}
      >
        <div className="px-4 py-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.2fr_0.9fr_auto] md:items-start">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-semibold text-zinc-100">
                  {shortenTitle(shoot.title)}
                </span>
                {rigLabel && <span className="text-xs font-medium text-teal-400">{rigLabel}</span>}
              </div>

              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span>{format(new Date(`${shoot.date}T12:00:00`), 'EEE, MMM d')}</span>
                {shoot.game_time && <span className="font-mono">{shoot.game_time}</span>}
                {phaseDates.setup && (
                  <span className="rounded bg-purple-950/30 px-1.5 py-0.5 font-mono text-purple-300">
                    setup {format(phaseDates.setup, 'EEE HH:mm')}
                  </span>
                )}
                {isAdmin && !isAssigned && shoot.assigned_operators?.length > 0 ? (
                  <span className="text-zinc-400">
                    {shoot.assigned_operators
                      .map((e) => getDisplayName(allUsers.find((u) => u.email === e), e))
                      .join(', ')}
                  </span>
                ) : !shoot.assigned_operators?.length ? (
                  <span className="italic text-orange-400">Unassigned</span>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col items-center justify-center text-center">
              <div
                className={`font-mono text-2xl font-bold tracking-tight ${
                  shoot.status === 'completed'
                    ? 'text-zinc-400'
                    : targetIsPast
                      ? 'text-red-400'
                      : targetDiff !== null && targetDiff < 30 * 60000
                        ? 'text-amber-400'
                        : 'text-teal-400'
                }`}
              >
                {countdown}
              </div>
              <div className="mt-0.5 text-xs text-zinc-500">{countdownLabel}</div>
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
                className="p-1 text-zinc-500 transition-colors hover:text-zinc-300"
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
                canClick={canMarkPhases && shoot.status !== 'completed'}
                onClick={() => handlePhaseToggle(phase.doneKey)}
              />
            ))}

            {shoot.status !== 'completed' && shoot.status !== 'cancelled' && (
              <button
                onClick={() => canOpenShootComplete && setShowCompleteModal(true)}
                disabled={!canOpenShootComplete}
                className={`inline-flex h-8 min-w-[118px] items-center justify-center rounded-md border px-2.5 text-xs font-medium transition-colors ${
                  canOpenShootComplete
                    ? 'border-teal-500 bg-teal-600/80 text-white hover:bg-teal-600'
                    : 'border-zinc-800 bg-zinc-800 text-zinc-500 cursor-not-allowed'
                }`}
              >
                Shoot Complete
              </button>
            )}

            {shoot.status === 'completed' && (
              <div className="inline-flex h-8 min-w-[118px] items-center justify-center rounded-md border border-zinc-700 bg-zinc-800 px-2.5 text-xs font-medium text-zinc-400">
                ✓ Shoot Complete
              </div>
            )}

            {showReadyMessage && (
              <button
                type="button"
                onClick={handleCopyReadyMessage}
                className="inline-flex h-8 min-w-[118px] items-center justify-center rounded-md border border-teal-500 bg-teal-950/40 px-2.5 text-xs font-medium text-teal-400 transition-colors hover:bg-teal-950/40 hover:text-blue-100"
              >
                {readyCopied ? <><Check className="mr-1 h-3.5 w-3.5" />Copied</> : <><Copy className="mr-1 h-3.5 w-3.5" />Ready Message</>}
              </button>
            )}

            {isAssigned && shoot.status !== 'completed' && shoot.status !== 'cancelled' && (
              <button
                type="button"
                onClick={handleUnassignSelf}
                className="inline-flex h-8 min-w-[118px] items-center justify-center rounded-md border border-red-700/60 bg-red-950/20 px-2.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-950/40 hover:text-red-400"
              >
                <UserX className="mr-1 h-3.5 w-3.5" />Unassign Me
              </button>
            )}
          </div>
        </div>

        {expanded && (
          <div className="space-y-4 border-t border-zinc-800 px-4 py-4">
            {isAdmin && onUpdate && (
              <div>
                <p className="mb-2 text-xs uppercase tracking-wider text-gray-600">Rig Type Override</p>
                <div className="flex gap-2">
                  {RIG_TYPES.map((type) => (
                    <button
                      key={type}
                      disabled={updatingRig}
                      onClick={() => handleRigTypeChange(type)}
                      className={`flex-1 rounded border px-2 py-2 text-xs transition-colors ${
                        shoot.rig_type_override === type
                          ? 'bg-orange-600 border-orange-500 text-white font-medium'
                          : 'bg-zinc-800 border-zinc-800 text-zinc-400 hover:border-gray-500 hover:text-zinc-100'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="mb-2 text-xs uppercase tracking-wider text-gray-600">Rig Config</p>

              <div className="space-y-2 text-xs text-zinc-400">
                {(matchedRig?.sport || matchedRig?.venue_type) && (
                  <div className="flex flex-wrap gap-4">
                    {matchedRig?.sport && (
                      <span>
                        Sport: <span className="font-medium text-zinc-100">{matchedRig.sport}</span>
                      </span>
                    )}
                    {matchedRig?.venue_type && (
                      <span>
                        Venue: <span className="font-medium text-zinc-100">{matchedRig.venue_type}</span>
                      </span>
                    )}
                  </div>
                )}

                {Array.isArray(matchedRig?.remote_rigs) && matchedRig.remote_rigs.length > 0 && (
                  <div>
                    Remotes: <span className="text-zinc-100">{matchedRig.remote_rigs.join(', ')}</span>
                  </div>
                )}
              </div>

              <div className="mt-3 space-y-2">
                {dataHdValue && <RigConfigRow label="Data HD" value={dataHdValue} accent={highlightData} />}
                {dataWideValue && <RigConfigRow label="Data Wide" value={dataWideValue} accent={highlightData} />}
                {fancamDayHdValue && <RigConfigRow label="Fancam Day HD" value={fancamDayHdValue} accent={highlightFancam} />}
                {fancamDayWideValue && <RigConfigRow label="Fancam Day Wide" value={fancamDayWideValue} accent={highlightFancam} />}
                {fancamNightHdValue && <RigConfigRow label="Fancam Night HD" value={fancamNightHdValue} accent={highlightFancam} />}
                {fancamNightWideValue && <RigConfigRow label="Fancam Night Wide" value={fancamNightWideValue} accent={highlightFancam} />}
                {attentionValue && <RigConfigRow label="Attention" value={attentionValue} accent={showAttention || highlightData || highlightFancam} />}
                {soundValue && <RigConfigRow label="Sound Recording" value={soundValue} accent={showSound || highlightData || highlightFancam} />}
              </div>
            </div>

            {matchedRig?.notes && (
              <div className="rounded-lg border border-teal-800 bg-teal-950/40 p-2.5">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-teal-400">Rig Notes</p>
                <p className="text-xs italic leading-relaxed text-blue-200/90">{matchedRig.notes}</p>
              </div>
            )}

            {(shoot.description || shoot.notes) && (
              <div>
                <p className="mb-1 text-xs uppercase tracking-wider text-gray-600">Notes</p>
                <p className="text-xs text-zinc-400">{shoot.description || shoot.notes}</p>
              </div>
            )}

            {shoot.assigned_operators?.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs uppercase tracking-wider text-gray-600">Operators</p>
                <div className="flex flex-wrap gap-1">
                  {shoot.assigned_operators.map((e) => {
                    const u = allUsers.find((x) => x.email === e);
                    return (
                      <span key={e} className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
                        {getDisplayName(u, e)}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {shoot.standby_admin && (
              <div className="flex items-center gap-1.5 text-xs text-amber-400">
                <Phone className="h-3 w-3" />
                Standby: {getDisplayName(allUsers.find((u) => u.email === shoot.standby_admin), shoot.standby_admin)}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}