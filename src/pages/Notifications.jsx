import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { formatDateZA, formatTimeZA } from '@/utils/shootStatus';
import { Bell, Calendar, Search, X, Check } from 'lucide-react';
import { applyCalendarChangeRequest, declineCalendarChangeRequest } from '../utils/calendarChangeRequests';
import { cn } from '@/lib/utils';

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'start', label: 'Shoot start' },
  { id: 'pre_shoot', label: 'Pre-shoot' },
  { id: 'schedule', label: 'Time changes' },
  { id: 'standby', label: 'Standby' },
  { id: 'team', label: 'Team' },
  { id: 'sync', label: 'Google sync' },
  { id: 'requests', label: 'Requests' },
];

const START_TYPES = new Set(['needs_start', 'start_overdue', 'starting_soon']);
const SCHEDULE_TYPES = new Set(['schedule_change', 'cancelled']);
const TEAM_TYPES = new Set([
  'assigned', 'approved', 'unassigned', 'operator_action',
  'availability', 'availability_digest',
]);

function notificationTypeLabel(type) {
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
    default:
      return 'Update';
  }
}

function historyDedupeKey(notification) {
  const key = String(notification.notification_key || notification.id || '');
  return key.replace(/:[^:]+@[^:]+$/, '') || notification.id;
}

function matchesFilter(type, filter) {
  if (filter === 'all') return true;
  if (filter === 'start') return START_TYPES.has(type);
  if (filter === 'pre_shoot') return type === 'pre_shoot_started';
  if (filter === 'schedule') return SCHEDULE_TYPES.has(type);
  if (filter === 'standby') return type === 'standby';
  if (filter === 'team') return TEAM_TYPES.has(type);
  if (filter === 'sync') return type === 'google_sync';
  if (filter === 'requests') return type === 'calendar_request';
  return true;
}

function userCanSeeHistory(notification, user) {
  const email = (user?.email || '').toLowerCase();
  if (!email) return false;
  if (user?.role === 'admin') return true;

  const targetEmail = (notification.target_user_email || '').toLowerCase();
  if (targetEmail && targetEmail === email) return true;

  if (notification.target_role === 'admin_standby') {
    return user?.role === 'admin' || user?.role === 'standby' || user?.standby === true;
  }

  if (notification.target_role && notification.target_role === user?.role) {
    return true;
  }

  return false;
}

function wasDismissed(notification, user) {
  const email = (user?.email || '').toLowerCase();
  return (notification.dismissed_by || []).map((item) => String(item).toLowerCase()).includes(email);
}

function createdStamp(notification) {
  return notification.created_at || notification.created_date || '';
}

