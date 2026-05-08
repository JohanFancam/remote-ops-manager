import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { X, AlertTriangle, Clock, Calendar, MapPin, Wifi, CheckCircle2, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';

const TRACKED_FIELDS = [
  { key: 'game_time', label: 'Game Time', icon: Clock },
  { key: 'date', label: 'Date', icon: Calendar, format: (v) => v ? format(new Date(v + 'T12:00:00'), 'EEE, MMM d yyyy') : '—' },
  { key: 'location', label: 'Location', icon: MapPin },
  { key: 'title', label: 'Title', icon: null },
  { key: 'status', label: 'Status', icon: CheckCircle2 },
  { key: 'rig_type_override', label: 'Rig Type', icon: Wifi },
];

const STORAGE_KEY = 'shoot_change_alerts';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function formatValue(field, value) {
  if (!value && value !== 0) return '—';
  if (field.format) return field.format(value);
  return String(value).replace(/_/g, ' ');
}

function loadStoredAlerts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    // Filter out old alerts
    return parsed.filter(a => Date.now() - new Date(a.timestamp).getTime() < MAX_AGE_MS);
  } catch {
    return [];
  }
}

function saveAlerts(alerts) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
  } catch {}
}

export default function ShootChangePopup({ userEmail, isAdmin = false }) {
  const [alerts, setAlerts] = useState(() => loadStoredAlerts());
  const shootsRef = useRef({});
  const seededRef = useRef(false);

  // Persist alerts to localStorage whenever they change
  useEffect(() => {
    saveAlerts(alerts);
  }, [alerts]);

  useEffect(() => {
    if (!userEmail) return;

    // Seed initial state
    base44.entities.Shoot.list('-date', 500).then(shoots => {
      shoots.forEach(s => { shootsRef.current[s.id] = s; });
      seededRef.current = true;
    });

    const unsubscribe = base44.entities.Shoot.subscribe((event) => {
      if (!seededRef.current) return;
      const shoot = event.data;
      if (!shoot) return;

      const prev = shootsRef.current[shoot.id];
      const isAssigned = shoot.assigned_operators?.includes(userEmail);
      const wasAssigned = prev?.assigned_operators?.includes(userEmail);
      const isRelevant = isAssigned || wasAssigned || isAdmin;

      if (event.type === 'update' && prev && isRelevant) {
        const changes = [];

        TRACKED_FIELDS.forEach(field => {
          const oldVal = prev[field.key];
          const newVal = shoot[field.key];
          if (String(oldVal ?? '') !== String(newVal ?? '')) {
            changes.push({ field, oldVal, newVal });
          }
        });

        // Check assignment changes
        const newlyAssigned = (shoot.assigned_operators || []).filter(e => e === userEmail && !(prev.assigned_operators || []).includes(e));
        const newlyRemoved = (prev.assigned_operators || []).filter(e => e === userEmail && !(shoot.assigned_operators || []).includes(e));

        if (newlyAssigned.length > 0) {
          changes.unshift({ field: { key: 'assignment', label: 'Assignment', icon: CheckCircle2 }, oldVal: 'Not assigned', newVal: 'Assigned ✓' });
        }
        if (newlyRemoved.length > 0) {
          changes.unshift({ field: { key: 'assignment', label: 'Assignment', icon: CheckCircle2 }, oldVal: 'Assigned', newVal: 'Removed from shoot' });
        }

        if (changes.length > 0) {
          const alert = {
            id: `${shoot.id}_${Date.now()}`,
            type: 'update',
            shoot,
            changes,
            timestamp: new Date().toISOString(),
          };
          setAlerts(prev => {
            const next = [...prev, alert];
            saveAlerts(next);
            return next;
          });
        }
      }

      if (event.type === 'delete' && prev && isRelevant) {
        const alert = {
          id: `${shoot.id}_del_${Date.now()}`,
          type: 'delete',
          shoot: prev,
          changes: [],
          timestamp: new Date().toISOString(),
        };
        setAlerts(prev => {
          const next = [...prev, alert];
          saveAlerts(next);
          return next;
        });
      }

      if (event.type === 'delete') {
        delete shootsRef.current[shoot.id];
      } else {
        shootsRef.current[shoot.id] = shoot;
      }
    });

    return () => unsubscribe();
  }, [userEmail]);

  const dismiss = (id) => {
    setAlerts(prev => {
      const next = prev.filter(a => a.id !== id);
      saveAlerts(next);
      return next;
    });
  };

  const dismissAll = () => {
    setAlerts([]);
    saveAlerts([]);
  };

  if (alerts.length === 0) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-[9999] flex flex-col gap-3 max-w-sm w-full pointer-events-none">
      {alerts.length > 1 && (
        <div className="flex justify-end pointer-events-auto">
          <button
            onClick={dismissAll}
            className="text-xs text-gray-400 hover:text-white bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5"
          >
            Dismiss all ({alerts.length})
          </button>
        </div>
      )}
      {alerts.map(alert => (
        <div
          key={alert.id}
          className="pointer-events-auto bg-gray-900 border border-orange-500/40 rounded-xl shadow-2xl overflow-hidden"
          style={{ boxShadow: '0 0 0 1px rgba(249,115,22,0.15), 0 20px 60px rgba(0,0,0,0.6)' }}
        >
          {/* Header */}
          <div className={`flex items-start justify-between gap-3 px-4 py-3 border-b border-gray-800 ${alert.type === 'delete' ? 'bg-red-950/30' : 'bg-orange-950/20'}`}>
            <div className="flex items-center gap-2 min-w-0">
              {alert.type === 'delete'
                ? <Trash2 className="h-4 w-4 text-red-400 flex-shrink-0" />
                : <AlertTriangle className="h-4 w-4 text-orange-400 flex-shrink-0" />
              }
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {alert.type === 'delete' ? 'Shoot Cancelled / Removed' : 'Shoot Updated'}
                </p>
                <p className="text-xs text-gray-400 truncate">{alert.shoot.title}</p>
              </div>
            </div>
            <button onClick={() => dismiss(alert.id)} className="text-gray-500 hover:text-white flex-shrink-0 mt-0.5">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Body */}
          <div className="px-4 py-3 space-y-2.5">
            {alert.type === 'delete' ? (
              <p className="text-sm text-red-300">
                <span className="font-medium text-white">{alert.shoot.title}</span> on{' '}
                {alert.shoot.date ? format(new Date(alert.shoot.date + 'T12:00:00'), 'EEE, MMM d') : '—'}
                {alert.shoot.game_time ? ` at ${alert.shoot.game_time}` : ''} has been removed from the schedule.
              </p>
            ) : (
              alert.changes.map(({ field, oldVal, newVal }) => (
                <div key={field.key} className="rounded-lg border border-gray-800 bg-gray-950/60 px-3 py-2">
                  <p className="text-[11px] text-gray-500 uppercase tracking-wider mb-1.5">{field.label}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-red-300 line-through">{formatValue(field, oldVal)}</span>
                    <span className="text-gray-600">→</span>
                    <span className="text-xs text-green-300 font-medium">{formatValue(field, newVal)}</span>
                  </div>
                </div>
              ))
            )}

            {alert.type === 'update' && alert.shoot.date && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500 pt-1">
                <Calendar className="h-3 w-3" />
                <span>
                  {format(new Date(alert.shoot.date + 'T12:00:00'), 'EEE, MMM d')}
                  {alert.shoot.game_time ? ` · ${alert.shoot.game_time}` : ''}
                </span>
                {alert.timestamp && (
                  <span className="ml-auto text-gray-600">
                    {format(new Date(alert.timestamp), 'MMM d, HH:mm')}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-4 pb-3 flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-7 text-xs border-gray-700 text-gray-300 hover:bg-gray-800"
              onClick={() => {
                window.location.href = `/Calendar?shootId=${alert.shoot.id}`;
                dismiss(alert.id);
              }}
            >
              View Shoot
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-gray-500 hover:text-white"
              onClick={() => dismiss(alert.id)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}