import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';

const TRACKED_FIELDS = [
  { key: 'game_time', label: 'Game Time' },
  { key: 'date', label: 'Date' },
  { key: 'location', label: 'Location' },
  { key: 'title', label: 'Title' },
  { key: 'status', label: 'Status' },
  { key: 'rig_type_override', label: 'Rig Type' },
];

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;

function normalise(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.slice().sort().join(',');
  return String(value);
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value).replace(/_/g, ' ');
}

function getActorEmail(event, shoot) {
  return (
    event?.user_email ||
    event?.created_by ||
    event?.updated_by ||
    shoot?.last_changed_by_email ||
    shoot?.updated_by ||
    shoot?.created_by ||
    ''
  );
}

function buildChangeSummary(prev, shoot) {
  const parts = [];

  TRACKED_FIELDS.forEach((field) => {
    const oldVal = prev?.[field.key];
    const newVal = shoot?.[field.key];

    if (normalise(oldVal) !== normalise(newVal)) {
      parts.push(`${field.label}: ${formatValue(oldVal)} → ${formatValue(newVal)}`);
    }
  });

  const prevAssigned = prev?.assigned_operators || [];
  const nextAssigned = shoot?.assigned_operators || [];

  const added = nextAssigned.filter((email) => !prevAssigned.includes(email));
  const removed = prevAssigned.filter((email) => !nextAssigned.includes(email));

  if (added.length > 0) parts.push(`Assigned: ${added.join(', ')}`);
  if (removed.length > 0) parts.push(`Removed: ${removed.join(', ')}`);

  const prevPending = prev?.pending_operators || [];
  const nextPending = shoot?.pending_operators || [];

  const pendingAdded = nextPending.filter((email) => !prevPending.includes(email));
  const pendingRemoved = prevPending.filter((email) => !nextPending.includes(email));

  if (pendingAdded.length > 0) parts.push(`Pending request: ${pendingAdded.join(', ')}`);
  if (pendingRemoved.length > 0) parts.push(`Pending removed: ${pendingRemoved.join(', ')}`);

  return parts;
}

function uniqueEmails(emails = []) {
  return [...new Set((emails || []).filter(Boolean).map((email) => String(email).trim().toLowerCase()))];
}

function isAdminOrStandby(user) {
  return user?.role === 'admin' || user?.standby === true;
}

async function getExistingNotificationKeys() {
  try {
    const existing = await base44.entities.ShootNotification.list('-created_at', 500);
    return new Set((existing || []).map((n) => n.notification_key).filter(Boolean));
  } catch (error) {
    console.warn('Could not load existing ShootNotification records:', error);
    return new Set();
  }
}

async function createNotificationIfMissing(payload, existingKeys) {
  if (!payload.notification_key || existingKeys.has(payload.notification_key)) return;

  try {
    await base44.entities.ShootNotification.create(payload);
    existingKeys.add(payload.notification_key);
  } catch (error) {
    console.warn('Could not create ShootNotification:', error);
  }
}

/**
 * Creates persistent, targeted shoot notifications.
 *
 * Rules:
 * 1. Admin/standby changes a shoot:
 *    notify only affected assigned/pending operators.
 *
 * 2. Normal user changes a shoot / requests assignment / unassigns:
 *    notify all admins and standby users.
 *
 * IMPORTANT:
 * This component does not render any UI.
 * It only writes records to the ShootNotification entity.
 */
export default function ShootChangeNotifier({
  user,
  userEmail,
  isAdmin = false,
  isStandby = false,
}) {
  const shootsRef = useRef({});
  const seededRef = useRef(false);
  const existingKeysRef = useRef(new Set());

  const currentUserEmail = (userEmail || user?.email || '').toLowerCase();
  const currentUserIsAdminOrStandby = isAdmin || isStandby || isAdminOrStandby(user);

  useEffect(() => {
    if (!currentUserEmail) return;

    let cancelled = false;

    async function seed() {
      const [shoots, existingKeys] = await Promise.all([
        base44.entities.Shoot.list('-date', 500),
        getExistingNotificationKeys(),
      ]);

      if (cancelled) return;

      (shoots || []).forEach((shoot) => {
        shootsRef.current[shoot.id] = shoot;
      });

      existingKeysRef.current = existingKeys;
      seededRef.current = true;
    }

    seed();

    const unsubscribe = base44.entities.Shoot.subscribe(async (event) => {
      if (!seededRef.current) return;

      const shoot = event?.data;
      if (!shoot?.id) return;

      const prev = shootsRef.current[shoot.id];

      if (event.type === 'delete') {
        delete shootsRef.current[shoot.id];
        return;
      }

      shootsRef.current[shoot.id] = shoot;

      if (event.type !== 'update' || !prev) return;

      const actorEmail = getActorEmail(event, shoot).toLowerCase();

      // Safety guard:
      // Only the browser session of the user who caused the change should create notifications.
      // This prevents every online user from creating duplicate notifications.
      if (actorEmail && actorEmail !== currentUserEmail) return;

      // If Base44 does not expose updated_by/actor fields, you can make this reliable
      // by adding last_changed_by_email: user.email to your Shoot.update payloads.
      if (!actorEmail && shoot.last_changed_by_email !== currentUserEmail) return;

      const changeSummary = buildChangeSummary(prev, shoot);
      if (changeSummary.length === 0) return;

      const now = new Date();
      const expiresAt = new Date(now.getTime() + FIVE_DAYS_MS).toISOString();

      const shootTitle = shoot.title || prev.title || 'Shoot';
      const shootDate = shoot.date || prev.date || '';

      const basePayload = {
        shoot_id: shoot.id,
        shoot_title: shootTitle,
        shoot_date: shootDate,
        shoot_time: shoot.game_time || prev.game_time || '',
        message: changeSummary.join('\n'),
        type: 'shoot_change',
        created_at: now.toISOString(),
        expires_at: expiresAt,
        dismissed_by: [],
        created_by_email: currentUserEmail,
        created_by_name: user?.full_name || currentUserEmail,
        notification_key: '',
        target_user_email: '',
        target_role: '',
      };

      const affectedOperators = uniqueEmails([
        ...(prev.assigned_operators || []),
        ...(shoot.assigned_operators || []),
        ...(prev.pending_operators || []),
        ...(shoot.pending_operators || []),
      ]).filter((email) => email !== currentUserEmail);

      if (currentUserIsAdminOrStandby) {
        // Admin/standby made the change: only affected operators should see it.
        await Promise.all(
          affectedOperators.map((email) => {
            const notificationKey = [
              'shoot_change',
              shoot.id,
              email,
              normalise(shoot.updated_date || shoot.updated_at || now.toISOString()),
            ].join('_');

            return createNotificationIfMissing(
              {
                ...basePayload,
                notification_key: notificationKey,
                target_user_email: email,
                target_role: '',
              },
              existingKeysRef.current
            );
          })
        );
      } else {
        // Normal user made the change: admins and standby users should see it.
        const notificationKey = [
          'shoot_change',
          shoot.id,
          'admins_standby',
          currentUserEmail,
          normalise(shoot.updated_date || shoot.updated_at || now.toISOString()),
        ].join('_');

        await createNotificationIfMissing(
          {
            ...basePayload,
            notification_key: notificationKey,
            target_user_email: '',
            target_role: 'admin_standby',
          },
          existingKeysRef.current
        );
      }
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [currentUserEmail, currentUserIsAdminOrStandby, user?.full_name]);

  return null;
}
