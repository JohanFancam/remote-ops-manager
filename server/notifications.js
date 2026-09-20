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
  return uniqueEmails(shoot?.assigned_operators || []);
}

function userNameFor(email) {
  const match = listUsers().find((u) => normEmail(u.email) === normEmail(email));
  return match?.full_name || email || 'Operator';
}

function operatorNames(shoot) {
  const emails = assignedOf(shoot);
  if (!emails.length) return 'unassigned';
  return emails.map(userNameFor).join(', ');
}

function phaseValue(shoot, key) {
  const phase = shoot?.phase_status;
  if (!phase || typeof phase !== 'object') return '';
  return phase[key] || '';
}

function phaseJustStarted(previous, next, key) {
  return !phaseValue(previous, key) && !!phaseValue(next, key);
}

function addDaysYmd(ymd, days) {
  const [year, month, day] = String(ymd || '').split('-').map(Number);
  if (!year || !month || !day) return '';
  const dt = new Date(Date.UTC(year, month - 1, day + days));
  const yyyy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(dt.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function civilMinutes(ymd, hm) {
  const [year, month, day] = String(ymd || '').split('-').map(Number);
  const mins = parseHm(hm);
  if (!year || !month || !day || mins == null) return null;
  return Date.UTC(year, month - 1, day) / 60000 + mins;
}

function shootCivilMinutes(shoot) {
  if (!shoot?.date) return null;
  return civilMinutes(shoot.date, shoot.game_time || shoot.start_time || '12:00');
}

function coveringStandbyEmails(shoot) {
  const shootMins = shootCivilMinutes(shoot);
  if (shootMins == null) return [];
  return uniqueEmails(
    listEntities('StandbyDay', '-date', 2000)
      .filter((standby) => {
        const startDate = standby.start_date || standby.date;
        if (!startDate) return false;
        const startTime = standby.start_time || '18:00';
        const endTime = standby.end_time || '06:00';
        const endDate = standby.end_date || addDaysYmd(startDate, 1);
        const startMins = civilMinutes(startDate, startTime);
        const endMins = civilMinutes(endDate, endTime);
        if (startMins == null || endMins == null) return false;
        return shootMins >= startMins && shootMins <= endMins;
      })
      .map((standby) => standby.admin_email)
  );
}


function pendingOf(shoot) {
  return uniqueEmails(shoot?.pending_operators || shoot?.pending_operators || []);
}

function adminEmails() {
  return listUsers()
    .filter((u) => !u.inactive && (u.role === 'admin' || u.standby === true))
    .map((u) => normEmail(u.email));
}

function roleAdminEmails() {
  return listUsers()
    .filter((u) => !u.inactive && u.role === 'admin')
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
  excludeEmails = [],
  createdByName = '',
  extras = {},
}) {
  const key = String(notificationKey || '').slice(0, 240);
  if (!key) return { created: 0, pushed: 0 };

  const now = new Date();
  const expiresAt = new Date(now.getTime() + FIVE_DAYS_MS).toISOString();
  const emails = uniqueEmails(targetEmails);
  const excluded = uniqueEmails(excludeEmails);
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
    dismissed_by: excluded,
    created_by_name: createdByName || '',
    url,
    ...extras,
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
    if (excluded.includes(email)) continue;
    const emailKey = (targetRole || emails.length > 1) ? `${key}:${email}` : key;
    if (hasNotificationKey(emailKey)) continue;
    createEntity('ShootNotification', {
      ...base,
      notification_key: emailKey,
      target_user_email: email,
      target_role: '',
    }, null);
    created += 1;
  }

  const roleTargets = targetRole === 'admin_standby'
    ? adminEmails()
    : targetRole === 'admin'
      ? roleAdminEmails()
      : [];

  const pushTargets = uniqueEmails([...emails, ...roleTargets])
    .filter((email) => !excluded.includes(email));

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
      ...roleAdminEmails(),
    ]).filter((e) => e !== actor);
    const previousDate = previous.date || '';
    const previousTime = shootTime(previous);
    const nextDate = next.date || '';
    const nextTime = shootTime(next);
    const lines = [
      `${title} schedule changed (South Africa time).`,
      `Was: ${previousDate || '—'} ${previousTime || ''}`.trim(),
      `Now: ${nextDate || '—'} ${nextTime || ''}`.trim(),
    ];
    await createNotifications({
      notificationKey: `schedule:${next.id}:${stamp}`,
      type: 'schedule_change',
      title: 'Time / date changed',
      message: lines.join('\n'),
      shoot: next,
      targetEmails: targets,
      excludeEmails: [actor],
      createdByName: user?.full_name || user?.email || '',
      url: '/Calendar',
      extras: {
        previous_date: previousDate,
        previous_time: previousTime,
        new_date: nextDate,
        new_time: nextTime,
      },
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

  if (phaseJustStarted(previous, next, 'pre_shoot_started')) {
    const actorName = user?.full_name || userNameFor(actor) || operatorNames(next);
    const covering = coveringStandbyEmails(next);
    const coveringNonAdmin = covering.filter((email) => !roleAdminEmails().includes(email));
    await createNotifications({
      notificationKey: `pre_shoot_started:${next.id}:${stamp}`,
      type: 'pre_shoot_started',
      title: 'Pre-shoot started',
      message: `${actorName} started pre-shoot for ${title} on ${next.date || ''} ${shootTime(next)}`.trim(),
      shoot: next,
      targetEmails: coveringNonAdmin,
      targetRole: 'admin',
      excludeEmails: [actor],
      createdByName: actorName,
      url: '/Notifications',
    });
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

function standbyDateLabel(record) {
  const start = record?.start_date || record?.date || '';
  const end = record?.end_date || start;
  if (!start) return '';
  if (!end || end === start) return start;
  return `${start} → ${end}`;
}

export async function handleStandbyChange(previous, next, user = null, eventType = 'update') {
  const record = next || previous;
  if (!record) return;

  const actor = normEmail(user?.email);
  const actorName = user?.full_name || user?.email || record.admin_name || record.admin_email || 'Someone';
  const stamp = record.updated_date || record.created_date || new Date().toISOString();
  const range = standbyDateLabel(next || previous);

  if (eventType === 'create' && next) {
    await createNotifications({
      notificationKey: `standby_select:${next.id}:${stamp}`,
      type: 'standby',
      title: 'Standby day selected',
      message: `${actorName} selected standby for ${range || 'a day'} (18:00–06:00).`,
      targetEmails: [],
      targetRole: 'admin',
      excludeEmails: [actor],
      createdByName: actorName,
      url: '/Calendar',
    });
    return;
  }

  if (eventType !== 'update' || !previous || !next) return;

  const prevEmail = normEmail(previous.admin_email);
  const nextEmail = normEmail(next.admin_email);
  const prevRange = standbyDateLabel(previous);
  const emailChanged = prevEmail && nextEmail && prevEmail !== nextEmail;
  const dateChanged = prevRange !== range;

  if (!emailChanged && !dateChanged) return;

  const previousName = previous.admin_name || previous.admin_email || 'another person';
  const nextName = next.admin_name || next.admin_email || actorName;
  const message = emailChanged
    ? `${actorName} swapped standby on ${range || prevRange || 'a day'} from ${previousName} to ${nextName}.`
    : `${actorName} selected standby for ${range || 'a day'} (18:00–06:00).`;

  await createNotifications({
    notificationKey: `standby_${emailChanged ? 'swap' : 'select'}:${next.id}:${stamp}`,
    type: 'standby',
    title: emailChanged ? 'Standby swapped' : 'Standby day selected',
    message,
    targetEmails: [],
    targetRole: 'admin',
    excludeEmails: [actor],
    createdByName: actorName,
    url: '/Calendar',
  });
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
    const alreadyStarted = !!(
      phaseValue(shoot, 'setup_complete')
      || phaseValue(shoot, 'pre_shoot_started')
      || phaseValue(shoot, 'game_started')
    );
    const operators = operatorNames(shoot);

    if (!alreadyStarted && hoursUntilSetup > 0 && hoursUntilSetup <= notifyHours) {
      const mins = Math.max(1, Math.round(hoursUntilSetup * 60));
      for (const email of assignees) {
        const soonKey = `starting_soon:${shoot.id}:${email}:${today}`;
        if (hasNotificationKey(soonKey)) continue;
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

      const adminKey = `needs_start:${shoot.id}:${today}`;
      if (!hasNotificationKey(adminKey)) {
        const covering = coveringStandbyEmails(shoot);
        const coveringNonAdmin = covering.filter((email) => !roleAdminEmails().includes(email));
        const result = await createNotifications({
          notificationKey: adminKey,
          type: 'needs_start',
          title: 'Shoot needs to start',
          message: `${shootTitle(shoot)} setup is in about ${mins} minutes (${shootTime(shoot) || 'TBC'}). Operator: ${operators}.`,
          shoot,
          targetEmails: coveringNonAdmin,
          targetRole: 'admin',
          url: '/Notifications',
        });
        created += result.created;
      }
    }

    if (!alreadyStarted && nowMins >= setupMins) {
      const overdueKey = `start_overdue:${shoot.id}:${today}`;
      if (!hasNotificationKey(overdueKey)) {
        const covering = coveringStandbyEmails(shoot);
        const coveringNonAdmin = covering.filter((email) => !roleAdminEmails().includes(email));
        const result = await createNotifications({
          notificationKey: overdueKey,
          type: 'start_overdue',
          title: 'Shoot needs to start',
          message: `${shootTitle(shoot)} setup time has passed (${shootTime(shoot) || 'TBC'}) and the operator has not started. Operator: ${operators}.`,
          shoot,
          targetEmails: coveringNonAdmin,
          targetRole: 'admin',
          url: '/Notifications',
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