function sastDateKey(iso) {
  if (!iso) return 'unknown';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'unknown';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function sastDateLabel(iso) {
  if (!iso) return 'Unknown date';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown date';
  return d.toLocaleDateString('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function sastTimeLabel(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('en-ZA', {
    timeZone: 'Africa/Johannesburg',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function Notifications() {
  const { user, isAdmin } = useApp();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [busyRequest, setBusyRequest] = useState('');

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['notificationHistory'],
    queryFn: () => base44.entities.ShootNotification.list('-created_at', 2000),
    enabled: !!user?.email,
  });

  const { data: changeRequests = [] } = useQuery({
    queryKey: ['calendarChangeRequests'],
    queryFn: () => base44.entities.CalendarChangeRequest.list('-created_date', 200),
    enabled: !!user?.email && isAdmin,
  });

  const pendingRequests = (changeRequests || []).filter((item) => item.status === 'pending');

  const handleRequest = async (request, approve) => {
    setBusyRequest(request.id);
    try {
      if (approve) await applyCalendarChangeRequest(request);
      else await declineCalendarChangeRequest(request);
      queryClient.invalidateQueries({ queryKey: ['calendarChangeRequests'] });
      queryClient.invalidateQueries({ queryKey: ['shoots'] });
    } finally {
      setBusyRequest('');
    }
  };

  useEffect(() => {
    let unsubscribe;
    try {
      unsubscribe = base44.entities.ShootNotification.subscribe(() => {
        queryClient.invalidateQueries({ queryKey: ['notificationHistory'] });
      });
    } catch {
      // subscribe is optional
    }
    return () => unsubscribe?.();
  }, [queryClient]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const seen = new Set();
    return (records || [])
      .filter((notification) => userCanSeeHistory(notification, user))
      .filter((notification) => matchesFilter(notification.type, filter))
      .filter((notification) => {
        if (!q) return true;
        return [
          notification.title,
          notification.message,
          notification.shoot_title,
          notification.created_by_name,
          notificationTypeLabel(notification.type),
        ].some((value) => String(value || '').toLowerCase().includes(q));
      })
      .sort((a, b) => String(createdStamp(b)).localeCompare(String(createdStamp(a))))
      .filter((notification) => {
        const key = historyDedupeKey(notification);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }, [records, user, filter, search]);

  const groups = useMemo(() => {
    const byDay = new Map();
    for (const notification of visible) {
      const key = sastDateKey(createdStamp(notification));
      if (!byDay.has(key)) byDay.set(key, []);
      byDay.get(key).push(notification);
    }
    return [...byDay.entries()];
  }, [visible]);

  return (
    <div className="min-h-screen bg-slate-800 text-slate-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-slate-400 text-sm mt-1">
            History of shoot start alerts, pre-shoot updates, and other desk messages (South Africa time).
          </p>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search title, shoot, or message…"
            className="w-full bg-slate-900 border border-slate-800 text-slate-100 rounded-lg pl-9 pr-10 py-2.5 text-sm placeholder:text-gray-600 focus:border-blue-500 outline-none"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {isAdmin && pendingRequests.length > 0 && (
          <div className="mb-6 rounded-xl border border-blue-800/40 bg-slate-900 p-4">
            <p className="text-sm font-semibold text-slate-100 mb-3">Pending calendar requests</p>
            <div className="space-y-2">
              {pendingRequests.map((request) => (
                <div key={request.id} className="rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2.5">
                  <p className="text-sm text-slate-100">{request.summary || `${request.action} ${request.shoot_title}`}</p>
                  <p className="text-xs text-slate-500 mt-0.5">From {request.requested_by_name || request.requested_by_email}</p>
                  <div className="flex gap-2 mt-2">
                    <button
                      type="button"
                      disabled={busyRequest === request.id}
                      onClick={() => handleRequest(request, true)}
                      className="inline-flex items-center gap-1 rounded-md bg-blue-600 hover:bg-blue-500 px-2.5 py-1 text-xs text-white"
                    >
                      <Check className="h-3 w-3" /> Approve
                    </button>
                    <button
                      type="button"
                      disabled={busyRequest === request.id}
                      onClick={() => handleRequest(request, false)}
                      className="inline-flex items-center gap-1 rounded-md border border-slate-700 px-2.5 py-1 text-xs text-slate-300 hover:bg-slate-800"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2 mb-6">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={cn(
                'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                filter === item.id
                  ? 'border-blue-500 bg-blue-600/20 text-blue-200'
                  : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-100'
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="w-7 h-7 border-2 border-slate-700 border-t-blue-400 rounded-full animate-spin" />
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-xl border border-slate-800 bg-slate-900 px-6 py-12 text-center">
            <Bell className="h-8 w-8 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-300 font-medium">No notifications in this view</p>
            <p className="text-slate-500 text-sm mt-1">
              Alerts stay here after they are cleared from the popup inbox.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map(([dayKey, items]) => (
              <section key={dayKey}>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  {sastDateLabel(createdStamp(items[0]))}
                </h2>
                <div className="space-y-2">
                  {items.map((notification) => {
                    const dismissed = wasDismissed(notification, user);
                    const href = notification.url || (notification.shoot_id ? '/Calendar' : '/Notifications');
                    return (
                      <Link
                        key={notification.id}
                        to={href}
                        className={cn(
                          'block rounded-xl border bg-slate-900 px-4 py-3 transition-colors',
                          dismissed
                            ? 'border-slate-800 opacity-70 hover:opacity-100'
                            : 'border-slate-700 hover:border-blue-700'
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[11px] font-medium uppercase tracking-wide text-blue-300">
                                {notificationTypeLabel(notification.type)}
                              </span>
                              {dismissed && (
                                <span className="text-[10px] rounded-full border border-slate-700 px-1.5 py-0.5 text-slate-500">
                                  Cleared
                                </span>
                              )}
                            </div>
                            <p className="text-sm font-semibold text-slate-50 mt-1 truncate">
                              {notification.shoot_title || notification.title || 'Notification'}
                            </p>
                            {notification.message && (
                              <p className="mt-1 whitespace-pre-wrap text-xs text-slate-300 leading-relaxed">
                                {notification.message}
                              </p>
                            )}
                            {(notification.shoot_date || notification.shoot_time) && (
                              <div className="flex items-center gap-1.5 mt-1.5 text-xs text-slate-400">
                                <Calendar className="h-3 w-3" />
                                {notification.shoot_date ? <span>{formatDateZA(notification.shoot_date)}</span> : null}
                                {notification.shoot_time && (
                                  <span>· {formatTimeZA(notification.shoot_time)} SAST</span>
                                )}
                              </div>
                            )}
                            {notification.created_by_name && (
                              <p className="text-[11px] text-slate-500 mt-1">
                                {notification.created_by_name}
                              </p>
                            )}
                          </div>
                          <span className="flex-shrink-0 text-[11px] text-slate-500 font-mono">
                            {sastTimeLabel(createdStamp(notification))}
                          </span>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
