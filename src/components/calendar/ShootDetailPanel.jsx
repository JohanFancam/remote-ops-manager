import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import {
  Copy, Check, ChevronDown, ChevronUp,
  Zap, Camera, AlertTriangle, Volume2, Clock, Flag, Phone,
  MapPin, Tv2, Timer, Aperture, Sun
} from 'lucide-react';

import { getSchedule, timeToMinutes, minutesToTime } from '../utils/scheduleUtils';
import { getDisplayName } from '../utils/nameUtils';
import ShootPhaseButtons from '../shoots/ShootPhaseButtons';
import { AUTO_APPROVE_LIMIT, getPreApprovedCount, addEmail, removeEmail, hasEmail, findPairedShoot, findPairedShootForUnassign, isClaimedByOtherOperator } from '../../utils/assignmentApproval';

function ReadySlackMessage({ shoot, schedule, showAttention, showSound, rigType }) {
  const [copied, setCopied] = useState(false);
  const team = shoot.client || shoot.title;
  const lines = [
    `Ready for today's ${team} shoot`,
    '',
    schedule ? [
      `Setup: ${schedule.setup}`,
      `Pre-Shoot: ${schedule.pre_shoot}`,
      showAttention ? `Attention: ${schedule.attention}` : null,
      showSound ? `Sound Check: ${schedule.sound}` : null,
      `Game Time: ${schedule.game}`,
    ].filter(Boolean).join('\n') : '',
    shoot.location ? `Venue: ${shoot.location}` : '',
    rigType ? `Rig: ${rigType}` : '',
  ].filter(Boolean).join('\n');

  return (
    <div className="bg-slate-800/60 rounded-lg border border-slate-800 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wider flex items-center gap-1.5"><Copy className="h-3 w-3" /> Ready Message — Copy to Slack</p>
        <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(lines); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="h-6 text-xs text-slate-400 hover:text-slate-100 hover:bg-slate-700">
          {copied ? <><Check className="h-3 w-3 mr-1 text-emerald-400" />Copied!</> : <><Copy className="h-3 w-3 mr-1" />Copy</>}
        </Button>
      </div>
      <pre className="text-xs text-slate-400 whitespace-pre-wrap font-mono leading-relaxed">{lines}</pre>
    </div>
  );
}

const SHUTTER_OPTIONS = ['1/100', '1/125', '1/160', '1/200', '1/250', '1/320', '1/400'];
const APERTURE_OPTIONS = ['F5.6', 'F6.3', 'F7.1', 'F8', 'F9', 'F10', 'F11'];
const ISO_OPTIONS = ['Auto', '800', '1600', '3200', '6400'];

