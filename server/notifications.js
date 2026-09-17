/**
 * In-app ShootNotification records + Web Push fan-out.
 */
import { listEntities, createEntity, filterEntities } from './entities.js';
import { listUsers } from './auth.js';
import { sendPushToEmails } from './push.js';

const FIVE_DAYS_MS = 5 * 24 * 60 * 60 * 1000;
const TZ = 'Africa/Johannesburg';

function normEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function uniqueEmails(list = []) {
  return [...new Set((list || []).map(normEmail).filter(Boolean))];
}

function shootTitle(shoot) {
  return shoot?.title || 'Shoot';
}

function shootTime(shoot) {
  return shoot?.game_time || shoot?.start_time || '';
}

function assignedOf(shoot) {
  return uniqueEmails(shoot?.assigned_operators || shoot?.assigned_operators || []);
}

function pendingOf(shoot) {
  return uniqueEmails(shoot?.pending_operators || shoot?.pending_operators || []);
}

function adminEmails() {
  return listUsers()
    .filter((u) => !u.inactive && (u.role === 'admin' || u.standby === true))
    .map((u) => normEmail(u.email));
}

function hasNotificationKey(notificationKey) {
  return filterEntities('ShootNotification', { notification_key: notificationKey }).length > 0;
}

export async function createNotifications({
  notificationKey,
  type,
  title,
  message,
  shoot = null,
  targetEmails = [],
  targetRole = '',
  url = '/Calendar',
}) {
  const key = String(notificationKey || '').slice(0, 240);
  if (!key) return { created: 0, pushed: 0 };

  const now = new Date();
  const expiresAt = new Date(now.getTime() + FIVE_DAYS_MS).toISOString();
  const emails = uniqueEmails(targetEmails);
  let created = 0;

  const base = {
    type: type || 'info',
    title: title || 'Remote Ops',
    message: message || '',
    shoot_id: shoot?.id || '',
    shoot_title: shoot ? shootTitle(shoot) : '',
    shoot_date: shoot?.date || '',
    shoot_time: shoot ? shootTime(shoot) : '',
    created_at: now.toISOString(),
    expires_at: expiresAt,
    dismissed_by: [],
    url,
  };

  if (targetRole) {
    if (!hasNotificationKey(key)) {
      createEntity('ShootNotification', {
        ...base,
        notification_key: key,
        target_user_email: '',
        target_role: targetRole,
      }, null);
      created += 1;
    }
  }

  for (const email of emails) {
    const emailKey = emails.length > 1 ? `${key}:${email}` : key;
    if (hasNotificationKey(emailKey)) continue;
    createEntity('ShootNotification', {
      ...base,
      notification_key: emailKey,
      target_user_email: email,
      target_role: '',
    }, null);
    created += 1;
  }

  const pushTargets = targetRole === 'admin_standby'
    ? uniqueEmails([...emails, ...adminEmails()])
    : emails;

  const pushResult = await sendPushToEmails(pushTargets, {
    title: title || 'Remote Ops',
    body: message || '',
    url,
    type: type || 'info',
    shootId: shoot?.id || null,
  });

  return { created, pushed: pushResult.sent };
}

