import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Copy, Check, UserCheck, UserX, ChevronDown, ChevronUp, UserPlus,
  Zap, Camera, AlertTriangle, Volume2, Clock, Flag, Phone, PhoneOff
} from 'lucide-react';
import { getSchedule, timeToMinutes, minutesToTime } from '../utils/scheduleUtils';
import ShootPhaseButtons from '../shoots/ShootPhaseButtons';

function ReadySlackMessage({ shoot, schedule, showAttention, showSound }) {
  const [copied, setCopied] = useState(false);
  const team = shoot.client || shoot.title;
  const lines = [
    `I am ready for Today's "${team}" shoot`,
    '',
    schedule ? [
      `🔧 Setup: ${schedule.setup}`,
      `📸 Pre-Shoot: ${schedule.pre_shoot}`,
      showAttention ? `⚠️ Attention: ${schedule.attention}` : null,
      showSound ? `🔊 Sound Check: ${schedule.sound}` : null,
      `🏟️ Game Time: ${schedule.game}`,
    ].filter(Boolean).join('\n') : '',
    shoot.location ? `📍 Venue: ${shoot.location}` : '',
  ].filter(Boolean).join('\n');

  return (
    <div className="bg-gray-800/60 rounded-lg border border-gray-700 p-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">📢 Ready Message — Copy to Slack</p>
        <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(lines); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="h-6 text-xs text-gray-400 hover:text-white hover:bg-gray-700">
          {copied ? <><Check className="h-3 w-3 mr-1 text-green-400" />Copied!</> : <><Copy className="h-3 w-3 mr-1" />Copy</>}
        </Button>
      </div>
      <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">{lines}</pre>
    </div>
  );
}

const SHUTTER_OPTIONS = ['1/100', '1/125', '1/160', '1/200', '1/250', '1/320', '1/400'];
const APERTURE_OPTIONS = ['F5.6', 'F6.3', 'F7.1', 'F8', 'F9', 'F10', 'F11'];
const ISO_OPTIONS = ['Auto', '800', '1600', '3200', '6400'];
const AUTO_APPROVE_LIMIT = 5;

function ScheduleRow({ Icon, label, time, highlight }) {
  return (
    <div className={`flex justify-between items-center py-1.5 text-sm ${highlight ? 'text-blue-300 font-bold' : 'text-gray-300'}`}>
      <span className="flex items-center gap-2">
        <Icon className={`h-3.5 w-3.5 flex-shrink-0 ${highlight ? 'text-blue-400' : 'text-gray-500'}`} />
        {label}
      </span>
      <span className="font-mono">{time}</span>
    </div>
  );
}

