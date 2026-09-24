import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Upload, Plus, Minus, CalendarDays, CalendarRange, UserX, Check, XCircle, Copy, ShieldCheck, Wrench, RefreshCw, MessageSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import SlackSyncToggle from '../components/calendar/SlackSyncToggle';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, addMonths, subMonths, isToday, startOfWeek,
  endOfWeek, addWeeks, subWeeks, addDays
} from 'date-fns';
import CSVImportModal from '../components/shoots/CSVImportModal';
import { getDisplayName } from '../components/utils/nameUtils';
import ShootSidePanel from '../components/calendar/ShootSidePanel';
import { shortenTitle } from '../components/utils/scheduleUtils';
import { AUTO_APPROVE_LIMIT, getPreApprovedCount, addEmail, removeEmail, hasEmail, findPairedShoot, findPairedShootForUnassign, approvePendingFields, declinePendingFields, isClaimedByOtherOperator, exclusiveAssignFields, exclusivePendingFields, getShootClaimEmail, normalizeEmail } from '../utils/assignmentApproval';
import { standbyColorForEmail, EMPTY_STANDBY_COLOR } from '../components/utils/standbyColors';
import CalendarContextMenu from '../components/calendar/CalendarContextMenu';
import AssignOperatorModal from '../components/calendar/AssignOperatorModal';
import ShootEditPanel from '../components/calendar/ShootEditPanel';
import DayEventsPopup from '../components/calendar/DayEventsPopup';
import ShootQuickView from '../components/calendar/ShootQuickView';
import { submitCalendarChangeRequest } from '../utils/calendarChangeRequests';
import {
  SHOOT_STATUS_DOTS,
  normalizeShootStatus,
} from '../utils/shootStatus';

const MONTH_VISIBLE_SHOOTS = 3;

const statusColors = {
  upcoming: 'bg-blue-600',
  postponed: 'bg-amber-500',
  completed: 'bg-gray-600',
  cancelled: 'bg-red-600',
};

const emptyForm = { title: '', client: '', date: '', game_time: '', status: 'upcoming', description: '', live_data: false };

// Fuzzy rig match: shoot client/title contains team name OR team name contains shoot client/title keyword
const findMatchingRig = (shoot, rigSettings) => {
  if (!shoot) return null;
  const client = (shoot.client || '').toLowerCase().trim();
  const title = (shoot.title || '').toLowerCase().trim();
  return rigSettings.find(r => {
    const team = (r.team || '').toLowerCase().trim();
    if (!team) return false;
    return (
      team === client || team === title ||
      client.includes(team) || title.includes(team) ||
      team.includes(client) || team.includes(title)
    );
  }) || null;
};

