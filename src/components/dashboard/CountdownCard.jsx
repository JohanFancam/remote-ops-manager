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

const statusColors = {
  upcoming: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  confirmed: 'bg-green-500/20 text-green-400 border-green-500/30',
  in_progress: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  completed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const RIG_TYPES = ['Data', 'Fancam', 'Data/Fancam'];

function PhaseRow({ label, time, Icon, done, active, countdown, onClick, canClick }) {
  return (
    <div
      onClick={canClick ? onClick : undefined}
      className={`flex items-center justify-between py-1.5 px-2 rounded-lg transition-colors ${
        done ? 'bg-green-950/40 border border-green-800/50' :
        active ? 'bg-blue-950/40 border border-blue-800/50' :
        'bg-transparent border border-transparent'
      } ${canClick ? 'cursor-pointer hover:border-gray-600 hover:bg-gray-800/50' : ''}`}
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
    </div>
  );
}

export default function CountdownCard({ shoot, standbyAdmins = [], isAdmin = false, rigSettings = [], onUpdate, userEmail, allUsers = [] }) {
  const [now, setNow] = useState(new Date());
  const [expanded, setExpanded] = useState(false);
  const [updatingRig, setUpdatingRig] = useState(false);

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);

  const gameDate = getGameDateTime(shoot);
  const diff = gameDate ? gameDate - now : null;
  const isPast = diff !== null && diff <= 0;

  const formatCountdown = (ms) => {
    if (ms <= 0) return 'NOW';
    const days = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return `${days > 0 ? `${days}d ` : ''}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const countdown = diff === null ? '—' : isPast ? 'LIVE / PAST' : formatCountdown(diff);

  const schedule = getSchedule(shoot);

  const matchedRig = rigSettings.find(r =>
    r.team && shoot.client &&
    r.team.toLowerCase().trim() === shoot.client.toLowerCase().trim()
  );
  const showAttention = matchedRig?.attention_camera === true;
  const showSound = matchedRig?.sound === true;

  // Effective rig type: shoot override first, then rig setting
  const effectiveRigType = shoot.rig_type_override || matchedRig?.rig_type;
  const rigLabel = effectiveRigType ? (matchedRig?.sound ? `${effectiveRigType}/Sound` : effectiveRigType) : null;

  const isAssigned = shoot.assigned_operators?.includes(userEmail);
  const canMarkPhases = isAdmin || isAssigned;

  const handlePhaseToggle = async (doneKey) => {
    if (!onUpdate || !doneKey) return;
    const current = shoot.phase_status || {};
    const newPhaseStatus = {
      ...current,
      [doneKey]: current[doneKey] ? null : new Date().toISOString(),
    };
    await onUpdate(shoot.id, { phase_status: newPhaseStatus });
  };

  const handleRigTypeChange = async (type) => {
    if (!onUpdate) return;
    setUpdatingRig(true);
    await onUpdate(shoot.id, { rig_type_override: shoot.rig_type_override === type ? null : type });
    setUpdatingRig(false);
  };

  const isStandby = !shoot.assigned_operators?.includes('__self__'); // will be determined by parent

  return (
    <Card className="bg-gray-900 border-gray-800 hover:border-gray-600 transition-colors">
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white truncate">{shoot.title}</p>
            {shoot.client && <p className="text-sm text-gray-400 truncate">{shoot.client}</p>}
          </div>
          <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
            <Badge className={`text-xs border ${statusColors[shoot.status] || statusColors.upcoming}`}>
              {shoot.status}
            </Badge>
          </div>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-4">
          {shoot.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{shoot.location}</span>}
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(shoot.date), 'EEE, MMM d yyyy')}
          </span>
          {rigLabel && (
            <span className="flex items-center gap-1 text-blue-400">
              <Tv2 className="h-3 w-3" />{rigLabel}
              {shoot.rig_type_override && <span className="text-orange-400 text-xs">(override)</span>}
            </span>
          )}
        </div>

        {/* Countdown */}
        <div className={`text-center py-3 px-2 rounded-xl mb-4 ${isPast ? 'bg-red-950/40 border border-red-800' : 'bg-blue-950/40 border border-blue-800'}`}>
          <div className={`font-mono font-bold text-2xl tracking-wider ${isPast ? 'text-red-400' : 'text-blue-300'}`}>
            {countdown}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">until game time</div>
        </div>

        {/* Admin rig type quick toggle */}
        {isAdmin && onUpdate && (
          <div className="mb-3">
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

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-between text-xs text-gray-500 hover:text-gray-300 transition-colors py-1"
        >
          <span>{expanded ? 'Hide details' : 'Show details'}</span>
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>

        {/* Expanded details */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-gray-800 space-y-3">
            {/* Schedule phases */}
            {schedule && (
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wider mb-2">Schedule</p>
                {(() => {
                  const phase = shoot.phase_status || {};
                  // Parse a schedule time string "HH:MM" into a Date on shoot day
                  const toDate = (timeStr) => {
                    if (!timeStr || !shoot.date) return null;
                    const [h, m] = timeStr.split(':').map(Number);
                    const d = new Date(shoot.date + 'T00:00:00');
                    d.setHours(h, m, 0, 0);
                    return d;
                  };
                  const phases = [
                    { label: 'Setup', time: schedule.setup, Icon: Zap, doneKey: 'setup_complete', date: toDate(schedule.setup) },
                    { label: 'Pre-Shoot', time: schedule.pre_shoot, Icon: Camera, doneKey: 'pre_shoot_started', date: toDate(schedule.pre_shoot) },
                    showAttention && { label: 'Attention', time: schedule.attention, Icon: AlertTriangle, doneKey: 'attention_started', date: toDate(schedule.attention) },
                    showSound && { label: 'Sound Check', time: schedule.sound, Icon: Volume2, doneKey: 'sound_started', date: toDate(schedule.sound) },
                    { label: 'Game Time', time: schedule.game, Icon: Flag, doneKey: null, date: gameDate },
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

            {/* Rig settings summary */}
            {matchedRig && (
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wider mb-1.5">Rig Config</p>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  {matchedRig.sport && <span className="text-gray-400">Sport: <span className="text-gray-200">{matchedRig.sport}</span></span>}
                  {matchedRig.venue_type && <span className="text-gray-400">Venue: <span className="text-gray-200">{matchedRig.venue_type}</span></span>}
                  {matchedRig.shoot_plan && (
                    <span className="col-span-2 text-gray-400">Plan: <span className="text-gray-200">{matchedRig.shoot_plan}</span></span>
                  )}
                  {matchedRig.remote_rigs?.length > 0 && (
                    <span className="col-span-2 text-gray-400">Remotes: <span className="text-gray-200">{matchedRig.remote_rigs.join(', ')}</span></span>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {(shoot.description || shoot.notes) && (
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wider mb-1">Notes</p>
                <p className="text-xs text-gray-300">{shoot.description || shoot.notes}</p>
              </div>
            )}

            {/* Assigned operators */}
            {shoot.assigned_operators?.length > 0 && (
              <div>
                <p className="text-xs text-gray-600 uppercase tracking-wider mb-1.5">Operators</p>
                <div className="flex flex-wrap gap-1">
                  {shoot.assigned_operators.map(e => {
                    const u = allUsers.find(u => u.email === e);
                    return (
                      <span key={e} className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">
                        {u?.full_name || e.split('@')[0]}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Standby contact */}
            {shoot.standby_admin && (
              <div className="flex items-center gap-1.5 text-xs text-yellow-400">
                <Phone className="h-3 w-3" />
                Standby: {allUsers.find(u => u.email === shoot.standby_admin)?.full_name || shoot.standby_admin.split('@')[0]}
              </div>
            )}

            {/* Shoot Complete button */}
            {canMarkPhases && shoot.status !== 'completed' && shoot.status !== 'cancelled' && (
              <button
                onClick={() => onUpdate && onUpdate(shoot.id, { status: 'completed', phase_status: { ...shoot.phase_status, shoot_complete: new Date().toISOString() } })}
                className="w-full mt-1 py-2 rounded-lg border border-green-700 bg-green-950/30 text-green-400 text-xs font-semibold hover:bg-green-950/60 transition-colors"
              >
                ✓ Mark Shoot Complete
              </button>
            )}

            {/* External link to calendar */}
            <a
              href={`/Calendar?shootId=${shoot.id}`}
              className="block text-center text-xs text-blue-500 hover:text-blue-400 pt-1"
            >
              Open full detail in Calendar →
            </a>
          </div>
        )}
      </CardContent>
    </Card>
  );
}