import React, { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { X, Calendar, CheckCheck, AlertTriangle, Bell } from 'lucide-react';
import { format } from 'date-fns';

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

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

function userCanSeeNotification(notification, user) {
  const email = (user?.email || '').toLowerCase();
  if (!email) return false;

  const dismissedBy = notification.dismissed_by || [];
  if (dismissedBy.map((e) => String(e).toLowerCase()).includes(email)) return false;

  const targetEmail = (notification.target_user_email || '').toLowerCase();
  if (targetEmail && targetEmail === email) return true;

  if (notification.target_role === 'admin_standby') {
    return user?.role === 'admin' || user?.standby === true;
  }

  if (notification.target_role && notification.target_role === user?.role) {
    return true;
  }

  return false;
}

const urgencyStyles = {
  urgent: 'border-red-500/70 bg-red-950/95',
  today: 'border-yellow-500/70 bg-yellow-950/95',
  tomorrow: 'border-blue-500/70 bg-blue-950/95',
  change: 'border-orange-500/70 bg-orange-950/95',
};

const urgencyLabel = {
  urgent: 'Setup soon',
  today: 'Today',
  tomorrow: 'Tomorrow',
  change: 'Update',
};

export default function ShootNotifications({ shoots = [], user, notifyHours = 5 }) {
  const [storedNotifications, setStoredNotifications] = useState([]);
  const [dismissedReminders, setDismissedReminders] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dismissed_notifs') || '[]');
    } catch {
      return [];
    }
  });

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
    } catch (error) {
      // Some Base44 projects do not support subscribe on newly-created entities immediately.
    }

    return () => unsubscribe?.();
  }, [user?.email, user?.role, user?.standby]);

  const now = new Date();

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

  if (active.length === 0) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[70] pointer-events-none px-3 pt-[max(0.75rem,env(safe-area-inset-top))] md:pt-3"
      role="region"
      aria-label="Notifications"
    >
      <div className="mx-auto w-full max-w-xl space-y-2 pointer-events-auto max-h-[min(50vh,28rem)] overflow-y-auto">
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

        {active.map((item) => {
          if (item.kind === 'stored') {
            const notification = item.notification;
            const heading = notification.title || notification.shoot_title || 'Notification';

            return (
              <div
                key={item.key}
                className={`rounded-xl border px-3 py-2.5 shadow-2xl shadow-black/40 backdrop-blur-md ${urgencyStyles.change}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1">
                      {notification.type === 'standby' ? (
                        <Bell className="h-3.5 w-3.5 text-orange-200" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-orange-200" />
                      )}
                      <span className="text-[11px] font-medium uppercase tracking-wide text-orange-200">
                        {notification.type === 'standby' ? 'Standby' : urgencyLabel.change}
                      </span>
                    </div>

                    <p className="text-sm font-semibold text-slate-50 truncate">{heading}</p>

                    {notification.message && (
                      <p className="mt-1 whitespace-pre-wrap text-xs text-slate-200 leading-relaxed">
                        {notification.message}
                      </p>
                    )}

                    {(notification.shoot_date || notification.shoot_time) && (
                      <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-300">
                        <Calendar className="h-3 w-3" />
                        {notification.shoot_date ? (
                          <span>
                            {format(new Date(notification.shoot_date + 'T12:00:00'), 'EEE, MMM d')}
                          </span>
                        ) : null}
                        {notification.shoot_time && <span>· Game {notification.shoot_time}</span>}
                      </div>
                    )}

                    {notification.created_by_name && (
                      <p className="text-[11px] text-slate-400 mt-1">
                        Changed by {notification.created_by_name}
                      </p>
                    )}
                  </div>

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
            );
          }

          return (
            <div
              key={item.key}
              className={`rounded-xl border px-3 py-2.5 shadow-2xl shadow-black/40 backdrop-blur-md ${urgencyStyles[item.urgency]}`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-200">
                      {urgencyLabel[item.urgency]}
                    </span>
                  </div>

                  <p className="text-sm font-semibold text-slate-50 truncate">
                    {item.shoot.title}
                  </p>

                  <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-200">
                    <Calendar className="h-3 w-3" />
                    <span>{format(new Date(item.shoot.date + 'T12:00:00'), 'EEE, MMM d')}</span>
                    {item.shoot.game_time && <span>· Game {item.shoot.game_time}</span>}
                  </div>

                  <p className="text-xs text-slate-200 mt-0.5">
                    Setup: {format(item.setupTime, 'HH:mm')}
                    {item.urgency === 'urgent' &&
                      ` (in ${Math.round(item.hoursUntilSetup * 10) / 10}h)`}
                  </p>
                </div>

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
          );
        })}
      </div>
    </div>
  );
}