const isFancamOrMixed = (shoot, rigSettings) => {
  if (shoot.rig_type_override === 'Fancam' || shoot.rig_type_override === 'Data/Fancam') return true;
  if (shoot.rig_type_override === 'Data') return false;
  const rs = findMatchingRig(shoot, rigSettings);
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

// ✅ FIX: correctly handles times before/after midnight
const minutesToTime = (minutes) => {
  if (typeof minutes !== 'number' || isNaN(minutes)) return '00:00';

  // Wrap around 24h instead of clamping
  const normalizedMinutes = ((minutes % 1440) + 1440) % 1440;

  const h = Math.floor(normalizedMinutes / 60).toString().padStart(2, '0');
  const m = (normalizedMinutes % 60).toString().padStart(2, '0');

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
    <div className="flex gap-1 bg-slate-800 border border-slate-800 rounded-lg p-1">
      {items.map(({ key, label, icon: Icon }) => (
        <button
          key={key}
          onClick={() => setViewMode(key)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${viewMode === key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800'}`}
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
  isOperator,
  isAnalytics = false,
  allUsers,
  allShoots,
  rigSettings,
  appSettings = [],
  todayStr,
  compact = false,
  onSelect,
  onUpdate,
  onContextMenu,
  onQuickView,
  getStandbyCoverageForShoot,
  queryClient,
}) {
  // Grey out past, completed, and cancelled shoots
  const status = normalizeShootStatus(shoot.status);
  const isPast = shoot.date < todayStr;
  const isCompleted = status === 'completed';
  const isCancelled = status === 'cancelled';
  const isPostponed = status === 'postponed';
  const shouldGrey = isPast || isCompleted || isCancelled;

  const isAssigned = shoot.assigned_operators?.includes(user?.email);
  const isPending = shoot.pending_operators?.includes(user?.email);
  const hasPending = (shoot.pending_operators || []).length > 0;
  const fancam = isFancamOrMixed(shoot, rigSettings);
  const standbyCoverage = getStandbyCoverageForShoot?.(shoot);
  const standbyColor = standbyCoverage ? standbyColorForEmail(standbyCoverage.admin_email) : null;
  const coveredTitleClass = standbyColor
    ? `${standbyColor.highlight} rounded-sm px-1`
    : '';
  const coveredTitleTitle = standbyCoverage
    ? `Standby: ${standbyCoverage.admin_name || standbyCoverage.admin_email}`
    : undefined;

  const myAssignedShootClass = isAssigned
    ? 'border-purple-500 ring-1 ring-purple-500/45 shadow-[0_0_0_1px_rgba(168,85,247,0.22)]'
    : '';

  const pendingShootClass = isOperator && isPending
    ? 'border-yellow-500 ring-1 ring-yellow-500/45 shadow-[0_0_0_1px_rgba(234,179,8,0.22)]'
    : '';

  const entryOutlineClass = myAssignedShootClass || pendingShootClass;

  // Remotes cannot self-assign when another remote already claimed (assigned or pending)
  const claimedByOther = isClaimedByOtherOperator(shoot, user?.email);
  const takenByOther = !isAnalytics && !isAdmin && !isAssigned && !isPending && claimedByOther;

  const dotColor = isCancelled
    ? 'bg-red-600'
    : isPostponed
      ? 'bg-amber-500'
      : shouldGrey
        ? 'bg-gray-600'
        : fancam
          ? 'bg-orange-500'
          : (SHOOT_STATUS_DOTS[status] || statusColors[status] || 'bg-blue-600');

  const assignedNames = (shoot.assigned_operators || [])
    .map(email => {
      const assignedUser = allUsers.find(u => u.email === email);
      return getDisplayName(assignedUser, email);
    })
    .join(', ');

  const assignmentLabel = assignedNames || (hasPending ? 'Pending Approval' : 'Unassigned');

  // Count pre-approved slots using shared helper (reads live cache to avoid stale counts)
  const getPreApproved = (email) => {
    const freshShoots = queryClient?.getQueryData(['shoots']) || allShoots;
    return getPreApprovedCount(freshShoots, email, shoot.id, todayStr);
  };

  // Auto-assign config from appSettings (passed down via allShoots context)
  const autoAssignTeams = (() => {
    const raw = appSettings?.find(s => s.key === 'auto_assign_teams')?.value;
    return raw ? JSON.parse(raw) : ['Reds', 'Red Sox', 'Rangers'];
  })();
  const autoAssignUsers = (() => {
    const raw = appSettings?.find(s => s.key === 'auto_assign_users')?.value;
    return raw ? JSON.parse(raw) : [];
  })();
  const autoAssignWindowMinutes = (() => {
    const raw = appSettings?.find(s => s.key === 'auto_assign_window_hours')?.value;
    return (raw ? Number(raw) : 2) * 60;
  })();
  const userEligibleForAutoAssign = !isAdmin && user && (
    autoAssignUsers.length === 0 || autoAssignUsers.includes(user.email)
  );

  const handleSelfAssign = async (e) => {
    e.stopPropagation();
    if (!user?.email || isPast) return;
    const email = user.email;

    if (isPending) {
      // Cancel pending — remove from pending, pre_approved_operators
      await onUpdate(shoot.id, {
        pending_operators: removeEmail(shoot.pending_operators, email),
        pre_approved_operators: removeEmail(shoot.pre_approved_operators, email),
      });
    } else if (isAssigned) {
      // Unassign — remove from all arrays + cascade to paired shoot (bidirectional)
      await onUpdate(shoot.id, {
        assigned_operators: removeEmail(shoot.assigned_operators, email),
        pending_operators: removeEmail(shoot.pending_operators, email),
        pre_approved_operators: removeEmail(shoot.pre_approved_operators, email),
        auto_assigned_for: removeEmail(shoot.auto_assigned_for, email),
      });
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
      if (claimedByOther) {
        const current = getShootClaimEmail(shoot);
        const currentName = getDisplayName(allUsers.find((u) => normalizeEmail(u.email) === current), current);
        if (!window.confirm(`${currentName} is already on this shoot. Take it over?`)) return;
      }
      await onUpdate(shoot.id, exclusiveAssignFields(email));
      await createShootTimeEntry(shoot, email, user.full_name || email, `Shoot: ${shoot.title}`);
      const partner = findPairedShoot(shoot, allShoots, autoAssignTeams, autoAssignWindowMinutes, email);
      if (partner) {
        await onUpdate(partner.id, exclusiveAssignFields(email, {
          auto_assigned_for: addEmail(partner.auto_assigned_for, email),
        }));
      }
    } else if (claimedByOther) {
      return;
    } else {
      const preCount = getPreApproved(email);
      const withinLimit = preCount < AUTO_APPROVE_LIMIT;

      if (withinLimit) {
        await onUpdate(shoot.id, exclusiveAssignFields(email, {
          pre_approved_operators: addEmail(shoot.pre_approved_operators, email),
        }));
      } else if (!hasEmail(shoot.pending_operators, email)) {
        await onUpdate(shoot.id, exclusivePendingFields(email, {
          pre_approved_operators: removeEmail(shoot.pre_approved_operators, email),
        }));
      }

      if (userEligibleForAutoAssign) {
        const partner = findPairedShoot(shoot, allShoots, autoAssignTeams, autoAssignWindowMinutes, email);
        if (partner) {
          const countAfterMain = withinLimit ? preCount + 1 : preCount;
          const partnerWithinLimit = countAfterMain < AUTO_APPROVE_LIMIT;
          if (partnerWithinLimit) {
            await onUpdate(partner.id, exclusiveAssignFields(email, {
              pre_approved_operators: addEmail(partner.pre_approved_operators, email),
              auto_assigned_for: addEmail(partner.auto_assigned_for, email),
            }));
          } else {
            await onUpdate(partner.id, exclusivePendingFields(email, {
              pre_approved_operators: removeEmail(partner.pre_approved_operators, email),
              auto_assigned_for: removeEmail(partner.auto_assigned_for, email),
            }));
          }
        }
      }
    }
  };

  const titleText = shortenTitle(shoot.title) || 'Untitled shoot';
  const showMinus = isAssigned || isPending;
  const canQuickAssign = !isAnalytics && !isPast && !!user?.email && (showMinus || isAdmin || !claimedByOther);

  const quickAssignButton = (
    <button
      type="button"
      disabled={!canQuickAssign}
      onClick={handleSelfAssign}
      className={`inline-flex items-center justify-center rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
        compact ? 'h-4 w-4 opacity-0 group-hover:opacity-100 focus:opacity-100' : 'h-7 w-7 border'
      } ${
        showMinus
          ? compact
            ? 'text-red-300 hover:bg-red-950/50'
            : 'border-red-500/40 bg-red-950/40 text-red-300 hover:bg-red-950/70'
          : takenByOther
            ? compact
              ? 'text-slate-500'
              : 'border-slate-700 bg-slate-800/60 text-slate-500'
            : compact
              ? 'text-emerald-300 hover:bg-emerald-950/40'
              : 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300 hover:bg-emerald-950/50'
      } ${compact && showMinus ? 'opacity-100' : ''} ${compact && takenByOther ? 'opacity-60' : ''}`}
      title={
        isPast
          ? 'Past shoot'
          : showMinus
            ? isPending
              ? 'Cancel pending'
              : 'Unassign yourself'
            : takenByOther
              ? hasPending
                ? 'Pending approval — unavailable'
                : 'Taken by another operator'
              : (isAdmin && claimedByOther)
                ? 'Take over this shoot'
                : 'Assign yourself'
      }
      aria-label={showMinus ? 'Unassign yourself' : 'Assign yourself'}
    >
      {showMinus
        ? <Minus className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />
        : <Plus className={compact ? 'h-3 w-3' : 'h-3.5 w-3.5'} />}
    </button>
  );

  if (compact) {
    return (
      <div
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (onQuickView) onQuickView(shoot);
            else onSelect?.(shoot, day);
          }
        }}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (onQuickView) onQuickView(shoot);
          else onContextMenu?.(e, shoot);
        }}
        className={`group w-full text-left rounded px-0.5 py-px transition-colors hover:bg-slate-800/90 ${
          shouldGrey ? 'opacity-50' : !isAnalytics && takenByOther ? 'opacity-40' : ''
        } ${isAssigned ? 'bg-slate-800/50' : ''} ${isPending && !isAssigned ? 'bg-amber-950/20' : ''} ${
          isCancelled ? 'ring-1 ring-red-600/50 bg-red-950/20' : ''
        } ${standbyColor ? `border-l-2 ${standbyColor.accent} pl-1` : ''}`}
      >
        <div className="flex items-center gap-1 min-w-0">
          <span className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
          <p className="min-w-0 flex-1 text-[11px] leading-[1.35] text-slate-100 truncate">
            {shoot.game_time ? (
              <span className="tabular-nums text-slate-400 mr-1">{shoot.game_time}</span>
            ) : null}
            <span className={coveredTitleClass || undefined} title={coveredTitleTitle}>{titleText}</span>
            {shoot.google_sync_flag === 'new' && (
              <span className="ml-1 text-[9px] uppercase text-emerald-300">New</span>
            )}
            {shoot.google_sync_flag === 'updated' && (
              <span className="ml-1 text-[9px] uppercase text-amber-300">Updated</span>
            )}
          </p>
          {!isAnalytics && (
            <div className="flex items-center flex-shrink-0" onClick={(e) => e.stopPropagation()}>
              {quickAssignButton}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (onQuickView) onQuickView(shoot);
          else if (!isAdmin) onSelect?.(shoot, day);
        }
      }}
      onClick={(e) => {
        e.preventDefault();
        if (onQuickView) onQuickView(shoot);
        else onContextMenu?.(e, shoot);
      }}
      className={`w-full text-left rounded-lg border transition-colors px-3 py-2 ${shouldGrey ? 'opacity-55 bg-slate-900' : !isAnalytics && takenByOther ? 'opacity-40 bg-slate-900' : 'bg-slate-900 hover:bg-slate-800/90'} ${
        isCancelled
          ? 'border-red-600/60 ring-1 ring-red-600/30'
          : entryOutlineClass || (shouldGrey ? 'border-slate-800' : 'border-slate-800 hover:border-slate-800')
      } ${standbyCoverage ? `border-l-2 ${standbyColorForEmail(standbyCoverage.admin_email).accent}` : ''}`}
    >
      <div className="flex items-start gap-2">
        <span className={`mt-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0 ${dotColor}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-100 break-words whitespace-normal leading-snug">
            {shoot.game_time ? <span className="font-mono tabular-nums text-slate-400 font-medium mr-1.5">{shoot.game_time}</span> : null}
            <span className={coveredTitleClass || undefined} title={coveredTitleTitle}>{titleText}</span>
            {shoot.google_sync_flag === 'new' && (
              <span className="ml-1.5 text-[10px] uppercase tracking-wide text-emerald-300">New</span>
            )}
            {shoot.google_sync_flag === 'updated' && (
              <span className="ml-1.5 text-[10px] uppercase tracking-wide text-amber-300">Updated</span>
            )}
          </p>
          <p className={`text-xs mt-0.5 ${hasPending && !assignedNames ? 'text-amber-400' : 'text-slate-400'}`}>
            {assignmentLabel}
          </p>
        </div>
        {!isAnalytics && (
          <div className="flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {quickAssignButton}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Calendar() {
  const { user, isAdmin, isStandby, isOperator, isAnalytics } = useApp();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState(typeof window !== 'undefined' && window.innerWidth < 768 ? 'week' : 'month');
  const [showCSV, setShowCSV] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingShoot, setEditingShoot] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedShoot, setSelectedShoot] = useState(null);
  const [rigCheckMessageShootIds, setRigCheckMessageShootIds] = useState([]);
  const [rigCheckCopied, setRigCheckCopied] = useState(false);
  const [showRigCheckPanel, setShowRigCheckPanel] = useState(false);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, shoot }
  const [assignOperatorsModal, setAssignOperatorsModal] = useState(null); // shoot
  const [editingShootForm, setEditingShootForm] = useState(null); // shoot being edited
  const [dayPopup, setDayPopup] = useState(null); // Date | null
  const [quickViewShoot, setQuickViewShoot] = useState(null); // shoot | null
  const [googleSyncing, setGoogleSyncing] = useState(false);
  const [slackSyncing, setSlackSyncing] = useState(false);
  const canSyncCalendar = isAdmin || isAnalytics;

  useEffect(() => {
    if (window.innerWidth < 768) {
      setViewMode('week');
    }
  }, []);

  const { data: googleStatus } = useQuery({
    queryKey: ['googleStatus'],
    queryFn: () => base44.google.status(),
    enabled: !!canSyncCalendar,
  });

  const { data: slackStatus } = useQuery({
    queryKey: ['slackStatus'],
    queryFn: () => base44.slack.status(),
    enabled: !!canSyncCalendar,
  });

  const handleGoogleSync = async () => {
    if (!canSyncCalendar || googleSyncing) return;
    setGoogleSyncing(true);
    try {
      const result = await base44.google.sync();
      await queryClient.invalidateQueries({ queryKey: ['shoots'] });
      await queryClient.invalidateQueries({ queryKey: ['googleStatus'] });
      toast.success(
        `Data + Fancam sync: ${result.created} new · ${result.updated} updated · ${result.cancelled} cancelled. Google was not changed.`
      );
    } catch (err) {
      toast.error(err.message || 'Google sync failed');
    } finally {
      setGoogleSyncing(false);
    }
  };

  const handleSlackSync = async () => {
    if (!canSyncCalendar || slackSyncing) return;
    if (!slackStatus?.enabled) {
      toast.error('Turn on Slack sync first.');
      return;
    }
    if (!slackStatus?.configured) {
      toast.error('Connect the Gameday Slack channel in Settings → Calendar first.');
      return;
    }
    setSlackSyncing(true);
    try {
      const result = await base44.slack.sync();
      await queryClient.invalidateQueries({ queryKey: ['shoots'] });
      await queryClient.invalidateQueries({ queryKey: ['slackStatus'] });
      toast.success(
        `Slack Gameday: ${result.created} new · ${result.updated} updated${result.skipped ? ` · ${result.skipped} not marked for capture` : ''}. Assignments kept.`
      );
    } catch (err) {
      toast.error(err.message || 'Slack sync failed');
    } finally {
      setSlackSyncing(false);
    }
  };

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

  const { data: pendingUsers = [] } = useQuery({
    queryKey: ['pendingUsers'],
    queryFn: () => base44.entities.PendingUser.list(),
  });

  const { data: presenceRecords = [] } = useQuery({
    queryKey: ['userPresence'],
    queryFn: () => base44.entities.UserPresence.list(),
  });

  const EXCLUDED_EMAILS = ['hano@fancam.com', 'matthew.swart@fancam.com'];

  const allUsers = useMemo(() => {
    const map = new Map();

    // Start with PendingUser records as the base name source (admin-defined names)
    (pendingUsers || []).forEach((pu) => {
      const email = typeof pu?.email === 'string' ? pu.email.trim().toLowerCase() : '';
      if (!email) return;
      map.set(email, {
        email,
        full_name: pu.full_name || '',
        role: pu.role || '',
      });
    });

    (presenceRecords || []).forEach((p) => {
      const email = typeof p?.user_email === 'string' ? p.user_email.trim().toLowerCase() : '';
      if (!email) return;
      const existing = map.get(email);
      map.set(email, {
        ...(existing || {}),
        email,
        // Prefer PendingUser full_name over presence name
        full_name: existing?.full_name || p?.user_name || '',
        role: existing?.role || p?.user_role || '',
        standby: !!p?.standby,
      });
    });

    (rawUsers || []).forEach((u) => {
      const email = typeof u?.email === 'string' ? u.email.trim().toLowerCase() : '';
      if (!email) return;
      const existing = map.get(email);
      map.set(email, {
        ...u,
        email,
        // Prefer PendingUser full_name (admin-set) over User entity name
        full_name: existing?.full_name || u.full_name || '',
      });
    });

    return Array.from(map.values()).filter(
      (u) => u && typeof u.email === 'string' && u.email.trim() !== '' &&
        !EXCLUDED_EMAILS.includes(u.email.trim().toLowerCase())
    );
  }, [rawUsers, presenceRecords, pendingUsers]);

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
    if (!(isAdmin || isStandby) || !user?.email) return;

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

  const getShootTeamName = (shoot) => {
    const rig = findMatchingRig(shoot, rigSettings);
    if (rig?.team) return rig.team;
    if (shoot?.client) return shoot.client;
    return shortenTitle(shoot?.title || 'Unknown Team');
  };

  const buildRigCheckSlackMessage = (messageShoots) => {
    const uniqueShoots = Array.from(new Map(messageShoots.map(s => [s.id, s])).values());
    if (uniqueShoots.length === 0) return '';

    const items = uniqueShoots
      .sort((a, b) => ((a.date || '') + ' ' + (a.game_time || '')).localeCompare((b.date || '') + ' ' + (b.game_time || '')))
      .map((s) => {
        const rig = findMatchingRig(s, rigSettings);
        const teamName = getShootTeamName(s);
        const label = getRigTypeLabel(s, rig) || 'Data';
        return '• ' + teamName + ' - ' + label;
      });

    return 'Shoots ready for today :\n\n' + items.join('\n');
  };

  const rigCheckMessageShoots = useMemo(() => {
    return rigCheckMessageShootIds
      .map(id => shoots.find(s => s.id === id))
      .filter(Boolean)
      .filter(s => !s.rig_check_archived);
  }, [rigCheckMessageShootIds, shoots]);

  const rigCheckSlackMessage = useMemo(
    () => buildRigCheckSlackMessage(rigCheckMessageShoots),
    [rigCheckMessageShoots, rigSettings]
  );

  const handleCopyRigCheckMessage = async () => {
    if (!rigCheckSlackMessage) return;
    await navigator.clipboard.writeText(rigCheckSlackMessage);
    setRigCheckCopied(true);
    // don't auto-reset — stays green until archived
  };

  const handleArchiveRigCheckMessageShoots = async () => {
    const idsToArchive = rigCheckMessageShoots.map(s => s.id);
    if (idsToArchive.length === 0) return;

    await Promise.all(idsToArchive.map(id =>
      base44.entities.Shoot.update(id, {
        rig_check_archived: true,
        rig_check_archived_at: new Date().toISOString(),
        rig_check_archived_by: user?.email || '',
        rig_check_archived_by_name: user?.full_name || user?.email || '',
      })
    ));

    setRigCheckMessageShootIds(prev => prev.filter(id => !idsToArchive.includes(id)));
    setRigCheckCopied(false);
    setShowRigCheckPanel(false);
    refresh();
  };

  const handleRigCheckToggle = async (shoot, standbyCoverage) => {
    if (!shoot?.id || !user?.email) return;
    const nextChecked = !shoot.rig_check_completed;
    const nowIso = new Date().toISOString();

    await base44.entities.Shoot.update(shoot.id, {
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
    });

    setRigCheckMessageShootIds(prev => {
      if (nextChecked) return [...new Set([...prev, shoot.id])];
      return prev.filter(id => id !== shoot.id);
    });

    if (nextChecked) setShowRigCheckPanel(true);

    refresh();
    setSelectedShoot(prev => prev && prev.id === shoot.id
      ? {
          ...prev,
          rig_check_completed: nextChecked,
          rig_check_checked_from_calendar: nextChecked,
          rig_check_checked_by: nextChecked ? user.email : '',
          rig_check_checked_by_name: nextChecked ? (user.full_name || user.email) : '',
          rig_check_checked_at: nextChecked ? nowIso : '',
        }
      : prev
    );
  };

  const handleRigCheckCancel = async (shoot) => {
    if (!shoot?.id || !user?.email) return;

    const clearedRigCheck = {
      rig_check_completed: false,
      rig_check_checked_from_calendar: false,
      rig_check_checked_by: '',
      rig_check_checked_by_name: '',
      rig_check_checked_at: '',
      rig_check_standby_date: '',
      rig_check_standby_admin_email: '',
      rig_check_standby_admin_name: '',
      rig_check_archived: false,
      rig_check_archived_at: '',
      rig_check_archived_by: '',
      rig_check_archived_by_name: '',
    };

    await base44.entities.Shoot.update(shoot.id, clearedRigCheck);

    setRigCheckMessageShootIds(prev => prev.filter(id => id !== shoot.id));
    queryClient.setQueryData(['shoots'], (old = []) =>
      old.map(item => item.id === shoot.id ? { ...item, ...clearedRigCheck } : item)
    );
    setSelectedShoot(prev => prev && prev.id === shoot.id ? { ...prev, ...clearedRigCheck } : prev);
    refresh();
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
      status: normalizeShootStatus(form.status),
      last_changed_by_email: user?.email || '',
      last_changed_by_name: user?.full_name || user?.email || '',
    };
    if (isAnalytics) {
      await submitCalendarChangeRequest({
        user,
        action: editingShoot ? 'update' : 'create',
        shoot: editingShoot,
        payload,
        summary: editingShoot ? `Update ${form.title}` : `Add ${form.title}`,
      });
      toast.success('Request sent to admins');
      setForm(emptyForm);
      setEditingShootForm(null);
      setEditingShoot(null);
      return;
    }

    // FIX: If a completed shoot is changed back to upcoming/etc,
    // remove the completed phase marker so it appears in the upcoming banner again.
    if (editingShoot?.phase_status?.shoot_complete && payload.status !== 'completed') {
      const { shoot_complete, ...restPhaseStatus } = editingShoot.phase_status;

      payload.phase_status = {
        ...restPhaseStatus,
      };
    }
    if (editingShoot) {
      await base44.entities.Shoot.update(editingShoot.id, payload);
    } else {
      await base44.entities.Shoot.create(payload);
    }
    setForm(emptyForm);
    setEditingShootForm(null);
    setEditingShoot(null);
    refresh();
  };

  const handleShootUpdate = async (id, data) => {
    if (isAnalytics) {
      const existing = shoots.find((s) => s.id === id);
      await submitCalendarChangeRequest({
        user,
        action: 'update',
        shoot: existing,
        payload: data,
        summary: `Update ${existing?.title || 'shoot'}`,
      });
      toast.success('Request sent to admins');
      return;
    }
    // If admin is reverting status away from completed, clear the shoot_complete phase marker
    const payload = {
      ...data,
      last_changed_by_email: user?.email || '',
      last_changed_by_name: user?.full_name || user?.email || '',
    };
    if (payload.status != null) {
      payload.status = normalizeShootStatus(payload.status);
    }
    if (data.status && normalizeShootStatus(data.status) !== 'completed') {
      const existing = shoots.find(s => s.id === id);
      if (existing?.phase_status?.shoot_complete) {
        const { shoot_complete, ...restPhase } = existing.phase_status;
        payload.phase_status = restPhase;
      }
    }
    // Optimistic update: immediately reflect changes in the cache so the limit counter
    // is accurate on the very next assignment click (before the async refetch completes)
    queryClient.setQueryData(['shoots'], (old = []) =>
      old.map(s => s.id === id ? { ...s, ...payload } : s)
    );
    await base44.entities.Shoot.update(id, payload);
    refresh();
    setSelectedShoot(prev => prev && prev.id === id ? { ...prev, ...payload } : prev);
  };

  const startEdit = (shoot) => {
    setEditingShoot(shoot);
    setForm({ ...emptyForm, ...shoot });
    setEditingShootForm(shoot);
    setSelectedShoot(null);
    setQuickViewShoot(null);
  };

  const handleDeleteShoot = async (id) => {
    if (isAnalytics) {
      const existing = shoots.find((s) => s.id === id);
      await submitCalendarChangeRequest({
        user,
        action: 'delete',
        shoot: existing,
        payload: {},
        summary: `Delete ${existing?.title || 'shoot'}`,
      });
      toast.success('Delete request sent to admins');
      setSelectedShoot(null);
      setQuickViewShoot(null);
      return;
    }
    await base44.entities.Shoot.delete(id);
    setSelectedShoot(null);
    setQuickViewShoot(null);
    refresh();
  };

  const handleAssignOperators = (shoot) => {
    if (!isAdmin) return;
    setAssignOperatorsModal(shoot);
  };

  const handleConfirmAssignOperator = async (email) => {
    if (!assignOperatorsModal?.id || !email || !isAdmin) return;
    const shoot = shoots.find((s) => s.id === assignOperatorsModal.id) || assignOperatorsModal;
    if (hasEmail(shoot.assigned_operators, email)) return;
    const current = getShootClaimEmail(shoot);
    if (current && current !== normalizeEmail(email)) {
      const currentName = getDisplayName(allUsers.find((u) => normalizeEmail(u.email) === current), current);
      if (!window.confirm(`Replace ${currentName} on this shoot?`)) return;
    }

    await handleShootUpdate(shoot.id, exclusiveAssignFields(email));

    // Admin auto-pair: find linked paired shoot and assign without limit check
    const autoAssignTeamsCfg = (() => {
      const raw = appSettings.find(s => s.key === 'auto_assign_teams')?.value;
      return raw ? JSON.parse(raw) : ['Reds', 'Red Sox', 'Rangers'];
    })();
    const autoAssignWindowCfg = (() => {
      const raw = appSettings.find(s => s.key === 'auto_assign_window_hours')?.value;
      return (raw ? Number(raw) : 2) * 60;
    })();

    const partner = findPairedShoot(shoot, shoots, autoAssignTeamsCfg, autoAssignWindowCfg, email);
    if (partner) {
      await handleShootUpdate(partner.id, exclusiveAssignFields(email, {
        auto_assigned_for: addEmail(partner.auto_assigned_for, email),
      }));
    }

    const updated = { ...shoot, ...exclusiveAssignFields(email) };
    setAssignOperatorsModal(updated);
  };

  const handleUnassignOperator = async (email, type) => {
    if (!assignOperatorsModal?.id) return;
    const shoot = assignOperatorsModal;

    // Remove from clicked shoot
    const updatedAssigned = removeEmail(shoot.assigned_operators, email);
    const updatedPending = removeEmail(shoot.pending_operators, email);
    const updatedPreApproved = removeEmail(shoot.pre_approved_operators, email);
    const updatedAutoAssigned = removeEmail(shoot.auto_assigned_for, email);

    await handleShootUpdate(shoot.id, {
      assigned_operators: updatedAssigned,
      pending_operators: updatedPending,
      pre_approved_operators: updatedPreApproved,
      auto_assigned_for: updatedAutoAssigned,
    });

    // Cascade to paired shoot
    const autoAssignTeamsCfg = (() => {
      const raw = appSettings.find(s => s.key === 'auto_assign_teams')?.value;
      return raw ? JSON.parse(raw) : ['Reds', 'Red Sox', 'Rangers'];
    })();
    const autoAssignWindowCfg = (() => {
      const raw = appSettings.find(s => s.key === 'auto_assign_window_hours')?.value;
      return (raw ? Number(raw) : 2) * 60;
    })();
    const paired = findPairedShootForUnassign(shoot, shoots, autoAssignTeamsCfg, autoAssignWindowCfg, email);
    if (paired) {
      await handleShootUpdate(paired.id, {
        assigned_operators: removeEmail(paired.assigned_operators, email),
        pending_operators: removeEmail(paired.pending_operators, email),
        pre_approved_operators: removeEmail(paired.pre_approved_operators, email),
        auto_assigned_for: removeEmail(paired.auto_assigned_for, email),
      });
    }

    const updated = { ...shoot, assigned_operators: updatedAssigned, pending_operators: updatedPending, pre_approved_operators: updatedPreApproved, auto_assigned_for: updatedAutoAssigned };
    setAssignOperatorsModal(updated);
  };

  const getAutoPairConfig = () => {
    const teamsRaw = appSettings.find(s => s.key === 'auto_assign_teams')?.value;
    const windowRaw = appSettings.find(s => s.key === 'auto_assign_window_hours')?.value;
    return {
      teams: teamsRaw ? JSON.parse(teamsRaw) : ['Reds', 'Red Sox', 'Rangers'],
      windowMinutes: (windowRaw ? Number(windowRaw) : 2) * 60,
    };
  };

  const syncShootViews = (shootId, patch) => {
    setSelectedShoot((prev) => (prev && prev.id === shootId ? { ...prev, ...patch } : prev));
    setQuickViewShoot((prev) => (prev && prev.id === shootId ? { ...prev, ...patch } : prev));
    setAssignOperatorsModal((prev) => (prev && prev.id === shootId ? { ...prev, ...patch } : prev));
  };

  /** Admin: approve a pending operator from calendar surfaces. */
  const handleApprovePending = async (shoot, email) => {
    if (!shoot?.id || !email || !hasEmail(shoot.pending_operators, email)) return;
    const patch = approvePendingFields(shoot, email);
    await handleShootUpdate(shoot.id, patch);
    syncShootViews(shoot.id, patch);

    const { teams, windowMinutes } = getAutoPairConfig();
    const partner = findPairedShootForUnassign(shoot, shoots, teams, windowMinutes, email)
      || findPairedShoot(shoot, shoots, teams, windowMinutes, email);
    if (partner && hasEmail(partner.pending_operators, email)) {
      const partnerPatch = approvePendingFields(partner, email);
      await handleShootUpdate(partner.id, partnerPatch);
    }
  };

  /** Admin: decline a pending operator from calendar surfaces. */
  const handleDeclinePending = async (shoot, email) => {
    if (!shoot?.id || !email || !hasEmail(shoot.pending_operators, email)) return;
    const patch = declinePendingFields(shoot, email);
    await handleShootUpdate(shoot.id, patch);
    syncShootViews(shoot.id, patch);

    const { teams, windowMinutes } = getAutoPairConfig();
    const partner = findPairedShootForUnassign(shoot, shoots, teams, windowMinutes, email);
    if (partner && hasEmail(partner.pending_operators, email)) {
      const partnerPatch = declinePendingFields(partner, email);
      await handleShootUpdate(partner.id, partnerPatch);
    }
  };

  // Context menu self-assign — same business rules as card self-assign
  const handleContextMenuAssignSelf = async (shoot) => {
    if (!user?.email) return;
    const email = user.email;
    const todayStrLocal = format(new Date(), 'yyyy-MM-dd');
    const isAssigned = hasEmail(shoot.assigned_operators, email);
    const isPendingCM = hasEmail(shoot.pending_operators, email);

    const cmWindowMins = (() => { const raw = appSettings.find(s => s.key === 'auto_assign_window_hours')?.value; return (raw ? Number(raw) : 2) * 60; })();
    const cmAutoTeams = (() => { const raw = appSettings.find(s => s.key === 'auto_assign_teams')?.value; return raw ? JSON.parse(raw) : ['Reds', 'Red Sox', 'Rangers']; })();

    if (isAssigned) {
      // Unassign: bidirectional cascade to paired shoot
      await handleShootUpdate(shoot.id, {
        assigned_operators: removeEmail(shoot.assigned_operators, email),
        pending_operators: removeEmail(shoot.pending_operators, email),
        pre_approved_operators: removeEmail(shoot.pre_approved_operators, email),
        auto_assigned_for: removeEmail(shoot.auto_assigned_for, email),
      });
      const paired = findPairedShootForUnassign(shoot, shoots, cmAutoTeams, cmWindowMins, email);
      if (paired) {
        await handleShootUpdate(paired.id, {
          assigned_operators: removeEmail(paired.assigned_operators, email),
          pending_operators: removeEmail(paired.pending_operators, email),
          pre_approved_operators: removeEmail(paired.pre_approved_operators, email),
          auto_assigned_for: removeEmail(paired.auto_assigned_for, email),
        });
      }
    } else if (isPendingCM) {
      await handleShootUpdate(shoot.id, {
        pending_operators: removeEmail(shoot.pending_operators, email),
        pre_approved_operators: removeEmail(shoot.pre_approved_operators, email),
      });
    } else if (isAdmin) {
      if (isClaimedByOtherOperator(shoot, email)) {
        const current = getShootClaimEmail(shoot);
        const currentName = getDisplayName(allUsers.find((u) => normalizeEmail(u.email) === current), current);
        if (!window.confirm(`${currentName} is already on this shoot. Take it over?`)) return;
      }
      await handleShootUpdate(shoot.id, exclusiveAssignFields(email));
      await createShootTimeEntry(shoot, email, user.full_name || email, `Shoot: ${shoot.title}`);
      const partner = findPairedShoot(shoot, shoots, cmAutoTeams, cmWindowMins, email);
      if (partner) {
        await handleShootUpdate(partner.id, exclusiveAssignFields(email, {
          auto_assigned_for: addEmail(partner.auto_assigned_for, email),
        }));
      }
    } else if (isClaimedByOtherOperator(shoot, email)) {
      return;
    } else {
      const freshShoots = queryClient.getQueryData(['shoots']) || shoots;
      const preCount = getPreApprovedCount(freshShoots, email, shoot.id, todayStrLocal);
      const withinLimit = preCount < AUTO_APPROVE_LIMIT;

      if (withinLimit) {
        await handleShootUpdate(shoot.id, exclusiveAssignFields(email, {
          pre_approved_operators: addEmail(shoot.pre_approved_operators, email),
        }));
      } else if (!hasEmail(shoot.pending_operators, email)) {
        await handleShootUpdate(shoot.id, exclusivePendingFields(email, {
          pre_approved_operators: removeEmail(shoot.pre_approved_operators, email),
        }));
      }

      const autoAssignTeamsCM = (() => { const raw = appSettings.find(s => s.key === 'auto_assign_teams')?.value; return raw ? JSON.parse(raw) : ['Reds', 'Red Sox', 'Rangers']; })();
      const autoAssignUsersCM = (() => { const raw = appSettings.find(s => s.key === 'auto_assign_users')?.value; return raw ? JSON.parse(raw) : []; })();
      const userEligibleCM = autoAssignUsersCM.length === 0 || autoAssignUsersCM.includes(email);
      if (userEligibleCM && autoAssignTeamsCM.length > 0) {
        const partner = findPairedShoot(shoot, shoots, autoAssignTeamsCM, cmWindowMins, email);
        if (partner) {
          const countAfterMain = withinLimit ? preCount + 1 : preCount;
          const partnerWithinLimit = countAfterMain < AUTO_APPROVE_LIMIT;
          if (partnerWithinLimit) {
            await handleShootUpdate(partner.id, exclusiveAssignFields(email, {
              pre_approved_operators: addEmail(partner.pre_approved_operators, email),
              auto_assigned_for: addEmail(partner.auto_assigned_for, email),
            }));
          } else {
            await handleShootUpdate(partner.id, exclusivePendingFields(email, {
              pre_approved_operators: removeEmail(partner.pre_approved_operators, email),
              auto_assigned_for: removeEmail(partner.auto_assigned_for, email),
            }));
          }
        }
      }
    }
  };

  const handleContextMenuUnassignSelf = handleContextMenuAssignSelf; // toggle behaviour is unified above

  const duplicateShoot = (shoot) => {
    if (!isAdmin || !shoot) return;
    const {
      id, created_date, updated_date, created_by,
      assigned_operators, pending_operators,
      // Strip all phase/rig-check state so duplicate starts fresh
      phase_status,
      rig_check_completed, rig_check_checked_from_calendar,
      rig_check_checked_by, rig_check_checked_by_name, rig_check_checked_at,
      rig_check_standby_date, rig_check_standby_admin_email, rig_check_standby_admin_name,
      rig_check_archived, rig_check_archived_at, rig_check_archived_by, rig_check_archived_by_name,
      ...copy
    } = shoot;
    setSelectedShoot(null);
    setQuickViewShoot(null);
    setContextMenu(null);
    const newTitle = `${shoot.title || 'Shoot'} Copy`;
    setForm({
      ...emptyForm,
      ...copy,
      title: newTitle,
      assigned_operators: [],
      pending_operators: [],
      status: 'upcoming',
      phase_status: {},
    });
    setEditingShoot(null);
    setEditingShootForm({});
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

  const handleContextMenu = (e, shoot) => {
    setContextMenu({ shoot });
  };

  const renderEntry = (shoot, day, compact = false) => (
    <ShootCalendarEntry
      key={shoot.id}
      shoot={shoot}
      day={day}
      user={user}
      isAdmin={isAdmin}
      isOperator={isOperator}
      isAnalytics={isAnalytics}
      allUsers={allUsers}
      allShoots={shoots}
      rigSettings={rigSettings}
      appSettings={appSettings}
      todayStr={todayStr}
      compact={compact}
      onUpdate={handleShootUpdate}
      onContextMenu={handleContextMenu}
      onQuickView={(s) => {
        setQuickViewShoot(s);
        setDayPopup(null);
      }}
      getStandbyCoverageForShoot={getStandbyCoverageForShoot}
      queryClient={queryClient}
    />
  );

  const openDayPopup = (day, e) => {
    e?.stopPropagation?.();
    setSelectedDate(day);
    setDayPopup(day);
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
    const startPadding = monthStart.getDay();
    const monthGridClass = 'grid grid-cols-7 gap-px min-w-[560px] md:min-w-[980px] xl:min-w-0 bg-slate-800/80';

    return (
      <CardContent className="p-2 md:p-3">
        <div className={`${monthGridClass} mb-0 rounded-t-lg overflow-hidden`}>
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
            <div key={d} className="text-center text-[11px] font-medium text-slate-500 py-2 bg-slate-900">{d}</div>
          ))}
        </div>
        <div className={`${monthGridClass} rounded-b-lg overflow-hidden`}>
          {Array(startPadding).fill(null).map((_, i) => <div key={`p${i}`} className="bg-slate-950/40 min-h-[72px] md:min-h-[120px]" />)}
          {calendarDays.map(day => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const isPast = dateStr < todayStr;
            const greyOutDay = isPast && !isStandby;
            const dayShoots = getShootsForDay(day);
            const visibleShoots = dayShoots.slice(0, MONTH_VISIBLE_SHOOTS);
            const hiddenCount = Math.max(0, dayShoots.length - MONTH_VISIBLE_SHOOTS);
            const primaryStandby = getPrimaryStandbyForDay(day);
            const myStandby = userStandbyForDay(day);
            const otherStandby = primaryStandby && primaryStandby.admin_email !== user?.email;
            const standbyColor = primaryStandby ? standbyColorForEmail(primaryStandby.admin_email) : EMPTY_STANDBY_COLOR;
            const dayUnavailable = getUnavailableForDay(day);
            const myUnavailable = getMyUnavailableForDay(day);
            const exactCalendarUnavailable = getMyExactCalendarUnavailableForDay(day);
            const isSelected = isSameDay(day, selectedDate);
            const today = isToday(day);
            return (
              <div
                key={day.toISOString()}
                onClick={() => { setSelectedDate(day); setCurrentDate(day); }}
                className={`min-h-[72px] md:min-h-[120px] h-full px-1 pt-1 pb-0.5 cursor-pointer transition-colors flex flex-col bg-slate-950 ${
                  isSelected ? 'bg-blue-950/35' : 'hover:bg-slate-900/90'
                } ${greyOutDay ? 'opacity-55' : ''}`}
              >
                <div className="flex items-center justify-between gap-0.5 mb-0.5 shrink-0 px-0.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (dayShoots.length > MONTH_VISIBLE_SHOOTS) openDayPopup(day, e);
                      else if (dayShoots.length > 0) {
                        setQuickViewShoot(dayShoots[0]);
                        setSelectedDate(day);
                      } else {
                        setSelectedDate(day);
                        setCurrentDate(day);
                      }
                    }}
                    className={`text-[11px] font-medium tabular-nums rounded-full min-w-[1.35rem] h-[1.35rem] flex items-center justify-center ${today ? 'bg-blue-600 text-white' : greyOutDay ? 'text-slate-600' : 'text-slate-300 hover:bg-slate-800'}`}
                    title={dayShoots.length > MONTH_VISIBLE_SHOOTS ? 'View all games for this day' : undefined}
                  >
                    {format(day, 'd')}
                  </button>
                  {(isAdmin || isStandby) && !isPast && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleToggleStandbyDay(day); }}
                      className={`inline-flex items-center rounded-full border px-1.5 py-px text-[9px] font-semibold leading-none transition-colors ${
                        primaryStandby ? standbyColor.button : EMPTY_STANDBY_COLOR.button
                      }`}
                      title={
                        myStandby
                          ? 'Remove yourself from standby (18:00–06:00)'
                          : otherStandby
                            ? 'Swap this 18:00–06:00 standby session to yourself'
                            : 'Assign yourself to standby 18:00–06:00'
                      }
                    >
                      {otherStandby ? 'Swap' : 'Standby'}
                    </button>
                  )}
                  {isOperator && !isPast && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); handleToggleUnavailableDay(day); }}
                      className={`inline-flex items-center rounded-full border px-1.5 py-px text-[9px] font-semibold leading-none transition-colors ${
                        myUnavailable
                          ? 'border-red-500/45 bg-red-950/40 text-red-300'
                          : 'border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800'
                      }`}
                      title={myUnavailable ? exactCalendarUnavailable ? 'Remove your unavailable mark for this day' : 'You are marked unavailable from an availability range' : 'Mark yourself unavailable for this day'}
                    >
                      <UserX className="h-2.5 w-2.5 mr-0.5" />
                      Out
                    </button>
                  )}
                </div>
                {primaryStandby && (
                   <div className="mb-0.5 px-0.5 shrink-0">
                     <span
                       className={`text-[9px] rounded border px-1 py-px truncate max-w-full inline-block ${standbyColor.chip}`}
                       title="Covered shoots are highlighted in this colour"
                     >
                       Standby: {primaryStandby.admin_name || primaryStandby.admin_email}
                     </span>
                   </div>
                 )}
                {isAdmin && dayUnavailable.length > 0 && (
                  <div className="mb-0.5 flex flex-wrap gap-0.5 px-0.5 shrink-0">
                    {dayUnavailable.slice(0, 1).map(item => {
                      const unavailableUser = allUsers.find(u => u.email === item.operator_email);
                      return (
                        <span key={item.id} className="text-[9px] rounded bg-red-950/45 text-red-200 px-1 py-px truncate max-w-full">
                          Out: {getDisplayName(unavailableUser, item.operator_email, item.operator_name).split(' ')[0]}
                        </span>
                      );
                    })}
                    {dayUnavailable.length > 1 && <span className="text-[9px] text-red-400">+{dayUnavailable.length - 1}</span>}
                  </div>
                )}
                <div className="space-y-px flex-1 min-h-0">
                  {visibleShoots.map(s => renderEntry(s, day, true))}
                  {hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={(e) => openDayPopup(day, e)}
                      className="w-full text-left rounded px-0.5 py-0.5 text-[11px] font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors shrink-0"
                    >
                      {hiddenCount} more
                    </button>
                  )}
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
            const dayStandbyPeople = getStandbyForDay(day);
            const primaryStandby = dayStandbyPeople[0] || null;
            const myStandby = userStandbyForDay(day);
            const otherStandby = primaryStandby && primaryStandby.admin_email !== user?.email;
            const standbyColor = primaryStandby ? standbyColorForEmail(primaryStandby.admin_email) : EMPTY_STANDBY_COLOR;
            const dayUnavailable = getUnavailableForDay(day);
            const myUnavailable = getMyUnavailableForDay(day);
            const exactCalendarUnavailable = getMyExactCalendarUnavailableForDay(day);
            const dateStr = format(day, 'yyyy-MM-dd');
            const isPast = dateStr < todayStr;

            return (
              <div key={day.toISOString()} className={`rounded-xl border ${isToday(day) ? 'border-blue-500/60 bg-blue-950/40' : 'border-slate-800 bg-slate-800/40'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{format(day, 'EEEE, MMMM d')}</p>
                    <p className="text-xs text-slate-500">{dayShoots.length} shoot{dayShoots.length === 1 ? '' : 's'} scheduled{isAdmin && dayUnavailable.length > 0 ? ` · ${dayUnavailable.length} unavailable` : ''}</p>
                    {dayStandbyPeople.length > 0 && (
                      <p className="text-[11px] mt-1 text-slate-400">
                        Standby:{' '}
                        {dayStandbyPeople.map((person, index) => (
                          <span key={person.id || person.admin_email} className={standbyColorForEmail(person.admin_email).text}>
                            {index > 0 ? ' · ' : ''}
                            {person.admin_name || person.admin_email}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {dayStandbyPeople.map((person) => (
                       <span key={person.id || person.admin_email} className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${standbyColorForEmail(person.admin_email).chip}`}>
                         <ShieldCheck className="h-3 w-3" /> {person.admin_name || person.admin_email}
                       </span>
                     ))}
                    {isAdmin && dayUnavailable.slice(0, 4).map(item => {
                      const unavailableUser = allUsers.find(u => u.email === item.operator_email);
                      return (
                        <span key={item.id} className="inline-flex items-center gap-1 rounded-full bg-red-950/45 border border-red-700/45 text-red-200 px-2 py-1 text-xs">
                          <UserX className="h-3 w-3" /> {getDisplayName(unavailableUser, item.operator_email, item.operator_name)}
                        </span>
                      );
                    })}
                    {isAdmin && dayUnavailable.length > 4 && <span className="text-xs text-red-400">+{dayUnavailable.length - 4} unavailable</span>}
                    {(isAdmin || isStandby) && !isPast && (
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={() => handleToggleStandbyDay(day)}
                         className={`h-8 rounded-md border text-xs ${
                           primaryStandby ? standbyColor.button : EMPTY_STANDBY_COLOR.button
                         }`}
                       >
                         <ShieldCheck className="h-3.5 w-3.5 mr-1" />
                         {myStandby ? 'Standby' : otherStandby ? 'Swap' : 'Standby'}
                       </Button>
                     )}
                    {isOperator && !isPast && (
                       <Button
                         size="sm"
                         variant="outline"
                         onClick={() => handleToggleUnavailableDay(day)}
                         className={`h-8 rounded-md text-xs ${
                           myUnavailable
                             ? 'border-red-500/45 bg-red-950/30 text-red-300 hover:bg-red-950/50'
                             : 'border-slate-600 bg-slate-800/70 text-slate-200 hover:bg-slate-800 hover:text-white'
                         }`}
                         title={myUnavailable && !exactCalendarUnavailable ? 'You are marked unavailable from an availability range' : undefined}
                       >
                         <UserX className="h-3.5 w-3.5 mr-1" />
                         {myUnavailable ? 'Available' : 'Not available'}
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
                    <p className="text-sm text-slate-500 py-3">Nothing scheduled for this day.</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    );
  };

  return (
    <div className="min-h-screen bg-slate-800 text-slate-100 p-3 md:p-5 overflow-x-hidden">
      <div className="w-full max-w-[1800px] mx-auto">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">Calendar</h1>
            <p className="text-sm text-slate-500 mt-1">
              {isAnalytics
                ? 'View the full calendar and standby coverage. Request edits from a shoot — assignments stay with operators.'
                : 'Calendar is the main view. Operators can mark full-day unavailability here; admins see those indicators.'}
            </p>
            {canSyncCalendar && (
              <p className="text-xs text-slate-500 mt-1">Google Data + Fancam auto-sync at 06:00, 13:00 and 20:00 SAST. Slack is a fail-safe if Google is down.</p>
            )}
            {canSyncCalendar && googleStatus?.lastSyncAt && (
              <div className="mt-1">
                <p className="text-xs text-slate-500">
                  Last Google sync:{' '}
                  {new Date(googleStatus.lastSyncAt).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })} SAST
                  {googleStatus.lastSyncStats
                    ? ` · ${googleStatus.lastSyncStats.created || 0} new, ${googleStatus.lastSyncStats.updated || 0} updated, ${googleStatus.lastSyncStats.cancelled || 0} cancelled`
                    : ''}
                </p>
                {(googleStatus.lastSyncChanges || []).length > 0 && (
                  <details className="mt-1">
                    <summary className="text-xs text-blue-300 cursor-pointer">What changed</summary>
                    <ul className="mt-1 space-y-0.5 max-h-28 overflow-y-auto">
                      {googleStatus.lastSyncChanges.slice(0, 12).map((item, index) => (
                        <li key={`${item.title}-${index}`} className="text-[11px] text-slate-400">
                          {item.calendar || 'Google'} · {item.action} · {item.title}
                          {item.date ? ` · ${item.date}${item.time ? ` ${item.time}` : ''}` : ''}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <ViewToggle viewMode={viewMode} setViewMode={setViewMode} />
            {canSyncCalendar && (
              <>
                {googleStatus?.connected ? (
                  <Button
                    onClick={handleGoogleSync}
                    disabled={googleSyncing}
                    variant="outline"
                    className="border-slate-700 text-slate-200 hover:bg-slate-800"
                    size="sm"
                    title={googleStatus.lastSyncAt
                      ? `Last sync ${new Date(googleStatus.lastSyncAt).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })} SAST`
                      : 'Pull Data and Fancam from Google (South Africa time). Google is not changed.'}
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${googleSyncing ? 'animate-spin' : ''}`} />
                    {googleSyncing ? 'Syncing…' : 'Sync calendars'}
                  </Button>
                ) : (
                  <Button asChild variant="outline" className="border-slate-700 text-slate-200 hover:bg-slate-800" size="sm">
                    <Link to="/Settings">
                      <RefreshCw className="h-4 w-4 mr-1" />
                      {isAdmin
                        ? (googleStatus?.configured ? 'Connect Google' : 'Set up Google sync')
                        : 'Google not connected'}
                    </Link>
                  </Button>
                )}
                <div className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900/70 px-2 py-1">
                  <SlackSyncToggle enabled={!!slackStatus?.enabled} compact />
                </div>
                {slackStatus?.enabled && (
                  <Button
                    onClick={handleSlackSync}
                    disabled={slackSyncing || googleSyncing}
                    variant="outline"
                    className="border-slate-700 text-slate-200 hover:bg-slate-800"
                    size="sm"
                    title={slackStatus?.configured
                      ? 'Pull the latest Gameday Bot schedule from Slack. Paste a single game in Settings if you only need one update.'
                      : 'Connect the Gameday Slack channel in Settings first.'}
                  >
                    <MessageSquare className={`h-4 w-4 mr-1 ${slackSyncing ? 'animate-pulse' : ''}`} />
                    {slackSyncing ? 'Slack sync…' : 'Sync from Slack'}
                  </Button>
                )}
              </>
            )}
            {isAdmin && (
              <>
                <Button onClick={() => { setEditingShoot(null); setForm({ ...emptyForm, date: format(selectedDate, 'yyyy-MM-dd') }); setEditingShootForm({}); }} className="bg-blue-600 hover:bg-blue-500 text-white" size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Add Shoot
                </Button>
                <Button onClick={() => setShowCSV(true)} variant="outline" className="border-slate-800 text-slate-400 hover:bg-slate-800" size="sm">
                  <Upload className="h-4 w-4 mr-1" /> Import CSV
                </Button>
              </>
            )}
            {isAnalytics && (
              <Button onClick={() => { setEditingShoot(null); setForm({ ...emptyForm, date: format(selectedDate, 'yyyy-MM-dd') }); setEditingShootForm({}); }} className="bg-blue-600 hover:bg-blue-500 text-white" size="sm">
                <Plus className="h-4 w-4 mr-1" /> Request shoot
              </Button>
            )}
          </div>
        </div>

        <div>
          <Card className="bg-slate-900 border-slate-800 mb-4 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-800 gap-3">
              <Button variant="ghost" size="icon" onClick={goPrevious} className="text-slate-400 hover:text-slate-100 hover:bg-slate-800 flex-shrink-0">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="text-center min-w-0">
                <CardTitle className="text-slate-100 text-xl truncate">{titleText}</CardTitle>
                <button
                  type="button"
                  onClick={() => { const now = new Date(); setCurrentDate(now); setSelectedDate(now); }}
                  className="text-xs text-blue-400 hover:text-blue-400 mt-1"
                >
                  Jump to today
                </button>
              </div>
              <Button variant="ghost" size="icon" onClick={goNext} className="text-slate-400 hover:text-slate-100 hover:bg-slate-800 flex-shrink-0">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </CardHeader>
            <div className="overflow-x-auto">
              {viewMode === 'month' && renderMonthView()}
              {viewMode === 'week' && renderWeekView()}
            </div>
          </Card>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 mb-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Legend</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
              {[
                { label: 'Upcoming', color: 'bg-blue-600' },
                { label: 'Completed', color: 'bg-gray-600' },
                { label: 'Cancelled', color: 'bg-red-600' },
                { label: 'Postponed', color: 'bg-amber-500' },
                { label: 'Fancam', color: 'bg-orange-500' },
                { label: 'Data', color: 'bg-sky-500' },
                { label: 'Pending', color: 'bg-yellow-400' },
                { label: 'My Assigned Shoot', color: 'bg-purple-500' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full ${l.color}`} />
                  <span className="text-xs text-slate-400">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Rig check message moved to side panel below */}


        </div>
      </div>

      {/* Rig Check Slack Message — Sheet panel */}
      <Sheet open={showRigCheckPanel && rigCheckMessageShoots.length > 0} onOpenChange={setShowRigCheckPanel}>
        <SheetContent side="right" className="w-full bg-slate-900 border-l border-slate-800 p-0 [&_button[type='button']]:text-slate-400 overflow-y-auto transition-all duration-300">
          <SheetHeader className="px-4 py-3 border-b border-slate-800 flex-shrink-0">
            <SheetTitle className="flex items-center gap-2 text-slate-100">
              <Wrench className={`h-4 w-4 flex-shrink-0 ${rigCheckCopied ? 'text-emerald-400' : 'text-amber-400'}`} />
              Rig Check Message
              <span className="text-xs bg-yellow-500/20 text-amber-400 border border-yellow-500/30 rounded-full px-1.5 py-0.5">{rigCheckMessageShoots.length}</span>
            </SheetTitle>
          </SheetHeader>
          <div className="flex gap-2 px-4 py-3 border-b border-slate-800 flex-shrink-0">
            <Button size="sm" onClick={handleCopyRigCheckMessage} className={`flex-1 text-xs h-8 ${rigCheckCopied ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-500'}`}>
              {rigCheckCopied ? <><Check className="h-3.5 w-3.5 mr-1" />Copied!</> : <><Copy className="h-3.5 w-3.5 mr-1" />Copy to Clipboard</>}
            </Button>
            <Button size="sm" variant="outline" onClick={handleArchiveRigCheckMessageShoots} className="border-slate-800 text-slate-400 hover:bg-slate-800 text-xs h-8">
              Archive All
            </Button>
          </div>
          <div className="p-4 space-y-4">
            <pre className="whitespace-pre-wrap rounded-lg bg-slate-800 border border-slate-800 p-3 text-xs text-gray-200 font-sans">{rigCheckSlackMessage}</pre>
            <div className="space-y-1.5">
              <p className="text-xs text-slate-500 uppercase tracking-wider">Checked Shoots</p>
              {rigCheckMessageShoots.map((shoot) => {
                const rig = findMatchingRig(shoot, rigSettings);
                const teamName = getShootTeamName(shoot);
                const label = getRigTypeLabel(shoot, rig) || 'Data';
                return (
                  <div key={shoot.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-800/70 px-2.5 py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <Wrench className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0" />
                      <span className="text-xs text-slate-400 truncate">{teamName} - {label}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRigCheckCancel(shoot)}
                      className="text-red-400 hover:text-red-400 flex-shrink-0"
                      title="Cancel rig check"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <CSVImportModal open={showCSV} onClose={() => setShowCSV(false)} onImported={refresh} />

      <DayEventsPopup
        open={!!dayPopup}
        day={dayPopup}
        shoots={dayPopup ? getShootsForDay(dayPopup) : []}
        user={user}
        isAdmin={isAdmin}
        isAnalytics={isAnalytics}
        allUsers={allUsers}
        rigSettings={rigSettings}
        getStandbyCoverageForShoot={getStandbyCoverageForShoot}
        onClose={() => setDayPopup(null)}
        onToggleAssign={handleContextMenuAssignSelf}
        onSelectShoot={(shoot) => {
          setQuickViewShoot(shoot);
          setDayPopup(null);
        }}
      />

      {quickViewShoot && (() => {
        const liveQuick = shoots.find((s) => s.id === quickViewShoot.id) || quickViewShoot;
        const coverage = getStandbyCoverageForShoot(liveQuick);
        const isMyCoverage = coverage?.admin_email === user?.email;
        const rigCheckUsersRaw = appSettings.find((s) => s.key === 'rig_check_users')?.value;
        const rigCheckUsers = rigCheckUsersRaw ? JSON.parse(rigCheckUsersRaw) : [];
        const isPermittedRigChecker = user?.email && rigCheckUsers.includes(user.email);
        const canCheckRig = !((liveQuick.date || '') < todayStr) && (
          (!!coverage && (isAdmin || isStandby) && isMyCoverage) || isPermittedRigChecker
        );
        return (
          <ShootQuickView
            shoot={liveQuick}
            user={user}
            isAdmin={isAdmin}
            isStandby={isStandby}
            isAnalytics={isAnalytics}
            allUsers={allUsers}
            rigSettings={rigSettings}
            canCheckRig={canCheckRig}
            onClose={() => setQuickViewShoot(null)}
            onUpdate={handleShootUpdate}
            onApprovePending={handleApprovePending}
            onDeclinePending={handleDeclinePending}
            onEdit={startEdit}
            onDuplicate={duplicateShoot}
            onDelete={handleDeleteShoot}
            onAssignOperators={(shoot) => {
              handleAssignOperators(shoot);
            }}
            onRigCheckToggle={() => handleRigCheckToggle(liveQuick, coverage || null)}
          />
        );
      })()}

      {contextMenu && (
        <CalendarContextMenu
          shoot={contextMenu.shoot}
          isAdmin={isAdmin}
          isAnalytics={isAnalytics}
          isStandby={isStandby}
          userEmail={user?.email}
          allUsers={allUsers}
          onEdit={(shoot) => { startEdit(shoot); setContextMenu(null); }}
          onDuplicate={duplicateShoot}
          onDelete={handleDeleteShoot}
          onAssignOperators={handleAssignOperators}
          onAssignSelf={handleContextMenuAssignSelf}
          onUnassignSelf={handleContextMenuUnassignSelf}
          onViewDetails={(shoot) => { setSelectedShoot(shoot); setSelectedDate(new Date(shoot.date + 'T12:00:00')); setContextMenu(null); }}
          onClose={() => setContextMenu(null)}
        />
      )}

      {liveSelectedShoot && (
        <ShootSidePanel
          shoot={liveSelectedShoot}
          user={user}
          isAdmin={isAdmin}
          isStandby={isStandby}
          isOperator={isOperator}
          rigSettings={rigSettings}
          allUsers={allUsers}
          allShoots={shoots}
          appSettings={appSettings}
          onUpdate={handleShootUpdate}
          onApprovePending={handleApprovePending}
          onDeclinePending={handleDeclinePending}
          onEdit={startEdit}
          onDuplicate={duplicateShoot}
          onDelete={handleDeleteShoot}
          onClose={() => setSelectedShoot(null)}
          queryClient={queryClient}
        />
      )}

      {editingShootForm && (
        <ShootEditPanel
          shoot={editingShoot}
          form={form}
          setForm={setForm}
          onSave={handleAddShoot}
          onCancel={() => {
            setEditingShootForm(null);
            setEditingShoot(null);
            setForm(emptyForm);
          }}
          onClose={() => {
            setEditingShootForm(null);
            setEditingShoot(null);
            setForm(emptyForm);
          }}
        />
      )}

      {assignOperatorsModal && (
        <AssignOperatorModal
          shoot={shoots.find((s) => s.id === assignOperatorsModal.id) || assignOperatorsModal}
          allUsers={allUsers}
          pendingUsers={pendingUsers}
          onConfirm={handleConfirmAssignOperator}
          onUnassign={handleUnassignOperator}
          onApprove={(email) => handleApprovePending(shoots.find((s) => s.id === assignOperatorsModal.id) || assignOperatorsModal, email)}
          onDecline={(email) => handleDeclinePending(shoots.find((s) => s.id === assignOperatorsModal.id) || assignOperatorsModal, email)}
          onClose={() => setAssignOperatorsModal(null)}
        />
      )}
    </div>
  );
}