function CameraToggle({ label, enabled, shutter, aperture, iso }) {
  return (
    <div className={`rounded-lg border p-3 transition-colors ${enabled ? 'border-blue-700 bg-blue-950/30' : 'border-gray-700 bg-gray-800/40'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-white">{label}</span>
        <Badge className={enabled ? 'bg-green-500/20 text-green-400 border-green-500/30 text-xs' : 'bg-gray-700 text-gray-500 border-gray-600 text-xs'}>
          {enabled ? 'ON' : 'OFF'}
        </Badge>
      </div>
      {enabled && (
        <div className="grid grid-cols-3 gap-2 mt-2">
          {[{ label: 'Shutter', value: shutter }, { label: 'Aperture', value: aperture }, { label: 'ISO', value: iso }].map(field => (
            <div key={field.label}>
              <p className="text-xs text-gray-500 mb-1">{field.label}</p>
              <p className="text-xs font-mono text-blue-300 bg-gray-700/60 px-2 py-1 rounded">{field.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ShootDetailPanel({ shoot, user, isAdmin, rigSettings, allShoots = [], allUsers = [], standbyAdmins = [], slackMessages = {}, onUpdate }) {
  const [showRigSettings, setShowRigSettings] = useState(false);
  const [showAssignUser, setShowAssignUser] = useState(false);
  const schedule = getSchedule(shoot);
  const todayStr = new Date().toISOString().split('T')[0];
  const isPast = shoot.date < todayStr;

  const isApproved = shoot.assigned_operators?.includes(user?.email);
  const isPending = shoot.pending_operators?.includes(user?.email);

  const getApprovedCount = (email) =>
    allShoots.filter(s => s.id !== shoot.id && s.date >= todayStr && s.assigned_operators?.includes(email)).length;

  const matchedRig = rigSettings?.find(r =>
    r.team && shoot.client &&
    r.team.toLowerCase().trim() === shoot.client.toLowerCase().trim()
  );

  // Which optional phases are enabled for this shoot
  const showAttention = matchedRig?.attention_camera === true;
  const showSound = matchedRig?.sound === true;

  // End time = game time + 5 hours
  const endTime = schedule ? minutesToTime(timeToMinutes(schedule.game) + 300) : null;

  const handleSelfAssign = async () => {
    if (isPending) {
      await onUpdate(shoot.id, { pending_operators: (shoot.pending_operators || []).filter(e => e !== user?.email) });
    } else if (isApproved) {
      await onUpdate(shoot.id, { assigned_operators: (shoot.assigned_operators || []).filter(e => e !== user?.email) });
    } else if (isAdmin) {
      await onUpdate(shoot.id, { assigned_operators: [...(shoot.assigned_operators || []), user?.email] });
    } else {
      const approvedCount = getApprovedCount(user?.email);
      const current = shoot.pending_operators || [];
      if (!current.includes(user?.email)) {
        if (approvedCount < AUTO_APPROVE_LIMIT) {
          await onUpdate(shoot.id, { assigned_operators: [...new Set([...(shoot.assigned_operators || []), user?.email])] });
        } else {
          await onUpdate(shoot.id, { pending_operators: [...current, user?.email] });
        }
      }
    }
  };

  const handleApprove = async (email) => {
    await onUpdate(shoot.id, {
      pending_operators: (shoot.pending_operators || []).filter(e => e !== email),
      assigned_operators: [...new Set([...(shoot.assigned_operators || []), email])],
    });
  };

  const handleReject = async (email) => {
    await onUpdate(shoot.id, { pending_operators: (shoot.pending_operators || []).filter(e => e !== email) });
  };

  const handleRemoveOperator = async (email) => {
    await onUpdate(shoot.id, { assigned_operators: (shoot.assigned_operators || []).filter(e => e !== email) });
  };

  const handleAdminAssignUser = async (email) => {
    if (!email) return;
    const current = shoot.assigned_operators || [];
    if (!current.includes(email)) await onUpdate(shoot.id, { assigned_operators: [...current, email] });
    setShowAssignUser(false);
  };

  const assignableUsers = allUsers.filter(u => !shoot.assigned_operators?.includes(u.email) && !shoot.pending_operators?.includes(u.email));
  const approvedCount = !isAdmin && user ? getApprovedCount(user.email) : 0;
  const remainingAutoApprove = Math.max(0, AUTO_APPROVE_LIMIT - approvedCount);

  return (
    <div className="space-y-4">
      {/* Schedule */}
      {schedule && (
        <div className="bg-gray-800/60 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Schedule</p>
          <ScheduleRow Icon={Zap} label="Setup" time={schedule.setup} />
          <ScheduleRow Icon={Camera} label="Pre-Shoot" time={schedule.pre_shoot} />
          {showAttention && <ScheduleRow Icon={AlertTriangle} label="Attention" time={schedule.attention} />}
          {showSound && <ScheduleRow Icon={Volume2} label="Sound Check" time={schedule.sound} />}
          <ScheduleRow Icon={Clock} label="Game Time" time={schedule.game} highlight />
          {endTime && <ScheduleRow Icon={Flag} label="Est. End (~5h)" time={endTime} />}
        </div>
      )}

      {/* Notes */}
      {(shoot.description || shoot.notes) && (
        <div className="bg-gray-800/40 rounded-lg p-3">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Notes</p>
          <p className="text-sm text-gray-300">{shoot.description || shoot.notes}</p>
        </div>
      )}

      {/* Rig Settings */}
      {matchedRig && (
        <div className="bg-gray-800/40 rounded-lg border border-gray-700">
          <button onClick={() => setShowRigSettings(!showRigSettings)} className="w-full flex items-center justify-between p-3 text-left">
            <span className="text-sm font-medium text-white">⚙️ Rig Settings — {matchedRig.team}</span>
            {showRigSettings ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
          </button>
          {showRigSettings && (
            <div className="px-3 pb-3 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><p className="text-xs text-gray-500">Sport</p><p className="text-gray-200">{matchedRig.sport || '—'}</p></div>
                <div><p className="text-xs text-gray-500">Venue Type</p><p className="text-gray-200">{matchedRig.venue_type || '—'}</p></div>
                {matchedRig.remote_rigs?.length > 0 && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 mb-1">Remote Rigs (Google)</p>
                    <div className="flex flex-wrap gap-1">
                      {matchedRig.remote_rigs.map((r, i) => (
                        <span key={i} className="text-xs bg-blue-900/40 text-blue-300 border border-blue-700/40 px-2 py-0.5 rounded-full">{r}</span>
                      ))}
                    </div>
                  </div>
                )}
                {matchedRig.shoot_plan && (
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 mb-1">Shoot Plan</p>
                    <p className="text-sm text-gray-300">{matchedRig.shoot_plan}</p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <CameraToggle label="HD Camera" enabled={matchedRig.hd_camera} shutter={matchedRig.hd_shutter} aperture={matchedRig.hd_aperture} iso={matchedRig.hd_iso} />
                <CameraToggle label="Wide Camera" enabled={matchedRig.wide_camera} shutter={matchedRig.wide_shutter} aperture={matchedRig.wide_aperture} iso={matchedRig.wide_iso} />
                <CameraToggle label="Attention Camera" enabled={matchedRig.attention_camera} shutter={matchedRig.attention_shutter} aperture={matchedRig.attention_aperture} iso={matchedRig.attention_iso} />
                <div className={`rounded-lg border p-3 ${matchedRig.sound ? 'border-green-700 bg-green-950/30' : 'border-gray-700 bg-gray-800/40'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">Sound</span>
                    <Badge className={matchedRig.sound ? 'bg-green-500/20 text-green-400 border-green-500/30 text-xs' : 'bg-gray-700 text-gray-500 border-gray-600 text-xs'}>
                      {matchedRig.sound ? 'YES' : 'NO'}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pending approval — admin */}
      {isAdmin && shoot.pending_operators?.length > 0 && (
        <div className="bg-yellow-950/30 border border-yellow-800/50 rounded-lg p-3">
          <p className="text-xs text-yellow-400 uppercase tracking-wider mb-2">⏳ Pending Approval ({shoot.pending_operators.length})</p>
          <div className="space-y-2">
            {shoot.pending_operators.map(email => (
              <div key={email} className="flex items-center justify-between">
                <span className="text-sm text-gray-300 truncate">{allUsers.find(u => u.email === email)?.full_name || email}</span>
                <div className="flex gap-1.5 ml-2 flex-shrink-0">
                  <Button size="sm" className="h-6 text-xs bg-green-700 hover:bg-green-600 px-2" onClick={() => handleApprove(email)}>
                    <UserCheck className="h-3 w-3 mr-1" />Approve
                  </Button>
                  <Button size="sm" variant="ghost" className="h-6 text-xs text-red-400 hover:bg-gray-800 px-2" onClick={() => handleReject(email)}>
                    <UserX className="h-3 w-3 mr-1" />Reject
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Assigned operators */}
      {shoot.assigned_operators?.length > 0 && (
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Assigned Operators</p>
          <div className="space-y-1">
            {shoot.assigned_operators.map(email => (
              <div key={email} className="flex items-center justify-between bg-gray-800/50 rounded px-3 py-1.5">
                <span className="text-sm text-gray-300 truncate">{allUsers.find(u => u.email === email)?.full_name || email}</span>
                {isAdmin && (
                  <Button size="icon" variant="ghost" className="h-6 w-6 text-gray-600 hover:text-red-400 ml-2 flex-shrink-0" onClick={() => handleRemoveOperator(email)}>
                    <UserX className="h-3 w-3" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Admin: assign any user */}
      {isAdmin && !isPast && (
        <div>
          {showAssignUser ? (
            <div className="bg-gray-800/60 rounded-lg p-3">
              <p className="text-xs text-gray-400 mb-2">Assign a user:</p>
              <select onChange={e => handleAdminAssignUser(e.target.value)} defaultValue="" className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded px-2 py-1.5 mb-2">
                <option value="" disabled>Select user…</option>
                {assignableUsers.map(u => (
                  <option key={u.email} value={u.email}>{u.full_name || u.email}</option>
                ))}
              </select>
              <Button size="sm" variant="ghost" className="text-xs text-gray-500 hover:text-white" onClick={() => setShowAssignUser(false)}>Cancel</Button>
            </div>
          ) : (
            <Button size="sm" variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800 w-full text-xs" onClick={() => setShowAssignUser(true)}>
              <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Assign User
            </Button>
          )}
        </div>
      )}

      {/* Self assign/unassign */}
      {!isPast && (
        <div>
          <Button
            size="sm"
            onClick={handleSelfAssign}
            className={
              isApproved ? 'border border-red-700 text-red-400 bg-transparent hover:bg-red-900/30 w-full'
              : isPending ? 'border border-yellow-700 text-yellow-400 bg-transparent hover:bg-yellow-900/20 w-full'
              : 'bg-blue-600 hover:bg-blue-700 text-white w-full'
            }
          >
            {isApproved ? 'Unassign Myself' : isPending ? '⏳ Pending — Cancel' : isAdmin ? '+ Assign Myself (no earnings)' : '+ Assign Myself'}
          </Button>
          {!isAdmin && !isApproved && !isPending && (
            <p className="text-xs text-center mt-1 text-gray-500">
              {remainingAutoApprove > 0 ? `${remainingAutoApprove} auto-approvals remaining` : 'Requires admin approval'}
            </p>
          )}
        </div>
      )}

      {/* Ready Slack message — shown as soon as assigned */}
      {isApproved && schedule && (
        <ReadySlackMessage shoot={shoot} schedule={schedule} showAttention={showAttention} showSound={showSound} />
      )}

      {/* Admin: assign self as standby for this shoot */}
      {isAdmin && !isPast && (
        <div className="bg-gray-800/40 rounded-lg border border-gray-700 p-3">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Phone className="h-3 w-3" /> Standby Assignment
          </p>
          {shoot.standby_admin ? (
            <div className="flex items-center justify-between">
              <span className="text-sm text-yellow-300">
                {allUsers.find(u => u.email === shoot.standby_admin)?.full_name || shoot.standby_admin}
              </span>
              {shoot.standby_admin === user?.email && (
                <Button size="sm" variant="ghost" className="h-6 text-xs text-gray-400 hover:text-red-400"
                  onClick={() => onUpdate(shoot.id, { standby_admin: null })}>
                  <PhoneOff className="h-3 w-3 mr-1" /> Remove
                </Button>
              )}
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="h-7 text-xs text-yellow-400 hover:bg-yellow-950/40 border border-yellow-800/50 w-full"
              onClick={() => onUpdate(shoot.id, { standby_admin: user?.email })}>
              <Phone className="h-3 w-3 mr-1.5" /> Set Myself as Standby
            </Button>
          )}
        </div>
      )}

      {/* Standby contact — remote users */}
      {!isAdmin && standbyAdmins.length > 0 && (
        <div className="bg-yellow-950/30 border border-yellow-800/50 rounded-lg p-3">
          <p className="text-xs text-yellow-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <Phone className="h-3 w-3" /> Standby Contact
          </p>
          {standbyAdmins.map(a => (
            <p key={a.email} className="text-sm text-yellow-200">{a.full_name || a.email}</p>
          ))}
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