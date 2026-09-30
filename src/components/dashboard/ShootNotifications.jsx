import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { X, Calendar, CheckCheck, AlertTriangle, Bell } from 'lucide-react';
import { format } from 'date-fns';
import { formatDateZA, formatTimeZA } from '@/utils/shootStatus';
import { formatTimezoneAbbr, getDisplayTimeZone } from '@/utils/timezone';
import { cn } from '@/lib/utils';

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
const NotificationCtx = createContext(null);

function getSetupTime(shoot) {
  if (!shoot.game_time) return null;

  const [h, m] = shoot.game_time.split(':').map(Number);
  const gameMinutes = h * 60 + m;
  const offsetMinutes = shoot.setup_offset ?? -150;
  const setupMinutes = gameMinutes + offsetMinutes;

  const d = new Date(shoot.date + 'T00:00:00');
  d.setMinutes(setupMinutes);
  return d;
}

function safeDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isExpired(notification) {
  const expires = safeDate(notification.expires_at);
  if (expires) return expires.getTime() < Date.now();

  const created = safeDate(notification.created_at || notification.created_date);
  if (!created) return false;

  return Date.now() - created.getTime() > FIVE_DAYS_MS;
}

const ANALYTICS_NOTIFICATION_TYPES = new Set([
  'calendar_request',
  'google_sync',
  'schedule_change',
  'cancelled',
]);

function userCanSeeNotification(notification, user) {
  const email = (user?.email || '').toLowerCase();
  if (!email) return false;

  const dismissedBy = notification.dismissed_by || [];
  if (dismissedBy.map((e) => String(e).toLowerCase()).includes(email)) return false;

  const targetEmail = (notification.target_user_email || '').toLowerCase();

  if (user?.role === 'analytics') {
    if (!ANALYTICS_NOTIFICATION_TYPES.has(notification.type)) return false;
    if (notification.type === 'calendar_request') return targetEmail === email;
    if (targetEmail && targetEmail !== email) return false;
    return true;
  }

  if (targetEmail && targetEmail === email) return true;

  if (notification.target_role === 'admin_standby') {
    return user?.role === 'admin' || user?.standby === true;
  }

  if (notification.target_role && notification.target_role === user?.role) {
    return true;
  }

  return false;
}

function playNotificationSound() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(1175, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.07, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.38);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.4);
    ctx.resume?.();
  } catch {
    // Autoplay can be blocked until the user interacts with the page.
  }
}

const urgencyStyles = {
  urgent: 'border-blue-500/40 bg-[#080e1d]/95',
  today: 'border-[color:var(--rom-line)] bg-[#080e1d]/95',
  tomorrow: 'border-[color:var(--rom-line)] bg-[#080e1d]/95',
  change: 'border-blue-500/30 bg-[#080e1d]/95',
};

const urgencyLabel = {
  urgent: 'Setup soon',
  today: 'Today',
  tomorrow: 'Tomorrow',
  change: 'Update',
};

function storedTypeLabel(type) {
  switch (type) {
    case 'standby':
      return 'Standby';
    case 'schedule_change':
      return 'Time change';
    case 'needs_start':
    case 'start_overdue':
      return 'Needs to start';
    case 'starting_soon':
      return 'Starting soon';
    case 'pre_shoot_started':
      return 'Pre-shoot started';
    case 'cancelled':
      return 'Cancelled';
    case 'assigned':
    case 'approved':
    case 'unassigned':
    case 'operator_action':
      return 'Assignment';
    case 'availability':
    case 'availability_digest':
      return 'Availability';
    case 'day_of':
      return 'Shoot today';
    case 'google_sync':
      return 'Google sync';
    case 'calendar_request':
      return 'Calendar request';
    case 'app_fault':
      return 'App fault';
    default:
      return urgencyLabel.change;
  }
}

