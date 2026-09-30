import React, { useState, useEffect } from 'react';
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronUp, MapPin, Flag, Camera, Zap, Volume2, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { getGameDateTime, getSchedule } from '../utils/scheduleUtils';
import { matchRig, resolveShootLocation } from '../utils/rigUtils';
import { schedulePhaseFlags } from '../utils/schedulePhases';
import { getDisplayName } from '../utils/nameUtils';
import ShootCompleteModal from '../shoots/ShootCompleteModal';
import { SHOOT_STATUS_COLORS, formatStatusLabel, normalizeShootStatus } from '@/utils/shootStatus';

const statusColors = SHOOT_STATUS_COLORS;

function getLivePhaseLabel(shoot, now) {
  const p = shoot.phase_status || {};
  if (p.shoot_complete) return { label: 'Complete', color: 'text-emerald-400' };
  if (p.game_started) return { label: 'Game In Progress', color: 'text-red-400' };
  if (p.sound_started) return { label: 'Sound Check', color: 'text-purple-400' };
  if (p.attention_started) return { label: 'Attention', color: 'text-orange-400' };
  if (p.pre_shoot_started) return { label: 'Pre-Shoot', color: 'text-amber-400' };
  if (p.setup_complete) return { label: 'Setup', color: 'text-blue-400' };
  return null;
}

