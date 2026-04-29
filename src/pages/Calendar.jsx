import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Upload, Plus, X, CalendarDays, CalendarRange, UserCheck, UserX, Check, XCircle, Copy, ShieldCheck, Wrench } from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, addMonths, subMonths, isToday, startOfWeek,
  endOfWeek, addWeeks, subWeeks, addDays
} from 'date-fns';
import CSVImportModal from '../components/shoots/CSVImportModal';
import { getDisplayName } from '../components/utils/nameUtils';
import ShootDetailPanel from '../components/calendar/ShootDetailPanel';
import { shortenTitle } from '../components/utils/scheduleUtils';

const statusColors = {
  upcoming: 'bg-blue-600',
  confirmed: 'bg-green-600',
  in_progress: 'bg-yellow-600',
  completed: 'bg-gray-600',
  cancelled: 'bg-red-700',
};

const AUTO_APPROVE_LIMIT = 5;
const DEFAULT_OFFSETS = { setup_offset: -150, pre_shoot_offset: -120, attention_offset: -30, sound_offset: -30 };
const emptyForm = { title: '', client: '', location: '', date: '', game_time: '', status: 'upcoming', description: '', ...DEFAULT_OFFSETS };

const isFancamOrMixed = (shoot, rigSettings) => {
  if (shoot.rig_type_override === 'Fancam' || shoot.rig_type_override === 'Data/Fancam') return true;
  if (shoot.rig_type_override === 'Data') return false;
  const rs = rigSettings.find(r => r.team && (
    (shoot.client || '').toLowerCase().includes(r.team.toLowerCase()) ||
    (shoot.title || '').toLowerCase().includes(r.team.toLowerCase())
  ));
  return rs?.rig_type === 'Fancam' || rs?.rig_type === 'Data/Fancam';
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

const timeToMinutes = (time) => {
  if (!time || typeof time !== 'string' || !time.includes(':')) return 12 * 60;
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 12 * 60;
  return h * 60 + m;
};

const minutesToTime = (minutes) => {
  const safeMinutes = Math.max(0, Math.min(23 * 60 + 59, minutes));
  const h = Math.floor(safeMinutes / 60).toString().padStart(2, '0');
  const m = (safeMinutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
};

const entryCoversDate = (entry, dateStr) => {
  if (!entry?.start_date || !entry?.end_date) return false;
  return entry.start_date <= dateStr && dateStr <= entry.end_date;
};


async function createShootTimeEntry(shoot, email, name, notes) {
  const { setup_offset = -150 } = shoot;
  const gameMinutes = timeToMinutes(shoot.game_time || '19:00');
  const setupMinutes = gameMinutes + setup_offset - 60;
  const endMinutes = gameMinutes + 300 + 60;
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

function ViewToggle({ viewMode, setViewMode }) {
  const items = [
    { key: 'month', label: 'Calendar', icon: CalendarDays },
    { key: 'week', label: 'Week List', icon: CalendarRange },
  ];

  return (
    <div className="flex gap-1 bg-gray-950 border border-gray-800 rounded-lg p-1">
      {items.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => setViewMode(key)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${viewMode === key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
        >
          <Icon className="h-4 w-4" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

function ShootCalendarEntry({
  shoot,
  day,
  user,
  isAdmin,
  allUsers,
  allShoots,
  rigSettings,
  todayStr,
  compact = false,
  onSelect,
  onUpdate,
  onDuplicate,
  onRigCheckToggle,
  getStandbyCoverageForShoot,
  operatorAvailabilityForDay = [],
}) {
  const isPast = shoot.date < todayStr;
  const isAssigned = shoot.assigned_operators?.includes(user?.email);
  const isPending = shoot.pending_operators?.includes(user?.email);
  const hasPending = (shoot.pending_operators || []).length > 0;
  const fancam = isFancamOrMixed(shoot, rigSettings);
  const standbyCoverage = getStandbyCoverageForShoot?.(shoot);
  const isMyStandbyCoverage = standbyCoverage?.admin_email === user?.email;
  const isOtherStandbyCoverage = !!standbyCoverage && !isMyStandbyCoverage;

  // Standby coverage outlines are admin-only. Remote users see the standby
  // person's name, but not the standby coverage outline.
  const standbyCoverageClass = isAdmin
    ? (isMyStandbyCoverage
      ? 'border-blue-500 ring-1 ring-blue-500/45 shadow-[0_0_0_1px_rgba(59,130,246,0.25)]'
      : isOtherStandbyCoverage
        ? 'border-green-500 ring-1 ring-green-500/45 shadow-[0_0_0_1px_rgba(34,197,94,0.22)]'
        : '')
    : '';

  // Remote users get outlines on their own shoots instead.
  // Purple = assigned to me, Yellow = pending approval for me.
  const remoteUserShootClass = !isAdmin
    ? (isAssigned
      ? 'border-purple-500 ring-1 ring-purple-500/45 shadow-[0_0_0_1px_rgba(168,85,247,0.22)]'
      : isPending
        ? 'border-yellow-500 ring-1 ring-yellow-500/45 shadow-[0_0_0_1px_rgba(234,179,8,0.22)]'
        : '')
    : '';

  const entryOutlineClass = standbyCoverageClass || remoteUserShootClass;

  const rigCheckDone = !!shoot.rig_check_completed;
  const canCheckStandbyRig = !!standbyCoverage && isAdmin && isMyStandbyCoverage && !isPast;

  const handleRigCheckToggle = async (e) => {
    e.stopPropagation();
    if (!canCheckStandbyRig) return;
    await onRigCheckToggle?.(shoot, standbyCoverage);
  };

  const nonAdminAssigned = (shoot.assigned_operators || []).filter(email => {
    const u = allUsers.find(u2 => u2.email === email);
    return !u || u.role !== 'admin';
  });
  const shootFull = !isAdmin && nonAdminAssigned.length > 0 && !isAssigned;

  const dotColor = isPast
    ? 'bg-gray-600'
    : isAssigned
      ? 'bg-purple-500'
      : fancam
        ? 'bg-orange-500'
        : statusColors[shoot.status] || 'bg-blue-600';

  const assignedNames = (shoot.assigned_operators || [])
    .map(email => {
      const assignedUser = allUsers.find(u => u.email === email);
      return getDisplayName(assignedUser, email);
    })
    .join(', ');

  const assignmentLabel = assignedNames || (hasPending ? 'Pending Approval' : 'Unassigned');
  const unavailableNames = operatorAvailabilityForDay
    .filter(e => e.type === 'unavailable')
    .map(e => {
      const unavailableUser = allUsers.find(u => u.email === e.operator_email);
      return getDisplayName(unavailableUser, e.operator_email, e.operator_name);
    });


  const getApprovedCount = (email) =>
    allShoots.filter(s => s.id !== shoot.id && s.date >= todayStr && s.assigned_operators?.includes(email)).length;

  const handleSelfAssign = async (e) => {
    e.stopPropagation();
    if (!user?.email || isPast) return;

    if (isPending) {
      await onUpdate(shoot.id, { pending_operators: (shoot.pending_operators || []).filter(email => email !== user.email) });
    } else if (isAssigned) {
      await onUpdate(shoot.id, { assigned_operators: (shoot.assigned_operators || []).filter(email => email !== user.email) });
    } else if (isAdmin) {
      await onUpdate(shoot.id, { assigned_operators: [...new Set([...(shoot.assigned_operators || []), user.email])] });
      await createShootTimeEntry(shoot, user.email, user.full_name || user.email, `Shoot: ${shoot.title}`);
    } else {
      if (shootFull) return;
      const approvedCount = getApprovedCount(user.email);
      if (approvedCount < AUTO_APPROVE_LIMIT) {
        await onUpdate(shoot.id, { assigned_operators: [...new Set([...(shoot.assigned_operators || []), user.email])] });
      } else if (!(shoot.pending_operators || []).includes(user.email)) {
        await onUpdate(shoot.id, { pending_operators: [...(shoot.pending_operators || []), user.email] });
      }
    }
  };

  const handleApprove = async (e, email) => {
    e.stopPropagation();
    await onUpdate(shoot.id, {
      pending_operators: (shoot.pending_operators || []).filter(item => item !== email),
      assigned_operators: [...new Set([...(shoot.assigned_operators || []), email])],
    });
  };

  const handleReject = async (e, email) => {
    e.stopPropagation();
    await onUpdate(shoot.id, { pending_operators: (shoot.pending_operators || []).filter(item => item !== email) });
  };

  const handleAdminAssignUser = async (email) => {
    if (!email || email === '__placeholder__') return;
    await onUpdate(shoot.id, {
      assigned_operators: [...new Set([...(shoot.assigned_operators || []), email])],
      pending_operators: (shoot.pending_operators || []).filter(item => item !== email),
    });
  };

  const handleRemoveOperator = async (e, email) => {
    e.stopPropagation();
    await onUpdate(shoot.id, { assigned_operators: (shoot.assigned_operators || []).filter(item => item !== email) });
  };

  const assignableUsers = Array.from(
    new Map(
      (allUsers || [])
        .filter((u) => u && typeof u.email === 'string' && u.email.trim() !== '')
        .map((u) => [u.email.trim(), { ...u, email: u.email.trim() }])
    ).values()
  ).filter(
    (u) =>
      !shoot.assigned_operators?.includes(u.email) &&
      !shoot.pending_operators?.includes(u.email)
  );

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onSelect(shoot, day); }}
      onClick={() => onSelect(shoot, day)}
      className={`w-full text-left rounded-lg border transition-colors ${compact ? 'px-1.5 py-1' : 'px-3 py-2.5'} ${isPast ? 'opacity-55 bg-gray-900/60' : 'bg-gray-900/80 hover:bg-gray-800/90'} ${entryOutlineClass || (isPast ? 'border-gray-800' : 'border-gray-800 hover:border-gray-700')} ${shootFull ? 'opacity-45' : ''}`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0 ${dotColor}`} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className={`${compact ? 'text-xs' : 'text-sm'} font-semibold text-white truncate`}>
                {shoot.game_time ? `${shoot.game_time} ` : ''}{shortenTitle(shoot.title)}
              </p>
              {(shoot.client || shoot.location) && !compact && (
                <p className="text-xs text-gray-500 truncate">{shoot.client || shoot.location}</p>
              )}
              <p className={`${compact ? 'text-[11px]' : 'text-xs'} ${hasPending && !assignedNames ? 'text-yellow-400' : 'text-gray-400'} truncate`}>
                {assignmentLabel}
                {hasPending && assignedNames ? ` · Pending Approval (${shoot.pending_operators.length})` : ''}
              </p>
              {!isAdmin && standbyCoverage && (standbyCoverage.admin_name || standbyCoverage.admin_email) && (
                <p className={`${compact ? 'text-[10px]' : 'text-[11px]'} text-green-300 truncate mt-0.5`}>
                  Standby: {standbyCoverage.admin_name || standbyCoverage.admin_email}
                </p>
              )}
              {isAdmin && unavailableNames.length > 0 && !compact && (
                <p className="text-[11px] text-red-300 truncate mt-0.5">
                  Unavailable: {unavailableNames.slice(0, 3).join(', ')}{unavailableNames.length > 3 ? ` +${unavailableNames.length - 3}` : ''}
                </p>
              )}
            </div>
            {!compact && isAdmin && hasPending && (
              <span className="text-[11px] px-2 py-0.5 rounded-full border border-yellow-500/25 bg-yellow-500/15 text-yellow-400 flex-shrink-0">
                Pending
              </span>
            )}
          </div>

          {!compact && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={(e) => { e.stopPropagation(); onDuplicate?.(shoot); }}
                  className="h-7 rounded-md border-gray-700 bg-gray-950/70 text-xs text-gray-300 hover:bg-gray-800 hover:text-white"
                >
                  <Copy className="h-3 w-3 mr-1" />Duplicate
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                disabled={isPast || shootFull}
                onClick={handleSelfAssign}
                className={`h-7 rounded-md border-gray-700 bg-gray-950/70 text-xs ${isAssigned ? 'text-green-300 hover:bg-green-950/30 hover:text-green-200' : isPending ? 'text-yellow-300 hover:bg-yellow-950/30 hover:text-yellow-200' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
              >
                {isAssigned ? <><UserX className="h-3 w-3 mr-1" />Unassign Me</> : isPending ? <><XCircle className="h-3 w-3 mr-1" />Cancel Pending</> : <><UserCheck className="h-3 w-3 mr-1" />Assign Me</>}
              </Button>

              {isAdmin && assignableUsers.length > 0 && (
                <Select onValueChange={handleAdminAssignUser} value="__placeholder__">
                  <SelectTrigger className="h-7 w-[170px] rounded-md border-gray-700 bg-gray-950/80 text-xs text-gray-300 hover:bg-gray-800 hover:text-white" onClick={(e) => e.stopPropagation()}>
                    <SelectValue placeholder="Assign operator" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    <SelectItem value="__placeholder__" disabled className="text-gray-500">Assign operator</SelectItem>
                    {assignableUsers.map(u => (
                      <SelectItem key={u.email} value={u.email} className="text-white">
                        {getDisplayName(u, u.email)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {canCheckStandbyRig && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRigCheckToggle}
                  className={`h-7 rounded-md border-gray-700 bg-gray-950/70 text-xs ${rigCheckDone ? 'text-green-300 hover:bg-green-950/30 hover:text-green-200' : 'text-yellow-300 hover:bg-yellow-950/30 hover:text-yellow-200'}`}
                  title={rigCheckDone ? 'Rig checked - click to untick/remove from message' : 'Mark rig checked'}
                >
                  {rigCheckDone ? <><Check className="h-3 w-3 mr-1" />Rig Checked</> : <><Wrench className="h-3 w-3 mr-1" />Rig Check</>}
                </Button>
              )}
            </div>
          )}

          {!compact && isAdmin && shoot.pending_operators?.length > 0 && (
            <div className="mt-2 space-y-1" onClick={(e) => e.stopPropagation()}>
              {shoot.pending_operators.map(email => {
                const pendingUser = allUsers.find(u => u.email === email);
                return (
                  <div key={email} className="flex items-center justify-between gap-2 rounded-md bg-yellow-950/25 border border-yellow-800/35 px-2 py-1">
                    <span className="text-xs text-yellow-200 truncate">Pending: {getDisplayName(pendingUser, email)}</span>
                    <div className="flex gap-1 flex-shrink-0">
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-green-400 hover:bg-green-950/40" onClick={(e) => handleApprove(e, email)}><Check className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-red-400 hover:bg-red-950/40" onClick={(e) => handleReject(e, email)}><X className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {!compact && isAdmin && shoot.assigned_operators?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
              {shoot.assigned_operators.map(email => {
                const assignedUser = allUsers.find(u => u.email === email);
                return (
                  <span key={email} className="inline-flex items-center gap-1 text-xs rounded-full bg-gray-800 border border-gray-700 text-gray-300 px-2 py-1">
                    {getDisplayName(assignedUser, email)}
                    <button type="button" className="text-gray-500 hover:text-red-400" onClick={(e) => handleRemoveOperator(e, email)}>×</button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function Calendar() {
  const { user, isAdmin, isLevel1Admin } = useApp();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState('month');
  const [showCSV, setShowCSV] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingShoot, setEditingShoot] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedShoot, setSelectedShoot] = useState(null);

  useEffect(() => {
    const applyMobileDefaultView = () => {
      if (window.innerWidth < 768) {
        setViewMode('week');
      }
    };

    applyMobileDefaultView();
    window.addEventListener('resize', applyMobileDefaultView);
    return () => window.removeEventListener('resize', applyMobileDefaultView);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shootId = params.get('shootId');
    if (shootId) setSelectedShoot({ id: shootId, _pending: true });
  }, []);

  const { data: shoots = [] } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list('-date', 500),
  });

  const { data: rigSettings = [] } = useQuery({
    queryKey: ['rigSettings'],
    queryFn: () => base44.entities.RigSetting.list(),
  });

  const { data: rawUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: presenceRecords = [] } = useQuery({
    queryKey: ['userPresence'],
    queryFn: () => base44.entities.UserPresence.list(),
  });

  const allUsers = useMemo(() => {
    const map = new Map();

    (presenceRecords || []).forEach((p) => {
      const email = typeof p?.user_email === 'string' ? p.user_email.trim() : '';
      if (!email) return;

      map.set(email, {
        email,
        full_name: p?.user_name || '',
        role: p?.user_role || '',
        standby: !!p?.standby,
      });
    });

    (rawUsers || []).forEach((u) => {
      const email = typeof u?.email === 'string' ? u.email.trim() : '';
      if (!email) return;

      map.set(email, {
        ...u,
        email,
      });
    });

    return Array.from(map.values()).filter(
      (u) => u && typeof u.email === 'string' && u.email.trim() !== ''
    );
  }, [rawUsers, presenceRecords]);

  const { data: appSettings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const slackMessages = useMemo(() => {
    const msgs = {};
    appSettings.forEach(s => {
      if (s.key?.startsWith('slack_')) msgs[s.key.replace('slack_', '')] = s.value;
    });
    return msgs;
  }, [appSettings]);

  const standbyAdmins = allUsers.filter(u => u.standby === true && u.role === 'admin');

  const { data: standbyDays = [] } = useQuery({
    queryKey: ['standbyDays'],
    queryFn: () => base44.entities.StandbyDay.list('-date', 500),
  });


  const { data: operatorAvailability = [] } = useQuery({
    queryKey: ['operatorAvailability'],
    queryFn: () => base44.entities.OperatorAvailability.list('-start_date', 500),
  });

  const getStandbyCoverageForShoot = (shoot) => {
    if (!shoot?.date) return null;

    const shootTime = shoot.game_time || shoot.start_time || '12:00';
    const shootDateTime = new Date(`${shoot.date}T00:00:00`);
    shootDateTime.setMinutes(timeToMinutes(shootTime));

    return (standbyDays || []).find((standby) => {
      const startDateStr = standby.start_date || standby.date;
      if (!startDateStr) return false;

      const fallbackEndDate = format(addDays(new Date(`${startDateStr}T00:00:00`), 1), 'yyyy-MM-dd');
      const endDateStr = standby.end_date || fallbackEndDate;
      const startTime = standby.start_time || '18:00';
      const endTime = standby.end_time || '06:00';

      const startDateTime = new Date(`${startDateStr}T${startTime}:00`);
      const endDateTime = new Date(`${endDateStr}T${endTime}:00`);

      return shootDateTime >= startDateTime && shootDateTime <= endDateTime;
    }) || null;
  };

  const getStandbyForDay = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return standbyDays.filter(item => (item.start_date || item.date) === dateStr);
  };

  const getPrimaryStandbyForDay = (day) => getStandbyForDay(day)[0] || null;

  const userStandbyForDay = (day) => {
    if (!user?.email) return null;
    return getStandbyForDay(day).find(item => item.admin_email === user.email);
  };

  const getUnavailableForDay = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return operatorAvailability.filter(item => item.type === 'unavailable' && entryCoversDate(item, dateStr));
  };

  const getMyUnavailableForDay = (day) => {
    if (!user?.email) return null;
    const dateStr = format(day, 'yyyy-MM-dd');
    return operatorAvailability.find(item =>
      item.operator_email === user.email &&
      item.type === 'unavailable' &&
      entryCoversDate(item, dateStr)
    );
  };

  const getMyExactCalendarUnavailableForDay = (day) => {
    if (!user?.email) return null;
    const dateStr = format(day, 'yyyy-MM-dd');
    return operatorAvailability.find(item =>
      item.operator_email === user.email &&
      item.type === 'unavailable' &&
      item.start_date === dateStr &&
      item.end_date === dateStr &&
      item.notes === 'Marked unavailable from main calendar'
    );
  };

  const handleToggleUnavailableDay = async (day) => {
    if (!user?.email || isAdmin) return;
    const dateStr = format(day, 'yyyy-MM-dd');
    const exactCalendarEntry = getMyExactCalendarUnavailableForDay(day);

    if (exactCalendarEntry) {
      await base44.entities.OperatorAvailability.delete(exactCalendarEntry.id);
    } else {
      await base44.entities.OperatorAvailability.create({
        operator_email: user.email,
        operator_name: user.full_name || user.email,
        start_date: dateStr,
        end_date: dateStr,
        type: 'unavailable',
        notes: 'Marked unavailable from main calendar',
      });
    }

    queryClient.invalidateQueries({ queryKey: ['operatorAvailability'] });
  };


  const handleToggleStandbyDay = async (day) => {
    if (!isAdmin || !user?.email) return;

    const dateStr = format(day, 'yyyy-MM-dd');
    const endDateStr = format(addDays(day, 1), 'yyyy-MM-dd');
    const dayStandby = getStandbyForDay(day);
    const primaryStandby = dayStandby[0] || null;
    const myStandby = dayStandby.find(item => item.admin_email === user.email);
    const isSomeoneElseStandby = primaryStandby && primaryStandby.admin_email !== user.email;

    if (myStandby) {
      await base44.entities.StandbyDay.delete(myStandby.id);
      await Promise.all(
        dayStandby
          .filter(item => item.id !== myStandby.id && item.admin_email === user.email)
          .map(item => base44.entities.StandbyDay.delete(item.id))
      );
    } else if (isSomeoneElseStandby) {
      const currentName = primaryStandby.admin_name || primaryStandby.admin_email || 'another admin';
      const shouldSwap = window.confirm(`This day is already assigned to ${currentName}. Swap standby coverage to you?`);
      if (!shouldSwap) return;

      await base44.entities.StandbyDay.update(primaryStandby.id, {
        date: dateStr,
        start_date: dateStr,
        start_time: primaryStandby.start_time || '18:00',
        end_date: primaryStandby.end_date || endDateStr,
        end_time: primaryStandby.end_time || '06:00',
        admin_email: user.email,
        admin_name: user.full_name || user.email,
        notes: `Calendar standby swapped from ${currentName}`,
      });

      await Promise.all(
        dayStandby
          .filter(item => item.id !== primaryStandby.id)
          .map(item => base44.entities.StandbyDay.delete(item.id))
      );
    } else {
      await base44.entities.StandbyDay.create({
        date: dateStr,
        start_date: dateStr,
        start_time: '18:00',
        end_date: endDateStr,
        end_time: '06:00',
        admin_email: user.email,
        admin_name: user.full_name || user.email,
        notes: 'Calendar standby assignment',
      });
    }

    queryClient.invalidateQueries({ queryKey: ['standbyDays'] });
  };

  useEffect(() => {
    if (selectedShoot?._pending && shoots.length > 0) {
      const found = shoots.find(s => s.id === selectedShoot.id);
      if (found) {
        setSelectedShoot(found);
        const foundDate = new Date(found.date + 'T12:00:00');
        setSelectedDate(foundDate);
        setCurrentDate(foundDate);
      }
    }
  }, [shoots, selectedShoot]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['shoots'] });

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');

  const getShootsForDay = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return shoots
      .filter(s => s.date === dateStr)
      .sort((a, b) => (a.game_time || a.start_time || '').localeCompare(b.game_time || b.start_time || ''));
  };

  const handleAddShoot = async () => {
    if (!form.title || !form.date) return;
    const payload = {
      ...form,
      setup_offset: Number(form.setup_offset),
      pre_shoot_offset: Number(form.pre_shoot_offset),
      attention_offset: Number(form.attention_offset),
      sound_offset: Number(form.sound_offset),
    };
    if (editingShoot) {
      await base44.entities.Shoot.update(editingShoot.id, payload);
    } else {
      await base44.entities.Shoot.create(payload);
    }
    setForm(emptyForm);
    setShowAddForm(false);
    setEditingShoot(null);
    refresh();
  };

  const handleShootUpdate = async (id, data) => {
    await base44.entities.Shoot.update(id, data);
    refresh();
    setSelectedShoot(prev => prev && prev.id === id ? { ...prev, ...data } : prev);
  };

  const startEdit = (shoot) => {
    setEditingShoot(shoot);
    setForm({ ...emptyForm, ...shoot });
    setShowAddForm(true);
    setTimeout(() => {
      document.getElementById('edit-form-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleDeleteShoot = async (id) => {
    await base44.entities.Shoot.delete(id);
    setSelectedShoot(null);
    refresh();
  };

  const handleRigCheckToggle = async (shoot, standbyCoverage) => {
    if (!shoot?.id || !user?.email) return;
    const nextChecked = !shoot.rig_check_completed;
    const nowIso = new Date().toISOString();

    const update = {
      rig_check_completed: nextChecked,
      rig_check_checked_from_calendar: nextChecked,
      rig_check_checked_by: nextChecked ? user.email : '',
      rig_check_checked_by_name: nextChecked ? (user.full_name || user.email) : '',
      rig_check_checked_at: nextChecked ? nowIso : '',
      rig_check_standby_date: nextChecked ? (standbyCoverage?.start_date || standbyCoverage?.date || '') : '',
      rig_check_standby_admin_email: nextChecked ? (standbyCoverage?.admin_email || '') : '',
      rig_check_standby_admin_name: nextChecked ? (standbyCoverage?.admin_name || standbyCoverage?.admin_email || '') : '',
      rig_check_archived: false,
      rig_check_archived_at: '',
      rig_check_archived_by: '',
      rig_check_archived_by_name: '',
    };

    await base44.entities.Shoot.update(shoot.id, update);
    queryClient.setQueryData(['shoots'], (old = []) =>
      old.map(item => item.id === shoot.id ? { ...item, ...update } : item)
    );
    setSelectedShoot(prev => prev && prev.id === shoot.id ? { ...prev, ...update } : prev);
    refresh();
  };


  const duplicateShoot = (shoot) => {
    if (!isAdmin || !shoot) return;
    const { id, created_date, updated_date, created_by, assigned_operators, pending_operators, ...copy } = shoot;
    setEditingShoot(null);
    setSelectedShoot(null);
    setForm({
      ...emptyForm,
      ...copy,
      title: `${shoot.title || 'Shoot'} Copy`,
      assigned_operators: [],
      pending_operators: [],
      status: shoot.status || 'upcoming',
    });
    setShowAddForm(true);
    setTimeout(() => {
      document.getElementById('edit-form-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleSelectShoot = (shoot, day) => {
    setSelectedShoot(shoot);
    setSelectedDate(day);
    setCurrentDate(day);
  };

  const goPrevious = () => {
    setCurrentDate(prev => {
      if (viewMode === 'month') return subMonths(prev, 1);
      if (viewMode === 'week') return subWeeks(prev, 1);
      return subMonths(prev, 1);
    });
  };

  const goNext = () => {
    setCurrentDate(prev => {
      if (viewMode === 'month') return addMonths(prev, 1);
      if (viewMode === 'week') return addWeeks(prev, 1);
      return addMonths(prev, 1);
    });
  };

  const titleText = useMemo(() => {
    if (viewMode === 'month') return format(currentDate, 'MMMM yyyy');
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    const end = endOfWeek(currentDate, { weekStartsOn: 0 });
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
  }, [currentDate, viewMode]);

  const liveSelectedShoot = selectedShoot
    ? (shoots.find(s => s.id === selectedShoot.id) || selectedShoot)
    : null;

  const renderEntry = (shoot, day, compact = false) => (
    <ShootCalendarEntry
      key={shoot.id}
      shoot={shoot}
      day={day}
      user={user}
      isAdmin={isAdmin}
      allUsers={allUsers}
      allShoots={shoots}
      rigSettings={rigSettings}
      todayStr={todayStr}
      compact={compact}
      onSelect={handleSelectShoot}
      onUpdate={handleShootUpdate}
      onDuplicate={duplicateShoot}
      onRigCheckToggle={handleRigCheckToggle}
      getStandbyCoverageForShoot={getStandbyCoverageForShoot}
      operatorAvailabilityForDay={getUnavailableForDay(day)}
    />
  );

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startPadding = monthStart.getDay();

    return (
      <CardContent className="p-3 md:p-4">
        <div className="grid grid-cols-7 mb-2 min-w-[1100px] xl:min-w-0">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5 min-w-[1100px] xl:min-w-0">
          {Array(startPadding).fill(null).map((_, i) => <div key={`p${i}`} />)}
          {calendarDays.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const isPast = dateStr < todayStr;
            const dayShoots = getShootsForDay(day);
            const dayStandby = getStandbyForDay(day);
            const primaryStandby = getPrimaryStandbyForDay(day);
            const myStandby = userStandbyForDay(day);
            const otherStandby = primaryStandby && primaryStandby.admin_email !== user?.email;
            const dayUnavailable = getUnavailableForDay(day);
            const myUnavailable = getMyUnavailableForDay(day);
            const exactCalendarUnavailable = getMyExactCalendarUnavailableForDay(day);
            const isSelected = isSameDay(day, selectedDate);
            const today = isToday(day);
            return (
              <div
                key={day.toISOString()}
                onClick={() => { setSelectedDate(day); setCurrentDate(day); }}
                className={`min-h-[240px] p-2 rounded-lg cursor-pointer border transition-all overflow-visible
                  ${isSelected ? 'border-blue-500 bg-blue-950/40' : 'border-gray-800 hover:border-gray-600 hover:bg-gray-800/40'}
                  ${today ? 'ring-2 ring-blue-500' : ''}
                  ${isPast ? 'opacity-55' : ''}
                `}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className={`text-xs font-semibold ${today ? 'text-blue-400' : isPast ? 'text-gray-600' : 'text-gray-300'}`}>
                    {format(day, 'd')}
                  </div>
                  {isAdmin && !isPast && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleToggleStandbyDay(day); }}
                      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] transition-colors ${myStandby ? 'border-green-500/40 bg-green-500/15 text-green-300' : otherStandby ? 'border-yellow-500/40 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20' : 'border-gray-700 bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800'}`}
                      title={myStandby ? 'Remove yourself from standby for this day' : otherStandby ? 'Swap this standby day to yourself' : 'Assign yourself to standby for this day'}
                    >
                      <ShieldCheck className="h-3 w-3" />
                      {myStandby ? 'Standby' : otherStandby ? 'Swap' : 'Standby'}
                    </button>
                  )}
                  {!isAdmin && !isPast && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleToggleUnavailableDay(day); }}
                      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] transition-colors ${myUnavailable ? 'border-red-500/45 bg-red-500/15 text-red-300' : 'border-gray-700 bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-800'}`}
                      title={myUnavailable ? exactCalendarUnavailable ? 'Remove your unavailable mark for this day' : 'You are marked unavailable from an availability range' : 'Mark yourself unavailable for this day'}
                    >
                      <UserX className="h-3 w-3" />
                      {myUnavailable ? 'Unavailable' : 'I am out'}
                    </button>
                  )}
                </div>
                {primaryStandby && (
                  <div className="mb-1.5 flex flex-wrap gap-1">
                    <span className={`text-[10px] rounded-full border px-1.5 py-0.5 truncate max-w-full ${primaryStandby.admin_email === user?.email ? 'bg-blue-950/40 border-blue-700/40 text-blue-300' : 'bg-green-950/40 border-green-700/40 text-green-300'}`}>
                      Standby: {primaryStandby.admin_name || primaryStandby.admin_email}
                    </span>
                  </div>
                )}
                {isAdmin && dayUnavailable.length > 0 && (
                  <div className="mb-1.5 flex flex-wrap gap-1">
                    {dayUnavailable.slice(0, 3).map(item => {
                      const unavailableUser = allUsers.find(u => u.email === item.operator_email);
                      return (
                        <span key={item.id} className="text-[10px] rounded-full bg-red-950/45 border border-red-700/45 text-red-200 px-1.5 py-0.5 truncate max-w-full">
                          Out: {getDisplayName(unavailableUser, item.operator_email, item.operator_name).split(' ')[0]}
                        </span>
                      );
                    })}
                    {dayUnavailable.length > 3 && <span className="text-[10px] text-red-300">+{dayUnavailable.length - 3}</span>}
                  </div>
                )}
                <div className="space-y-1">
                  {dayShoots.map(s => renderEntry(s, day, true))}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

    return (
      <CardContent className="p-3 md:p-4">
        <div className="space-y-3">
          {weekDays.map(day => {
            const dayShoots = getShootsForDay(day);
            const dayStandby = getStandbyForDay(day);
            const primaryStandby = getPrimaryStandbyForDay(day);
            const myStandby = userStandbyForDay(day);
            const otherStandby = primaryStandby && primaryStandby.admin_email !== user?.email;
            const dayUnavailable = getUnavailableForDay(day);
            const myUnavailable = getMyUnavailableForDay(day);
            const exactCalendarUnavailable = getMyExactCalendarUnavailableForDay(day);
            const dateStr = format(day, 'yyyy-MM-dd');
            const isPast = dateStr < todayStr;

            return (
              <div key={day.toISOString()} className={`rounded-xl border ${isToday(day) ? 'border-blue-500/60 bg-blue-950/20' : 'border-gray-800 bg-gray-950/40'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-800 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{format(day, 'EEEE, MMMM d')}</p>
                    <p className="text-xs text-gray-500">{dayShoots.length} shoot{dayShoots.length === 1 ? '' : 's'} scheduled{isAdmin && dayUnavailable.length > 0 ? ` · ${dayUnavailable.length} unavailable` : ''}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {primaryStandby && (
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${primaryStandby.admin_email === user?.email ? 'bg-blue-950/40 border-blue-700/40 text-blue-300' : 'bg-green-950/40 border-green-700/40 text-green-300'}`}>
                        <ShieldCheck className="h-3 w-3" /> {primaryStandby.admin_name || primaryStandby.admin_email}
                      </span>
                    )}
                    {isAdmin && dayUnavailable.slice(0, 4).map(item => {
                      const unavailableUser = allUsers.find(u => u.email === item.operator_email);
                      return (
                        <span key={item.id} className="inline-flex items-center gap-1 rounded-full bg-red-950/45 border border-red-700/45 text-red-200 px-2 py-1 text-xs">
                          <UserX className="h-3 w-3" /> {getDisplayName(unavailableUser, item.operator_email, item.operator_name)}
                        </span>
                      );
                    })}
                    {isAdmin && dayUnavailable.length > 4 && <span className="text-xs text-red-300">+{dayUnavailable.length - 4} unavailable</span>}
                    {isAdmin && !isPast && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleStandbyDay(day)}
                        className={`h-8 rounded-md border-gray-700 bg-gray-950/70 text-xs ${myStandby ? 'text-green-300 hover:bg-green-950/30 hover:text-green-200' : otherStandby ? 'text-yellow-300 hover:bg-yellow-950/30 hover:text-yellow-200' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
                      >
                        <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                        {myStandby ? 'Remove My Standby' : otherStandby ? 'Swap Standby To Me' : 'Assign Me Standby'}
                      </Button>
                    )}
                    {!isAdmin && !isPast && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleToggleUnavailableDay(day)}
                        className={`h-8 rounded-md border-gray-700 bg-gray-950/70 text-xs ${myUnavailable ? 'text-red-300 hover:bg-red-950/30 hover:text-red-200' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
                        title={myUnavailable && !exactCalendarUnavailable ? 'You are marked unavailable from an availability range' : undefined}
                      >
                        <UserX className="h-3.5 w-3.5 mr-1" />
                        {myUnavailable ? 'Remove Unavailable' : 'Mark Unavailable'}
                      </Button>
                    )}
                  </div>
                </div>

                <div className="p-3">
                  {dayShoots.length > 0 ? (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
                      {dayShoots.map(shoot => renderEntry(shoot, day, false))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-500 py-3">Nothing scheduled for this day.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    );
  };

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  return (
    <div className="min-h-screen bg-gray-950 text-white p-3 md:p-5">
      <div className="w-full max-w-[1800px] mx-auto">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold">Calendar</h1>
            <p className="text-sm text-gray-500 mt-1">Calendar is the main view. Operators can mark full-day unavailability here; admins see those indicators.</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
            {isAdmin && (
              <>
                <Button onClick={() => { setShowAddForm(true); setEditingShoot(null); setForm({ ...emptyForm, date: format(selectedDate, 'yyyy-MM-dd') }); }} className="bg-blue-600 hover:bg-blue-700" size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Add Shoot
                </Button>
                <Button onClick={() => setShowCSV(true)} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800" size="sm">
                  <Upload className="h-4 w-4 mr-1" /> Import CSV
                </Button>
              </>
            )}
          </div>
        </div>

        <div>
          <Card className="bg-gray-900 border-gray-800 mb-4 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-gray-800 gap-3">
              <Button variant="ghost" size="icon" onClick={goPrevious} className="text-gray-400 hover:text-white hover:bg-gray-800 flex-shrink-0">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="text-center min-w-0">
                <CardTitle className="text-white text-xl truncate">{titleText}</CardTitle>
                <button
                  type="button"
                  onClick={() => { const now = new Date(); setCurrentDate(now); setSelectedDate(now); }}
                  className="text-xs text-blue-400 hover:text-blue-300 mt-1"
                >
                  Jump to today
                </button>
              </div>
              <Button variant="ghost" size="icon" onClick={goNext} className="text-gray-400 hover:text-white hover:bg-gray-800 flex-shrink-0">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </CardHeader>
            <div className="overflow-x-auto">
              {viewMode === 'month' && renderMonthView()}
              {viewMode === 'week' && renderWeekView()}
            </div>
          </Card>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Legend</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
              {[
                { label: 'Upcoming', color: 'bg-blue-600' },
                { label: 'Completed', color: 'bg-gray-600' },
                { label: 'My Assigned', color: 'bg-purple-500' },
                { label: 'Fancam / Data+Fancam', color: 'bg-orange-500' },
                { label: 'Pending Approval', color: 'bg-yellow-400' },
                { label: 'Admin: My Standby Coverage', color: 'bg-blue-500' },
                { label: 'Admin: Other Standby Coverage', color: 'bg-green-500' },
                { label: 'Remote: My Assigned Shoot', color: 'bg-purple-500' },
                { label: 'Remote: My Pending Shoot', color: 'bg-yellow-400' },
                { label: 'Operator Unavailable', color: 'bg-red-500' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
                  <span className="text-xs text-gray-400">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {liveSelectedShoot && (
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="border-b border-gray-800 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-white text-base truncate">{liveSelectedShoot.title}</CardTitle>
                    <p className="text-xs text-gray-400 mt-0.5">{format(new Date(liveSelectedShoot.date + 'T12:00:00'), 'EEE, MMM d yyyy')}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-white ml-2" onClick={() => setSelectedShoot(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {isAdmin && (
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-400 hover:text-white hover:bg-gray-800" onClick={() => startEdit(liveSelectedShoot)}>Edit</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-400 hover:text-white hover:bg-gray-800" onClick={() => duplicateShoot(liveSelectedShoot)}>Duplicate</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400 hover:bg-gray-800" onClick={() => handleDeleteShoot(liveSelectedShoot.id)}>Delete</Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-4">
                <ShootDetailPanel
                  shoot={liveSelectedShoot}
                  user={user}
                  isAdmin={isAdmin}
                  rigSettings={rigSettings}
                  allShoots={shoots}
                  allUsers={allUsers}
                  standbyAdmins={standbyAdmins}
                  slackMessages={slackMessages}
                  onUpdate={handleShootUpdate}
                />
              </CardContent>
            </Card>
          )}

          {isAdmin && showAddForm && (
            <div id="edit-form-anchor" className="mt-4">
              <Card className="bg-gray-900 border-blue-700">
                <CardHeader className="border-b border-gray-800 py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white text-base">{editingShoot ? 'Edit Shoot' : 'New Shoot'}</CardTitle>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-white" onClick={() => { setShowAddForm(false); setEditingShoot(null); setForm(emptyForm); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <Input placeholder="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
                    <Input placeholder="Client / Team" value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
                    <Input placeholder="Venue / Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
                    <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="bg-gray-800 border-gray-700 text-white" />
                    <input type="time" value={form.game_time} onChange={e => setForm({ ...form, game_time: e.target.value })} className="bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2 h-9 text-sm w-full" />
                    <Select
                      value={form.status || 'upcoming'}
                      onValueChange={(v) => setForm({ ...form, status: v })}
                    >
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-gray-700">
                        {['upcoming', 'confirmed', 'in_progress', 'completed', 'cancelled'].map((s) => (
                          <SelectItem
                            key={s}
                            value={s}
                            className="text-white capitalize"
                          >
                            {s.replace('_', ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input placeholder="Notes / Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 md:col-span-3" />
                  </div>
                  <div className="bg-gray-800/60 rounded-lg p-3 mb-3">
                    <p className="text-xs text-gray-400 mb-2 font-medium">Schedule Offsets (minutes before game time)</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { key: 'setup_offset', label: 'Setup' },
                        { key: 'pre_shoot_offset', label: 'Pre-Shoot' },
                        { key: 'attention_offset', label: 'Attention' },
                        { key: 'sound_offset', label: 'Sound' },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <label className="text-xs text-gray-500 block mb-1">{label}</label>
                          <Input type="number" value={form[key]} onChange={e => setForm({ ...form, [key]: Number(e.target.value) })} className="bg-gray-700 border-gray-600 text-white h-8 text-sm" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleAddShoot} className="bg-blue-600 hover:bg-blue-700">{editingShoot ? 'Save Changes' : 'Create Shoot'}</Button>
                    <Button variant="outline" onClick={() => { setShowAddForm(false); setEditingShoot(null); setForm(emptyForm); }} className="border-gray-700 text-gray-300 hover:bg-gray-800">Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      <CSVImportModal open={showCSV} onClose={() => setShowCSV(false)} onImported={refresh} />
    </div>
  );
} 