function scheduleLines(notification) {
  if (!notification) return null;
  const fromDate = notification.previous_date;
  const fromTime = notification.previous_time;
  const toDate = notification.new_date || notification.shoot_date;
  const toTime = notification.new_time || notification.shoot_time;
  if (!fromDate && !fromTime && notification.type !== 'schedule_change') return null;
  if (notification.type !== 'schedule_change' && !fromDate && !fromTime) return null;
  return {
    was: `${fromDate ? formatDateZA(fromDate, { time: fromTime }) : '—'} · ${fromTime ? formatTimeZA(fromTime, fromDate) : '—'} ${formatTimezoneAbbr(getDisplayTimeZone())}`,
    now: `${toDate ? formatDateZA(toDate, { time: toTime }) : '—'} · ${toTime ? formatTimeZA(toTime, toDate) : '—'} ${formatTimezoneAbbr(getDisplayTimeZone())}`,
  };
}

function NotificationBody({ item }) {
  if (item.kind === 'stored') {
    const notification = item.notification;
    const heading = notification.type === 'schedule_change'
      ? (notification.shoot_title || notification.title || 'Shoot updated')
      : (notification.title || notification.shoot_title || 'Notification');
    const change = scheduleLines(notification);

    return (
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          {notification.type === 'standby' ? (
            <Bell className="h-3.5 w-3.5 text-blue-300" />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 text-blue-300" />
          )}
          <span className="text-[11px] font-medium uppercase tracking-wide text-blue-300">
            {storedTypeLabel(notification.type)}
          </span>
        </div>

        <p className="text-sm font-semibold text-slate-50 truncate">{heading}</p>

        {change ? (
          <div className="mt-1.5 rounded-md bg-black/20 px-2 py-1.5 text-xs leading-relaxed text-slate-100">
            <p><span className="text-slate-400">Was</span> {change.was}</p>
            <p><span className="text-slate-400">Now</span> {change.now}</p>
          </div>
        ) : notification.message ? (
          <p className="mt-1 whitespace-pre-wrap text-xs text-slate-200 leading-relaxed">
            {notification.message}
          </p>
        ) : null}

        {!change && (notification.shoot_date || notification.shoot_time) && (
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-300">
            <Calendar className="h-3 w-3" />
            {notification.shoot_date ? <span>{formatDateZA(notification.shoot_date, { time: notification.shoot_time })}</span> : null}
            {notification.shoot_time && <span>· {formatTimeZA(notification.shoot_time, notification.shoot_date)} {formatTimezoneAbbr(getDisplayTimeZone())}</span>}
          </div>
        )}

        {notification.created_by_name && (
          <p className="text-[11px] text-slate-400 mt-1">
            Changed by {notification.created_by_name}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-[11px] font-medium uppercase tracking-wide text-slate-200">
          {urgencyLabel[item.urgency]}
        </span>
      </div>
      <p className="text-sm font-semibold text-slate-50 truncate">{item.shoot.title}</p>
      <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-200">
        <Calendar className="h-3 w-3" />
        <span>{formatDateZA(item.shoot.date, { time: item.shoot.game_time })}</span>
        {item.shoot.game_time && <span>· {formatTimeZA(item.shoot.game_time, item.shoot.date)} {formatTimezoneAbbr(getDisplayTimeZone())}</span>}
      </div>
      <p className="text-xs text-slate-200 mt-0.5">
        Setup: {format(item.setupTime, 'HH:mm')}
        {item.urgency === 'urgent' && ` (in ${Math.round(item.hoursUntilSetup * 10) / 10}h)`}
      </p>
    </div>
  );
}

function useNotificationState(shoots, user, notifyHours) {
  const [storedNotifications, setStoredNotifications] = useState([]);
  const [dismissedReminders, setDismissedReminders] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dismissed_notifs') || '[]');
    } catch {
      return [];
    }
  });
  const announcedRef = useRef(new Set());
  const primedRef = useRef(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(tick);
  }, []);

  const refreshStoredNotifications = async () => {
    if (!user?.email) return;

    try {
      const records = await base44.entities.ShootNotification.list('-created_at', 500);
      const activeRecords = (records || [])
        .filter((notification) => !isExpired(notification))
        .filter((notification) => userCanSeeNotification(notification, user));

      setStoredNotifications(activeRecords);
    } catch (error) {
      console.warn('Could not load ShootNotification records:', error);
      setStoredNotifications([]);
    }
  };

  useEffect(() => {
    refreshStoredNotifications();

    let unsubscribe;
    try {
      unsubscribe = base44.entities.ShootNotification.subscribe(() => {
        refreshStoredNotifications();
      });
    } catch {
      // subscribe is optional
    }

    return () => {
      unsubscribe?.();
    };
  }, [user?.email, user?.role, user?.standby]);

  const myAssigned = useMemo(() => {
    return shoots.filter((shoot) =>
      shoot.assigned_operators?.includes(user?.email) &&
      shoot.status !== 'cancelled' &&
      shoot.status !== 'completed'
    );
  }, [shoots, user?.email]);

  const reminderNotifications = useMemo(() => {
    return myAssigned.map((shoot) => {
      const setupTime = getSetupTime(shoot);
      if (!setupTime) return null;

      const msUntilSetup = setupTime - now;
      const hoursUntilSetup = msUntilSetup / 3600000;
      const isUpcoming = hoursUntilSetup > 0 && hoursUntilSetup <= notifyHours;
      const isToday = shoot.date === format(now, 'yyyy-MM-dd');

      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const isTomorrow = shoot.date === format(tomorrow, 'yyyy-MM-dd');

      if (!isUpcoming && !isToday && !isTomorrow) return null;

      const key = `shoot_${shoot.id}`;
      const urgency = isUpcoming ? 'urgent' : isToday ? 'today' : 'tomorrow';

      return {
        key,
        kind: 'reminder',
        shoot,
        setupTime,
        hoursUntilSetup,
        urgency,
      };
    }).filter(Boolean);
  }, [myAssigned, notifyHours, now]);

  const activeReminders = reminderNotifications.filter((n) => !dismissedReminders.includes(n.key));

  const activeStored = storedNotifications.map((notification) => ({
    key: `stored_${notification.id}`,
    kind: 'stored',
    notification,
    urgency: 'change',
  }));

  const active = [...activeStored, ...activeReminders];
  const activeKey = active.map((item) => item.key).join('|');

  useEffect(() => {
    const keys = activeKey ? activeKey.split('|') : [];
    if (!primedRef.current) {
      keys.forEach((key) => announcedRef.current.add(key));
      primedRef.current = true;
      return;
    }
    const fresh = keys.filter((key) => !announcedRef.current.has(key));
    if (fresh.length > 0) {
      playNotificationSound();
      fresh.forEach((key) => announcedRef.current.add(key));
    }
  }, [activeKey]);

  const dismissReminder = (key) => {
    const next = [...dismissedReminders, key];
    setDismissedReminders(next);
    localStorage.setItem('dismissed_notifs', JSON.stringify(next));
  };

  const dismissStored = async (notification) => {
    if (!user?.email) return;

    const current = notification.dismissed_by || [];
    const nextDismissedBy = [...new Set([...current, user.email])];

    await base44.entities.ShootNotification.update(notification.id, {
      dismissed_by: nextDismissedBy,
    });

    setStoredNotifications((prev) => prev.filter((item) => item.id !== notification.id));
  };

  const dismiss = async (item) => {
    if (item.kind === 'stored') {
      await dismissStored(item.notification);
    } else {
      dismissReminder(item.key);
    }
  };

  const dismissAll = async () => {
    const stored = active.filter((item) => item.kind === 'stored');
    const reminders = active.filter((item) => item.kind === 'reminder');

    await Promise.all(stored.map((item) => dismissStored(item.notification)));

    if (reminders.length > 0) {
      const keys = reminders.map((n) => n.key);
      const next = [...new Set([...dismissedReminders, ...keys])];
      setDismissedReminders(next);
      localStorage.setItem('dismissed_notifs', JSON.stringify(next));
    }
  };

  return { active, dismiss, dismissAll };
}