export async function handleShootChange(previous, next, user = null) {
  if (!next?.id) return;
  const actor = normEmail(user?.email);
  const title = shootTitle(next);
  const stamp = next.updated_date || new Date().toISOString();

  const prevAssigned = assignedOf(previous || {});
  const nextAssigned = assignedOf(next);
  const prevPending = pendingOf(previous || {});
  const nextPending = pendingOf(next);

  const addedAssigned = nextAssigned.filter((e) => !prevAssigned.includes(e));
  const removedAssigned = prevAssigned.filter((e) => !nextAssigned.includes(e));
  const addedPending = nextPending.filter((e) => !prevPending.includes(e));
  const removedPending = prevPending.filter((e) => !nextPending.includes(e));
  const approved = addedAssigned.filter((e) => prevPending.includes(e));
  const approvedSet = new Set(approved);

  const wasCancelled = String(previous?.status || '') === 'cancelled';
  const isCancelled = String(next.status || '') === 'cancelled';
  if (!wasCancelled && isCancelled) {
    const targets = uniqueEmails([
      ...prevAssigned, ...nextAssigned, ...prevPending, ...nextPending,
    ]).filter((e) => e !== actor);
    await createNotifications({
      notificationKey: `cancelled:${next.id}:${stamp}`,
      type: 'cancelled',
      title: 'Shoot cancelled',
      message: `${title} on ${next.date || previous?.date || ''} was cancelled.`,
      shoot: next,
      targetEmails: targets,
      url: '/Calendar',
    });
  }

  const dateChanged = previous && String(previous.date || '') !== String(next.date || '');
  const timeChanged = previous && String(shootTime(previous)) !== String(shootTime(next));
  if (dateChanged || timeChanged) {
    const targets = uniqueEmails([
      ...prevAssigned, ...nextAssigned, ...prevPending, ...nextPending,
    ]).filter((e) => e !== actor);
    const parts = [];
    if (dateChanged) parts.push(`date ${previous.date || '—'} → ${next.date || '—'}`);
    if (timeChanged) parts.push(`time ${shootTime(previous) || '—'} → ${shootTime(next) || '—'}`);
    await createNotifications({
      notificationKey: `schedule:${next.id}:${stamp}`,
      type: 'schedule_change',
      title: 'Shoot schedule updated',
      message: `${title}: ${parts.join(', ')}`,
      shoot: next,
      targetEmails: targets,
      url: '/Calendar',
    });
  }

  for (const email of approved) {
    await createNotifications({
      notificationKey: `approved:${next.id}:${email}:${stamp}`,
      type: 'approved',
      title: 'Assignment approved',
      message: `You were approved for ${title} on ${next.date || ''} ${shootTime(next)}`.trim(),
      shoot: next,
      targetEmails: [email],
      url: '/Calendar',
    });
  }

  for (const email of addedAssigned.filter((e) => !approvedSet.has(e) && e !== actor)) {
    await createNotifications({
      notificationKey: `assigned:${next.id}:${email}:${stamp}`,
      type: 'assigned',
      title: 'Assigned to shoot',
      message: `You were assigned to ${title} on ${next.date || ''} ${shootTime(next)}`.trim(),
      shoot: next,
      targetEmails: [email],
      url: '/Calendar',
    });
  }

  for (const email of removedAssigned.filter((e) => e !== actor)) {
    await createNotifications({
      notificationKey: `unassigned:${next.id}:${email}:${stamp}`,
      type: 'unassigned',
      title: 'Removed from shoot',
      message: `You were removed from ${title} on ${previous?.date || next.date || ''}.`,
      shoot: next,
      targetEmails: [email],
      url: '/Calendar',
    });
  }

  const actorIsAdmin = !!user && (user.role === 'admin' || user.standby === true);
  if (actor && !actorIsAdmin) {
    const adminMsgs = [];
    if (addedPending.includes(actor)) {
      adminMsgs.push(`${actor} requested ${title} (${next.date || ''})`);
    }
    if (addedAssigned.includes(actor) && !prevPending.includes(actor)) {
      adminMsgs.push(`${actor} assigned themselves to ${title} (${next.date || ''})`);
    }
    if (removedAssigned.includes(actor) || removedPending.includes(actor)) {
      adminMsgs.push(`${actor} unassigned from ${title} (${next.date || ''})`);
    }
    for (const [i, msg] of adminMsgs.entries()) {
      await createNotifications({
        notificationKey: `admin_ops:${next.id}:${actor}:${i}:${stamp}`,
        type: 'operator_action',
        title: 'Operator assignment update',
        message: msg,
        shoot: next,
        targetEmails: [],
        targetRole: 'admin_standby',
        url: '/Calendar',
      });
    }
  }
}