function ScheduleRow({ Icon, label, time, highlight }) {
  return (
    <div className={`flex justify-between items-center py-1.5 text-sm ${highlight ? 'text-blue-400 font-bold' : 'text-slate-400'}`}>
      <span className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${highlight ? 'text-blue-400' : 'text-slate-500'}`} />
        {label}
      </span>
      <span className="font-mono">{time}</span>
    </div>
  );
}



async function createShootTimeEntry(shoot, email, name, entryType, notes) {
  const { setup_offset = -150 } = shoot;
  const gameTime = shoot.game_time || '19:00';
  const [h, m] = gameTime.split(':').map(Number);
  const gameMinutes = h * 60 + m;
  const setupMinutes = gameMinutes + setup_offset - 60; // 1hr before setup
  const endMinutes = gameMinutes + 300 + 60; // game + ~5h + 1hr after
  const totalHours = (endMinutes - setupMinutes) / 60;
  await base44.entities.TimeEntry.create({
    operator_email: email,
    operator_name: name,
    shoot_id: shoot.id,
    date: shoot.date,
    hours: Math.max(1, parseFloat(totalHours.toFixed(2))),
    rate: 0,
    total: 0,
    notes: notes || shoot.title,
    entry_type: 'manual',
    status: 'approved',
  });
}


export default function ShootDetailPanel({ shoot, user, isAdmin, rigSettings, allShoots = [], allUsers = [], standbyAdmins = [], slackMessages = {}, appSettings = [], onUpdate }) {
  const [showRigSettings, setShowRigSettings] = useState(false);
  const schedule = getSchedule(shoot);
  const todayStr = new Date().toISOString().split('T')[0];
  const isPast = shoot.date < todayStr;

  const isApproved = shoot.assigned_operators?.includes(user?.email);
  const isPending = shoot.pending_operators?.includes(user?.email);

  // Auto-assign config from appSettings
  const autoAssignTeams = React.useMemo(() => {
    const raw = appSettings.find(s => s.key === 'auto_assign_teams')?.value;
    return raw ? JSON.parse(raw) : ['Reds', 'Red Sox', 'Rangers'];
  }, [appSettings]);
  const autoAssignUsers = React.useMemo(() => {
    const raw = appSettings.find(s => s.key === 'auto_assign_users')?.value;
    return raw ? JSON.parse(raw) : [];
  }, [appSettings]);
  const autoAssignWindowMinutes = React.useMemo(() => {
    const raw = appSettings.find(s => s.key === 'auto_assign_window_hours')?.value;
    return (raw ? Number(raw) : 2) * 60;
  }, [appSettings]);

  // Is this shoot one of the linked teams?
  const isLinkedTeam = (s) => autoAssignTeams.some(t =>
    (s.client || s.title || '').toLowerCase().includes(t.toLowerCase())
  );

  // Does this user qualify for auto-assign?
  const userEligibleForAutoAssign = !isAdmin && user && (
    autoAssignUsers.length === 0 || autoAssignUsers.includes(user.email)
  );

  // Count pre-approved slots using the shared helper
  const getApprovedCount = (email) => getPreApprovedCount(allShoots, email, shoot.id, todayStr);

  const matchedRig = rigSettings?.find(r =>
    r.team && shoot.client &&
    r.team.toLowerCase().trim() === shoot.client.toLowerCase().trim()
  );

  // Which optional phases are enabled for this shoot
  const showAttention = matchedRig?.attention_enabled === true;
  const showSound = matchedRig?.sound_enabled === true;
  const effectiveRigType = shoot.rig_type_override || matchedRig?.rig_type;
  const rigTypeLabel = effectiveRigType ? (matchedRig?.sound_enabled ? `${effectiveRigType}/Sound` : effectiveRigType) : null;

  // End time = game time + 5 hours
  const endTime = schedule ? minutesToTime(timeToMinutes(schedule.game) + 300) : null;

  // One remote claim per shoot: assigned OR pending by someone else blocks self-assign
  const claimedByOther = isClaimedByOtherOperator(shoot, user?.email, allUsers);
  const shootFull = !isAdmin && claimedByOther && !isApproved && !isPending;

  const preCount = !isAdmin && user ? getApprovedCount(user.email) : 0;
  const withinLimit = preCount < AUTO_APPROVE_LIMIT;
  const remainingAutoApprove = Math.max(0, AUTO_APPROVE_LIMIT - preCount);

  const handleSelfAssign = async () => {
    const email = user?.email;
    if (!email) return;

    if (isPending) {
      await onUpdate(shoot.id, {
        pending_operators: removeEmail(shoot.pending_operators, email),
        pre_approved_operators: removeEmail(shoot.pre_approved_operators, email),
      });
    } else if (isApproved) {
      await onUpdate(shoot.id, {
        assigned_operators: removeEmail(shoot.assigned_operators, email),
        pending_operators: removeEmail(shoot.pending_operators, email),
        pre_approved_operators: removeEmail(shoot.pre_approved_operators, email),
        auto_assigned_for: removeEmail(shoot.auto_assigned_for, email),
      });
      // Bidirectional cascade unassign to paired shoot
      const paired = findPairedShootForUnassign(shoot, allShoots, autoAssignTeams, autoAssignWindowMinutes, email);
      if (paired) {
        await onUpdate(paired.id, {
          assigned_operators: removeEmail(paired.assigned_operators, email),
          pending_operators: removeEmail(paired.pending_operators, email),
          pre_approved_operators: removeEmail(paired.pre_approved_operators, email),
          auto_assigned_for: removeEmail(paired.auto_assigned_for, email),
        });
      }
    } else if (isAdmin) {
      // Admin: update only the selected shoot — no auto-pairing
      await onUpdate(shoot.id, {
        assigned_operators: addEmail(shoot.assigned_operators, email),
        pending_operators: removeEmail(shoot.pending_operators, email),
      });
      await createShootTimeEntry(shoot, email, user.full_name, 'manual', `Shoot: ${shoot.title}`);
    } else if (claimedByOther) {
      return;
    } else {
      if (withinLimit && !hasEmail(shoot.assigned_operators, email)) {
        // Approved
        await onUpdate(shoot.id, {
          assigned_operators: addEmail(shoot.assigned_operators, email),
          pending_operators: removeEmail(shoot.pending_operators, email),
          pre_approved_operators: addEmail(shoot.pre_approved_operators, email),
        });
      } else if (!withinLimit && !hasEmail(shoot.pending_operators, email)) {
        // Over limit → pending (no auto-pair when over limit)
        await onUpdate(shoot.id, {
          pending_operators: addEmail(shoot.pending_operators, email),
          assigned_operators: removeEmail(shoot.assigned_operators, email),
          pre_approved_operators: removeEmail(shoot.pre_approved_operators, email),
        });
        return; // do not auto-pair when over limit
      }

      // Auto-pair only if within limit: findPairedShoot already ensures partner is fully available
      if (userEligibleForAutoAssign && withinLimit) {
        const partner = findPairedShoot(shoot, allShoots, autoAssignTeams, autoAssignWindowMinutes, email);
        if (partner) {
          const countAfterMain = preCount + 1;
          if (countAfterMain < AUTO_APPROVE_LIMIT) {
            await onUpdate(partner.id, {
              assigned_operators: addEmail(partner.assigned_operators, email),
              pending_operators: removeEmail(partner.pending_operators, email),
              pre_approved_operators: addEmail(partner.pre_approved_operators, email),
              auto_assigned_for: addEmail(partner.auto_assigned_for, email),
            });
          }
          // If partner would push over limit, skip it — do not assign pending to an already-available shoot
        }
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Schedule */}
      {schedule && (
        <div className="bg-slate-800/60 rounded-lg p-3">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Schedule</p>
          <ScheduleRow Icon={Zap} label="Setup" time={schedule.setup} />
          <ScheduleRow Icon={Camera} label="Pre-Shoot" time={schedule.pre_shoot} />
          {showAttention && <ScheduleRow Icon={AlertTriangle} label="Attention" time={schedule.attention} />}
          {showSound && <ScheduleRow Icon={Volume2} label="Sound Check" time={schedule.sound} />}
          <ScheduleRow Icon={Clock} label="Game Time" time={schedule.game} highlight />
          {endTime && <ScheduleRow Icon={Flag} label="Est. End (~5h)" time={endTime} />}
        </div>
      )}

      {/* Rig type badge */}
      {matchedRig && (
      <div className="flex items-center gap-2 flex-wrap">
        {matchedRig.rig_type && (
          <span className="flex items-center gap-1.5 text-xs bg-blue-950/40 border border-blue-800 text-blue-400 px-2.5 py-1 rounded-full">
            <Tv2 className="h-3 w-3" /> {matchedRig.rig_type}
          </span>
        )}
        {matchedRig.data_enabled !== false && <span className="text-xs bg-blue-600/20 border border-blue-800 text-blue-400 px-2.5 py-1 rounded-full">Data</span>}
        {matchedRig.fancam_day_enabled && <span className="text-xs bg-orange-500/20 border border-orange-500/30 text-orange-300 px-2.5 py-1 rounded-full">Fancam Day</span>}
        {matchedRig.fancam_night_enabled && <span className="text-xs bg-purple-500/20 border border-purple-500/30 text-purple-300 px-2.5 py-1 rounded-full">Fancam Night</span>}
        {matchedRig.attention_enabled && <span className="text-xs bg-yellow-500/20 border border-yellow-500/30 text-amber-400 px-2.5 py-1 rounded-full">Attention</span>}
        {matchedRig.sound_enabled && (
          <span className="flex items-center gap-1.5 text-xs bg-emerald-950/40 border border-green-800/50 text-green-300 px-2.5 py-1 rounded-full">
            <Volume2 className="h-3 w-3" /> Sound
          </span>
        )}
        {shoot.location && (
          <span className="flex items-center gap-1.5 text-xs bg-slate-800/60 border border-slate-800 text-slate-400 px-2.5 py-1 rounded-full">
            <MapPin className="h-3 w-3" /> {shoot.location}
          </span>
        )}
      </div>
      )}

      {/* Rig Type Quick Override — admin only */}
      {isAdmin && (
        <div className="bg-slate-800/40 rounded-lg p-3">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Rig Type Override</p>
          <div className="flex gap-1.5">
            {['Data', 'Fancam'].map(type => (
              <button
                key={type}
                onClick={() => onUpdate(shoot.id, { rig_type_override: shoot.rig_type_override === type ? null : type })}
                className={`flex-1 text-xs py-1.5 px-2 rounded border transition-colors ${
                  shoot.rig_type_override === type
                    ? 'bg-orange-600 border-orange-500 text-white font-medium'
                    : 'bg-slate-800 border-slate-800 text-slate-400 hover:border-gray-500 hover:text-slate-100'
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          {shoot.rig_type_override && (
            <p className="text-xs text-orange-400 mt-1.5">Override active — overrides rig setting default</p>
          )}
        </div>
      )}

      {/* Notes */}
      {(shoot.description || shoot.notes) && (
        <div className="bg-slate-800/40 rounded-lg p-3">
          <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Notes</p>
          <p className="text-sm text-slate-400">{shoot.description || shoot.notes}</p>
        </div>
      )}

      {/* Rig Settings */}
      {matchedRig && (
        <div className="bg-slate-800/40 rounded-lg border border-slate-800">
          <button onClick={() => setShowRigSettings(!showRigSettings)} className="w-full flex items-center justify-between p-3 text-left">
            <span className="text-sm font-medium text-slate-100">⚙️ Rig Settings — {matchedRig.team}</span>
            {showRigSettings ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
          </button>
          {showRigSettings && (
            <div className="px-3 pb-3 space-y-4">
              {/* Meta */}
              <div className="space-y-1 text-sm">
                {matchedRig.remote_rigs?.length > 0 && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Remote Rigs</p>
                    <div className="flex flex-wrap gap-1">
                      {matchedRig.remote_rigs.map((r, i) => (
                        <span key={i} className="text-xs bg-blue-950/40 text-blue-400 border border-blue-800 px-2 py-0.5 rounded-full">{r}</span>
                      ))}
                    </div>
                  </div>
                )}
                {matchedRig.shoot_plan && (
                  <div>
                    <p className="text-xs text-slate-500">Shoot Plan</p>
                    <p className="text-sm text-gray-200">{matchedRig.shoot_plan}</p>
                  </div>
                )}
              </div>

              {/* Camera Settings — 5 sections */}
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Camera className="h-3.5 w-3.5" /> Camera Settings</p>
                <div className="space-y-2">
                  {matchedRig.data_enabled !== false && (
                    <div className="bg-blue-950/40 border border-blue-800 rounded-lg px-3 py-2">
                      <p className="text-xs font-semibold text-blue-400 mb-2">Data Settings</p>
                      {matchedRig.data_hd && (
                        <div className="flex items-center justify-between py-1">
                          <span className="text-xs text-slate-400 font-medium">HD Camera</span>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="flex items-center gap-1"><Timer className="h-3 w-3 text-slate-500" />{matchedRig.data_hd.shutter || '—'}</span>
                            <span className="flex items-center gap-1"><Aperture className="h-3 w-3 text-slate-500" />{matchedRig.data_hd.aperture || '—'}</span>
                            <span className="flex items-center gap-1"><Sun className="h-3 w-3 text-slate-500" />{matchedRig.data_hd.iso || '—'}</span>
                          </div>
                        </div>
                      )}
                      {matchedRig.data_wide && (
                        <div className="flex items-center justify-between py-1 border-t border-slate-800/40">
                          <span className="text-xs text-slate-400 font-medium">Wide Camera</span>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="flex items-center gap-1"><Timer className="h-3 w-3 text-slate-500" />{matchedRig.data_wide.shutter || '—'}</span>
                            <span className="flex items-center gap-1"><Aperture className="h-3 w-3 text-slate-500" />{matchedRig.data_wide.aperture || '—'}</span>
                            <span className="flex items-center gap-1"><Sun className="h-3 w-3 text-slate-500" />{matchedRig.data_wide.iso || '—'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {matchedRig.fancam_day_enabled && (
                    <div className="bg-orange-950/20 border border-orange-900/30 rounded-lg px-3 py-2">
                      <p className="text-xs font-semibold text-orange-400 mb-2">Fancam Day Settings</p>
                      {matchedRig.fancam_day_hd && (
                        <div className="flex items-center justify-between py-1">
                          <span className="text-xs text-slate-400 font-medium">HD Camera</span>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="flex items-center gap-1"><Timer className="h-3 w-3 text-slate-500" />{matchedRig.fancam_day_hd.shutter || '—'}</span>
                            <span className="flex items-center gap-1"><Aperture className="h-3 w-3 text-slate-500" />{matchedRig.fancam_day_hd.aperture || '—'}</span>
                            <span className="flex items-center gap-1"><Sun className="h-3 w-3 text-slate-500" />{matchedRig.fancam_day_hd.iso || '—'}</span>
                          </div>
                        </div>
                      )}
                      {matchedRig.fancam_day_wide && (
                        <div className="flex items-center justify-between py-1 border-t border-slate-800/40">
                          <span className="text-xs text-slate-400 font-medium">Wide Camera</span>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="flex items-center gap-1"><Timer className="h-3 w-3 text-slate-500" />{matchedRig.fancam_day_wide.shutter || '—'}</span>
                            <span className="flex items-center gap-1"><Aperture className="h-3 w-3 text-slate-500" />{matchedRig.fancam_day_wide.aperture || '—'}</span>
                            <span className="flex items-center gap-1"><Sun className="h-3 w-3 text-slate-500" />{matchedRig.fancam_day_wide.iso || '—'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {matchedRig.fancam_night_enabled && (
                    <div className="bg-purple-950/20 border border-purple-900/30 rounded-lg px-3 py-2">
                      <p className="text-xs font-semibold text-purple-400 mb-2">Fancam Night Settings</p>
                      {matchedRig.fancam_night_hd && (
                        <div className="flex items-center justify-between py-1">
                          <span className="text-xs text-slate-400 font-medium">HD Camera</span>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="flex items-center gap-1"><Timer className="h-3 w-3 text-slate-500" />{matchedRig.fancam_night_hd.shutter || '—'}</span>
                            <span className="flex items-center gap-1"><Aperture className="h-3 w-3 text-slate-500" />{matchedRig.fancam_night_hd.aperture || '—'}</span>
                            <span className="flex items-center gap-1"><Sun className="h-3 w-3 text-slate-500" />{matchedRig.fancam_night_hd.iso || '—'}</span>
                          </div>
                        </div>
                      )}
                      {matchedRig.fancam_night_wide && (
                        <div className="flex items-center justify-between py-1 border-t border-slate-800/40">
                          <span className="text-xs text-slate-400 font-medium">Wide Camera</span>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="flex items-center gap-1"><Timer className="h-3 w-3 text-slate-500" />{matchedRig.fancam_night_wide.shutter || '—'}</span>
                            <span className="flex items-center gap-1"><Aperture className="h-3 w-3 text-slate-500" />{matchedRig.fancam_night_wide.aperture || '—'}</span>
                            <span className="flex items-center gap-1"><Sun className="h-3 w-3 text-slate-500" />{matchedRig.fancam_night_wide.iso || '—'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {matchedRig.attention_enabled && (
                    <div className="bg-yellow-950/20 border border-yellow-900/30 rounded-lg px-3 py-2">
                      <p className="text-xs font-semibold text-amber-400 mb-2">Attention Camera</p>
                      {matchedRig.attention_hd && (
                        <div className="flex items-center justify-between py-1">
                          <span className="text-xs text-slate-400 font-medium">HD Camera</span>
                          <div className="flex items-center gap-2 text-xs text-slate-400">
                            <span className="flex items-center gap-1"><Timer className="h-3 w-3 text-slate-500" />{matchedRig.attention_hd.shutter || '—'}</span>
                            <span className="flex items-center gap-1"><Aperture className="h-3 w-3 text-slate-500" />{matchedRig.attention_hd.aperture || '—'}</span>
                            <span className="flex items-center gap-1"><Sun className="h-3 w-3 text-slate-500" />{matchedRig.attention_hd.iso || '—'}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Sound */}
              <div className={`rounded-lg border px-3 py-2 flex items-center justify-between ${matchedRig.sound_enabled ? 'border-green-700 bg-emerald-950/40' : 'border-slate-800 bg-slate-800/30'}`}>
                <div className="flex items-center gap-2">
                  <Volume2 className={`h-3.5 w-3.5 ${matchedRig.sound_enabled ? 'text-emerald-400' : 'text-gray-600'}`} />
                  <span className="text-sm text-slate-400">Sound Recording</span>
                </div>
                <span className={`text-xs font-semibold ${matchedRig.sound_enabled ? 'text-emerald-400' : 'text-gray-600'}`}>{matchedRig.sound_enabled ? 'YES' : 'NO'}</span>
              </div>

              {/* Rig Notes */}
              {matchedRig.notes && (
                <div className="bg-blue-950/40 border border-blue-800 rounded-lg p-3">
                  <p className="text-xs text-blue-400 uppercase tracking-wider mb-1 font-semibold">📝 Rig Notes</p>
                  <p className="text-sm text-blue-200/90 leading-relaxed italic">{matchedRig.notes}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}



      {/* Self assign/unassign — admin can do on past shoots too */}
      {(!isPast || isAdmin) && (
        <div>
          <Button
            size="sm"
            onClick={handleSelfAssign}
            disabled={shootFull}
            className={
              isApproved ? 'border border-red-700 text-red-400 bg-transparent hover:bg-red-900/30 w-full'
              : isPending ? 'border border-yellow-700 text-amber-400 bg-transparent hover:bg-yellow-900/20 w-full'
              : shootFull ? 'border border-slate-700 text-slate-500 bg-slate-800/50 w-full cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-500 text-white w-full'
            }
          >
            {isApproved ? 'Unassign Myself' : isPending ? 'Pending — Cancel' : shootFull ? 'Unavailable' : '+ Assign Myself'}
          </Button>
          {!isAdmin && !isApproved && !isPending && (
            <p className="text-xs text-center mt-1 text-slate-500">
              {shootFull
                ? ((shoot.pending_operators || []).length > 0
                  ? 'Pending approval — wait until it becomes available'
                  : 'Taken by another operator')
                : remainingAutoApprove > 0 ? `${remainingAutoApprove} auto-approvals remaining` : 'Requires admin approval'}
            </p>
          )}
        </div>
      )}

      {/* Ready Slack message — shown as soon as assigned */}
      {isApproved && schedule && (
        <ReadySlackMessage shoot={shoot} schedule={schedule} showAttention={showAttention} showSound={showSound} rigType={rigTypeLabel} />
      )}

      {/* Standby info for this shoot date — show who is on standby */}
      {shoot.standby_admin && (
        <div className="bg-amber-950/40 border border-yellow-800/50 rounded-lg p-3">
          <p className="text-xs text-amber-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Phone className="h-3 w-3" /> Standby Admin
          </p>
          <p className="text-sm text-yellow-200">
            {getDisplayName(allUsers.find(u => u.email === shoot.standby_admin), shoot.standby_admin)}
          </p>
        </div>
      )}



      {/* Phase buttons — only when assigned */}
      {isApproved && !isPast && (
        <ShootPhaseButtons
          shoot={shoot}
          user={user}
          rigSetting={matchedRig}
          slackMessages={slackMessages}
          onUpdate={onUpdate}
        />
      )}
    </div>
  );
}