export function NotificationProvider({ shoots = [], user, notifyHours = 5, enabled = true, children }) {
  const value = useNotificationState(enabled ? shoots : [], enabled ? user : null, notifyHours);
  return (
    <NotificationCtx.Provider value={value}>
      {children}
    </NotificationCtx.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationCtx);
}

export function NotificationPopups() {
  const ctx = useNotifications();
  if (!ctx) return null;
  const { active, dismiss, dismissAll } = ctx;
  const popups = active.slice(0, 3);
  if (popups.length === 0) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[70] pointer-events-none px-3 pt-[calc(3.75rem+env(safe-area-inset-top))] md:pt-3"
      role="region"
      aria-label="Notification popups"
    >
      <div className="mx-auto w-full max-w-xl space-y-2 pointer-events-auto">
        {active.length > 1 && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={dismissAll}
              className="inline-flex items-center gap-1 rounded-full border border-slate-700/80 bg-slate-950/90 px-2.5 py-1 text-[11px] text-slate-300 hover:text-white"
            >
              <CheckCheck className="h-3.5 w-3.5" /> Clear all
            </button>
          </div>
        )}

        {popups.map((item) => (
          <div
            key={item.key}
            className={cn(
              'rounded-xl border px-3 py-2.5 shadow-2xl shadow-black/40 backdrop-blur-md',
              urgencyStyles[item.urgency] || urgencyStyles.change
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <NotificationBody item={item} />
              <button
                type="button"
                onClick={() => dismiss(item)}
                className="text-slate-300 hover:text-white flex-shrink-0 rounded-md p-0.5"
                aria-label="Clear notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

        {active.length > 3 && (
          <p className="text-center text-[11px] text-slate-400">
            +{active.length - 3} more in Notifications
          </p>
        )}
      </div>
    </div>
  );
}

export function NotificationInbox({ collapsed = false, className = '', drop = 'up' }) {
  const ctx = useNotifications();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  if (!ctx) return null;
  const { active, dismiss, dismissAll } = ctx;
  const count = active.length;

  return (
    <div className={cn('relative', className)} ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'relative w-full flex items-center rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors',
          collapsed ? 'justify-center px-2 py-2' : 'justify-between px-3 py-2'
        )}
        title="Notifications"
        aria-label="Notifications"
      >
        <span className={cn('flex items-center gap-2 text-sm', collapsed && 'justify-center')}>
          <Bell className="h-4 w-4" />
          {!collapsed && <span>Notifications</span>}
        </span>
        {count > 0 && (
          <span className={cn(
            'bg-red-600 text-white text-[10px] font-bold rounded-full min-w-[1.15rem] h-[1.15rem] px-1 flex items-center justify-center',
            collapsed && 'absolute -top-0.5 -right-0.5'
          )}>
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className={cn(
          'absolute bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden min-w-[18rem]',
          drop === 'down' ? 'top-full right-0 mt-1' : 'bottom-full left-0 mb-1 w-[18rem]'
        )}>
          <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
            <span className="text-xs font-semibold text-slate-100">Notifications</span>
            {active.length > 0 && (
              <button
                type="button"
                onClick={dismissAll}
                className="text-[11px] text-slate-400 hover:text-slate-100 flex items-center gap-1"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Clear all
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {active.length === 0 ? (
              <p className="p-4 text-center text-xs text-slate-500">No unread notifications</p>
            ) : (
              active.map((item) => (
                <div key={item.key} className="border-b border-slate-800 last:border-0 px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <NotificationBody item={item} />
                    <button
                      type="button"
                      onClick={() => dismiss(item)}
                      className="text-slate-500 hover:text-slate-200 flex-shrink-0"
                      aria-label="Clear notification"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          <Link
            to="/Notifications"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-center text-[11px] text-blue-300 hover:text-blue-100 border-t border-slate-800"
          >
            Open notification log
          </Link>
        </div>
      )}
    </div>
  );
}

/** @deprecated Use NotificationProvider + NotificationPopups + NotificationInbox */
export default function ShootNotifications(props) {
  return (
    <NotificationProvider {...props}>
      <NotificationPopups />
    </NotificationProvider>
  );
}
