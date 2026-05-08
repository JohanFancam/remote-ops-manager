import React, { useEffect, useMemo, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Bell, X, Calendar, CheckCheck, AlertTriangle } from 'lucide-react';
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

export default function ShootNotifications({ shoots = [], user, notifyHours = 5 }) {
  const [open, setOpen] = useState(false);
  const [storedNotifications, setStoredNotifications] = useState([]);
  const [dismissedReminders, setDismissedReminders] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('dismissed_notifs') || '[]');
    } catch {
      return [];
    }
  });

  const panelRef = useRef(null);

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
      // The manual load above still works when the app opens.
    }

    return () => unsubscribe?.();
  }, [user?.email, user?.role, user?.standby]);

  useEffect(() => {
    function handleClick(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setOpen(false);
      }
    }

    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

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
  const count = active.length;

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

    setOpen(false);
  };

  const urgencyStyles = {
    urgent: 'border-red-700/60 bg-red-950/30',
    today: 'border-yellow-700/60 bg-yellow-950/20',
    tomorrow: 'border-blue-700/60 bg-blue-950/20',
    change: 'border-orange-700/60 bg-orange-950/20',
  };

  const urgencyLabel = {
    urgent: '🔴 Setup soon!',
    today: '🟡 Today',
    tomorrow: '🔵 Tomorrow',
    change: '🟠 Shoot update',
  };

  return (
    <div className="relative w-full" ref={panelRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative w-full flex items-center justify-between px-3 py-2 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
      >
        <span className="flex items-center gap-2 text-sm">
          <Bell className="h-4 w-4" /> Notifications
        </span>

        {count > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute bottom-full left-0 right-0 mb-1 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
            <span className="text-sm font-semibold text-white">Shoot Notifications</span>

            {active.length > 0 && (
              <button
                onClick={dismissAll}
                className="text-xs text-gray-500 hover:text-white flex items-center gap-1"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Clear all
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {active.length === 0 ? (
              <div className="p-6 text-center">
                <Bell className="h-8 w-8 text-gray-700 mx-auto mb-2" />
                <p className="text-xs text-gray-500">No new notifications</p>
              </div>
            ) : (
              active.map((item) => {
                if (item.kind === 'stored') {
                  const notification = item.notification;

                  return (
                    <div
                      key={item.key}
                      className={`mx-3 my-2 rounded-lg border p-3 ${urgencyStyles.change}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            <AlertTriangle className="h-3.5 w-3.5 text-orange-300" />
                            <span className="text-xs font-medium text-orange-200">
                              {urgencyLabel.change}
                            </span>
                          </div>

                          <p className="text-sm font-semibold text-white truncate">
                            {notification.shoot_title || 'Shoot updated'}
                          </p>

                          {notification.message && (
                            <pre className="mt-2 whitespace-pre-wrap text-xs text-gray-300 font-sans leading-relaxed">
                              {notification.message}
                            </pre>
                          )}

                          <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
                            <Calendar className="h-3 w-3" />
                            {notification.shoot_date ? (
                              <span>
                                {format(new Date(notification.shoot_date + 'T12:00:00'), 'EEE, MMM d')}
                              </span>
                            ) : (
                              <span>No date</span>
                            )}
                            {notification.shoot_time && <span>· Game {notification.shoot_time}</span>}
                          </div>

                          {notification.created_by_name && (
                            <p className="text-[11px] text-gray-500 mt-1">
                              Changed by {notification.created_by_name}
                            </p>
                          )}
                        </div>

                        <button
                          onClick={() => dismiss(item)}
                          className="text-gray-600 hover:text-gray-400 flex-shrink-0"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={item.key}
                    className={`mx-3 my-2 rounded-lg border p-3 ${urgencyStyles[item.urgency]}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-xs font-medium text-gray-300">
                            {urgencyLabel[item.urgency]}
                          </span>
                        </div>

                        <p className="text-sm font-semibold text-white truncate">
                          {item.shoot.title}
                        </p>

                        <div className="flex items-center gap-1.5 mt-1 text-xs text-gray-400">
                          <Calendar className="h-3 w-3" />
                          <span>{format(new Date(item.shoot.date + 'T12:00:00'), 'EEE, MMM d')}</span>
                          {item.shoot.game_time && <span>· Game {item.shoot.game_time}</span>}
                        </div>

                        <p className="text-xs text-gray-400 mt-0.5">
                          Setup: {format(item.setupTime, 'HH:mm')}
                          {item.urgency === 'urgent' &&
                            ` (in ${Math.round(item.hoursUntilSetup * 10) / 10}h)`}
                        </p>
                      </div>

                      <button
                        onClick={() => dismiss(item)}
                        className="text-gray-600 hover:text-gray-400 flex-shrink-0"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