function formatCountdown(ms) {
  if (ms <= 0) return 'LIVE';
  const d = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${d > 0 ? `${d}d ` : ''}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function PhaseRow({ label, Icon, done, onClick, canClick, time }) {
  return (
    <button
      type="button"
      disabled={!canClick}
      onClick={canClick ? onClick : undefined}
      className={`w-full text-left flex items-center justify-between py-1.5 px-2 rounded-lg transition-colors border ${
        done ? 'bg-emerald-950/40 border-green-800/50' : 'bg-transparent border-transparent hover:border-slate-700 hover:bg-slate-800/60'
      } ${canClick ? 'cursor-pointer' : 'cursor-default'}`}
    >
      <span className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 ${done ? 'text-emerald-400' : 'text-gray-600'}`} />
        <span className={`text-xs ${done ? 'text-green-300 line-through' : 'text-slate-400'}`}>{label}</span>
        {done && <span className="text-xs text-green-500">✓</span>}
      </span>
      <div className="flex items-center gap-2">
        {time && <span className="font-mono text-xs text-gray-600">{time}</span>}
        {canClick && (
          <span className={`text-xs px-1.5 py-0.5 rounded border ${done ? 'border-green-700 text-green-500 bg-emerald-950/40' : 'border-slate-800 text-slate-500 bg-slate-800/40'}`}>
            {done ? 'undo' : 'mark done'}
          </span>
        )}
      </div>
    </button>
  );
}

export default function RemoteShootCard({ shoot, rigSettings = [], onUpdate, userEmail, allUsers = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [now, setNow] = useState(new Date());
  const [localPhase, setLocalPhase] = useState(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => { setLocalPhase(null); }, [shoot.phase_status]);

  const effectivePhase = localPhase || shoot.phase_status || {};
  const gameDate = getGameDateTime(shoot);
  const matchedRig = matchRig(shoot, rigSettings);
  const schedule = getSchedule(shoot, matchedRig);
  const venue = resolveShootLocation(shoot, matchedRig);
  const diff = gameDate ? gameDate - now : null;
  const livePhase = getLivePhaseLabel({ ...shoot, phase_status: effectivePhase }, now);
  const phaseFlags = schedulePhaseFlags(matchedRig);
  const showSetup = phaseFlags.setup;
  const showPreShoot = phaseFlags.pre_shoot;
  const showAttention = phaseFlags.attention;
  const showSound = phaseFlags.sound;
  const showSoundTrigger = phaseFlags.sound_trigger;
  const effectiveRigType = shoot.rig_type_override || matchedRig?.rig_type;
  const rigLabel = effectiveRigType ? (matchedRig?.sound ? `${effectiveRigType}/Sound` : effectiveRigType) : null;

  const operators = (shoot.assigned_operators || []).map(e => {
    const u = allUsers.find(u => u.email === e);
    return getDisplayName(u, e);
  });

  const handlePhaseToggle = async (key) => {
    if (!onUpdate || !key) return;
    const current = localPhase || shoot.phase_status || {};
    const newPhase = { ...current, [key]: current[key] ? null : new Date().toISOString() };
    setLocalPhase(newPhase);
    await onUpdate(shoot.id, { phase_status: newPhase });
  };

  const toDate = (timeStr) => {
    if (!timeStr || !shoot.date) return null;
    const [h, m] = timeStr.split(':').map(Number);
    const d = new Date(shoot.date + 'T00:00:00');
    d.setHours(h, m, 0, 0);
    return d;
  };

  const phases = schedule ? [
    showSetup ? { label: 'Setup', key: 'setup_complete', Icon: Zap, time: schedule.setup } : null,
    showPreShoot ? { label: 'Pre-Shoot', key: 'pre_shoot_started', Icon: Camera, time: schedule.pre_shoot } : null,
    showAttention ? { label: 'Attention', key: 'attention_started', Icon: AlertTriangle, time: schedule.attention } : null,
    showSound ? { label: 'Sound Recording', key: 'sound_started', Icon: Volume2, time: schedule.sound } : null,
    showSoundTrigger ? { label: 'Sound Trigger', key: 'sound_trigger_started', Icon: Volume2, time: schedule.sound_trigger } : null,
    { label: 'Game Time', key: 'game_started', Icon: Flag, time: schedule.game },
  ].filter(Boolean) : [];

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
                phase_status: { ...effectivePhase, shoot_complete: new Date().toISOString() }
              });
            }
          }}
        />
      )}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden hover:border-slate-800 transition-colors">
        {/* Banner header — always visible */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-left px-4 py-3 flex items-center gap-3"
          style={{ touchAction: 'manipulation' }}
        >
          {/* Countdown pill */}
          <div className={`flex-shrink-0 font-mono text-sm font-bold px-2.5 py-1 rounded-lg ${
            diff !== null && diff <= 0 ? 'bg-red-950/50 text-red-400 border border-red-800' : 'bg-blue-950/40 text-blue-400 border border-blue-800'
          }`}>
            {diff === null ? '—' : formatCountdown(diff)}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-100 text-sm truncate">{shoot.title}</span>
              {rigLabel && <span className="text-xs text-blue-400 bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-800/40">{rigLabel}</span>}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 flex-wrap">
              <span>{format(new Date(shoot.date + 'T12:00:00'), 'EEE, MMM d')}</span>
              {shoot.game_time && <span className="font-mono">{shoot.game_time}</span>}
              {venue && <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{venue}</span>}
              {operators.length > 0 && <span>Op: {operators.join(', ')}</span>}
            </div>
          </div>

          {/* Status + expand */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {livePhase ? (
              <span className={`text-xs font-semibold ${livePhase.color} hidden sm:inline`}>{livePhase.label}</span>
            ) : (
              <Badge className={`text-xs border ${statusColors[normalizeShootStatus(shoot.status)] || statusColors.upcoming} hidden sm:inline-flex`}>
                {formatStatusLabel(shoot.status)}
              </Badge>
            )}
            {expanded ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </div>
        </button>

        {/* Expandable content */}
        {expanded && (
          <div className="px-4 pb-4 border-t border-slate-800 pt-3 space-y-3">
            {/* Countdown */}
            <div className={`text-center py-2 px-2 rounded-xl ${diff !== null && diff <= 0 ? 'bg-red-950/40 border border-red-800' : 'bg-blue-950/40 border border-blue-800'}`}>
              <div className={`font-mono font-bold text-xl tracking-wider ${diff !== null && diff <= 0 ? 'text-red-400' : 'text-blue-400'}`}>
                {diff === null ? '—' : formatCountdown(diff)}
              </div>
              <div className="text-xs text-slate-500">until game time</div>
              {livePhase && livePhase.label !== 'Complete' && (
                <div className="mt-1 text-xs">
                  <span className="text-slate-500">now: </span>
                  <span className={`font-semibold ${livePhase.color}`}>{livePhase.label}</span>
                </div>
              )}
            </div>

            {/* Schedule phases */}
            {phases.length > 0 && (
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wider mb-1.5">Schedule</p>
                <div className="space-y-1">
                  {phases.map(p => (
                    <PhaseRow
                      key={p.label}
                      label={p.label}
                      Icon={p.Icon}
                      done={!!effectivePhase[p.key]}
                      canClick={!!p.key}
                      onClick={() => handlePhaseToggle(p.key)}
                      time={p.time}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Rig config */}
            {matchedRig && (
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wider mb-1.5">Rig Config</p>
                <div className="space-y-1 mb-2">
                  {[
                    { label: 'Data HD', enabled: matchedRig.data_enabled !== false, cam: matchedRig.data_hd },
                    { label: 'Data Wide', enabled: matchedRig.data_enabled !== false && matchedRig.data_wide_enabled !== false, cam: matchedRig.data_wide },
                    { label: 'Outdoor Day HD', enabled: !!matchedRig.fancam_day_enabled, cam: matchedRig.fancam_day_hd },
                    { label: 'Outdoor Night HD', enabled: !!matchedRig.fancam_night_enabled, cam: matchedRig.fancam_night_hd },
                    { label: 'Indoor HD', enabled: !!matchedRig.indoor_enabled, cam: matchedRig.indoor_hd },
                    { label: 'Attention', enabled: !!matchedRig.attention_enabled, cam: matchedRig.attention_hd },
                  ].map(({ label, enabled, cam }) => enabled && cam ? (
                    <div key={label} className="flex items-center justify-between bg-slate-800/40 rounded px-2 py-1">
                      <span className="text-xs text-slate-400">{label}</span>
                      <span className="text-xs text-slate-400 font-mono">
                        {cam?.shutter || '—'} · {cam?.aperture || '—'} · ISO {cam?.iso || '—'}
                      </span>
                    </div>
                  ) : null)}
                  {showSound && (
                    <div className="flex items-center gap-1.5 bg-emerald-950/40 rounded px-2 py-1">
                      <Volume2 className="h-3 w-3 text-emerald-400" />
                      <span className="text-xs text-emerald-400">Sound Recording</span>
                    </div>
                  )}
                  {showSoundTrigger && (
                    <div className="flex items-center gap-1.5 bg-emerald-950/40 rounded px-2 py-1">
                      <Volume2 className="h-3 w-3 text-emerald-400" />
                      <span className="text-xs text-emerald-400">Sound Trigger · {schedule?.sound_trigger || '+10 min'}</span>
                    </div>
                  )}
                </div>
                {matchedRig.notes && (
                  <div className="bg-blue-950/40 border border-blue-800 rounded-lg p-2.5">
                    <p className="text-xs text-blue-400 uppercase tracking-wider mb-1 font-semibold">📝 Rig Notes</p>
                    <p className="text-xs text-blue-200/90 italic leading-relaxed">{matchedRig.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Notes */}
            {(shoot.description || shoot.notes) && (
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Notes</p>
                <p className="text-xs text-slate-400">{shoot.description || shoot.notes}</p>
              </div>
            )}

            {/* Complete button */}
            {normalizeShootStatus(shoot.status) !== 'completed'
              && normalizeShootStatus(shoot.status) !== 'cancelled'
              && normalizeShootStatus(shoot.status) !== 'postponed' && (
              <button
                onClick={() => setShowCompleteModal(true)}
                className="w-full py-2 rounded-lg border border-green-700 bg-emerald-950/40 text-emerald-400 text-xs font-semibold hover:bg-emerald-950/40 transition-colors"
              >
                ✓ Mark Shoot Complete
              </button>
            )}
            {normalizeShootStatus(shoot.status) === 'completed' && (
              <div className="w-full py-2 rounded-lg border border-green-800 bg-emerald-950/40 text-green-500 text-xs font-semibold text-center">
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