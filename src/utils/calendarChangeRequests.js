import { base44 } from '@/api/base44Client';

export async function submitCalendarChangeRequest({
  user,
  action,
  shoot = null,
  payload = {},
  summary = '',
}) {
  const title = payload.title || shoot?.title || 'Calendar change';
  const request = await base44.entities.CalendarChangeRequest.create({
    action,
    status: 'pending',
    shoot_id: shoot?.id || '',
    shoot_title: title,
    payload,
    summary: summary || `${action} ${title}`,
    requested_by_email: user?.email || '',
    requested_by_name: user?.full_name || user?.email || '',
  });

  await base44.entities.ShootNotification.create({
    type: 'calendar_request',
    title: 'Calendar change request',
    message: `${user?.full_name || user?.email || 'Data Analytics'} asked to ${action} “${title}”. Open Notifications to approve or decline.`,
    shoot_id: shoot?.id || '',
    shoot_title: title,
    shoot_date: payload.date || shoot?.date || '',
    shoot_time: payload.game_time || shoot?.game_time || '',
    target_role: 'admin',
    created_by_name: user?.full_name || user?.email || '',
    created_at: new Date().toISOString(),
    url: '/Notifications',
    request_id: request.id,
  });

  return request;
}

export async function applyCalendarChangeRequest(request) {
  const action = request.action;
  const payload = request.payload || {};
  if (action === 'create') {
    await base44.entities.Shoot.create(payload);
  } else if (action === 'update' && request.shoot_id) {
    await base44.entities.Shoot.update(request.shoot_id, payload);
  } else if (action === 'delete' && request.shoot_id) {
    await base44.entities.Shoot.delete(request.shoot_id);
  }
  await base44.entities.CalendarChangeRequest.update(request.id, {
    status: 'approved',
    reviewed_at: new Date().toISOString(),
  });
}

export async function declineCalendarChangeRequest(request) {
  await base44.entities.CalendarChangeRequest.update(request.id, {
    status: 'rejected',
    reviewed_at: new Date().toISOString(),
  });
}