export async function handleAvailabilityChange(previous, next, user = null, eventType = 'update') {
  const record = next || previous;
  if (!record) return;

  const type = String(record.type || 'unavailable');
  const email = normEmail(record.operator_email || user?.email);
  const name = record.operator_name || email;
  const start = record.start_date || '';
  const end = record.end_date || start;
  const stamp = record.updated_date || record.created_date || new Date().toISOString();

  if (eventType === 'delete' && previous && String(previous.type || '') === 'unavailable') {
    await createNotifications({
      notificationKey: `out_cleared:${previous.id}:${stamp}`,
      type: 'availability',
      title: 'Operator back',
      message: `${previous.operator_name || previous.operator_email} cleared unavailability (${previous.start_date || ''} → ${previous.end_date || ''}).`,
      targetEmails: [],
      targetRole: 'admin_standby',
      url: '/OperatorAvailability',
    });
    return;
  }

  if (type === 'unavailable' && (eventType === 'create' || eventType === 'update')) {
    const range = start === end ? start : `${start} → ${end}`;
    await createNotifications({
      notificationKey: `out:${record.id || email}:${start}:${end}`,
      type: 'availability',
      title: 'Operator marked out',
      message: `${name} is unavailable ${range}${record.notes ? ` — ${record.notes}` : ''}.`,
      targetEmails: [],
      targetRole: 'admin_standby',
      url: '/OperatorAvailability',
    });
  }
}

function todayInTz(timeZone = TZ) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function minutesNowInTz(timeZone = TZ) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0);
  return hour * 60 + minute;
}

function parseHm(value) {
  if (!value || !/^\d{1,2}:\d{2}/.test(value)) return null;
  const [h, m] = value.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function getNotifyHoursBefore() {
  const settings = listEntities('AppSettings', null, 500);
  const raw = settings.find((s) => s.key === 'notify_hours_before')?.value;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 5;
}

export async function runReminderPass() {
  const today = todayInTz();
  const nowMins = minutesNowInTz();
  const notifyHours = getNotifyHoursBefore();
  const shoots = listEntities('Shoot', 'date', 5000).filter((s) => {
    const status = String(s.status || 'upcoming');
    return status !== 'cancelled' && status !== 'completed';
  });

  let created = 0;

  for (const shoot of shoots) {
    if (shoot.date !== today) continue;
    const assignees = assignedOf(shoot);
    if (!assignees.length) continue;

    for (const email of assignees) {
      const dayKey = `day_of:${shoot.id}:${email}:${today}`;
      if (hasNotificationKey(dayKey)) continue;
      if (nowMins < 5 * 60) continue;
      const result = await createNotifications({
        notificationKey: dayKey,
        type: 'day_of',
        title: 'Shoot today',
        message: `You have ${shootTitle(shoot)} today at ${shootTime(shoot) || 'TBC'}.`,
        shoot,
        targetEmails: [email],
        url: '/Calendar',
      });
      created += result.created;
    }

    const gameMins = parseHm(shootTime(shoot));
    if (gameMins == null) continue;
    const setupOffset = Number(shoot.setup_offset ?? -150);
    const setupMins = gameMins + setupOffset;
    const hoursUntilSetup = (setupMins - nowMins) / 60;

    if (hoursUntilSetup > 0 && hoursUntilSetup <= notifyHours) {
      for (const email of assignees) {
        const soonKey = `starting_soon:${shoot.id}:${email}:${today}`;
        if (hasNotificationKey(soonKey)) continue;
        const mins = Math.max(1, Math.round(hoursUntilSetup * 60));
        const result = await createNotifications({
          notificationKey: soonKey,
          type: 'starting_soon',
          title: 'Shoot starting soon',
          message: `${shootTitle(shoot)} setup is in about ${mins} minutes (${shootTime(shoot)}).`,
          shoot,
          targetEmails: [email],
          url: '/Calendar',
        });
        created += result.created;
      }
    }
  }

  if (nowMins >= 6 * 60 && nowMins <= 7 * 60) {
    const availability = listEntities('OperatorAvailability', '-start_date', 2000);
    const outToday = availability.filter((a) => {
      if (String(a.type || '') !== 'unavailable') return false;
      const start = a.start_date || '';
      const end = a.end_date || start;
      return start && end && start <= today && end >= today;
    });
    if (outToday.length) {
      const names = outToday.map((a) => a.operator_name || a.operator_email).join(', ');
      const key = `out_digest:${today}`;
      if (!hasNotificationKey(key)) {
        const result = await createNotifications({
          notificationKey: key,
          type: 'availability_digest',
          title: 'Operators out today',
          message: `Unavailable today: ${names}`,
          targetEmails: [],
          targetRole: 'admin_standby',
          url: '/OperatorAvailability',
        });
        created += result.created;
      }
    }
  }

  return { created, today };
}
