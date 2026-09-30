import {
  userCanSeeNotification,
  OPERATOR_PERSONAL_TYPES,
  CALENDAR_UPDATE_TYPES,
  notificationDedupeKey,
} from './notificationVisibility.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const remote = { email: 'maya.chen@example.com', role: 'user' };
const standby = { email: 'priya.nair@example.com', role: 'standby', standby: true };
const admin = { email: 'admin@example.com', role: 'admin' };
const viewer = { email: 'viewer@example.com', role: 'viewer' };
const analytics = { email: 'data@example.com', role: 'analytics' };

const mine = (type) => ({
  type,
  target_user_email: remote.email,
  target_role: '',
  dismissed_by: [],
});

const theirs = (type) => ({
  type,
  target_user_email: 'other@example.com',
  target_role: '',
  dismissed_by: [],
});

const desk = {
  type: 'operator_action',
  target_user_email: '',
  target_role: 'admin_standby',
  dismissed_by: [],
};

const syncBroadcast = {
  type: 'google_sync',
  target_user_email: '',
  target_role: 'admin',
  dismissed_by: [],
};

assert(OPERATOR_PERSONAL_TYPES.has('assigned'), 'assigned is personal');
assert(userCanSeeNotification(mine('assigned'), remote), 'remote sees own assign');
assert(userCanSeeNotification(mine('approved'), remote), 'remote sees own approve');
assert(userCanSeeNotification(mine('cancelled'), remote), 'remote sees own cancel');
assert(userCanSeeNotification(mine('postponed'), remote), 'remote sees own postpone');
assert(userCanSeeNotification(mine('schedule_change'), remote), 'remote sees own time change');
assert(!userCanSeeNotification(theirs('assigned'), remote), 'remote does not see others');
assert(!userCanSeeNotification(mine('unassigned'), remote), 'remote does not see unassign');
assert(!userCanSeeNotification(desk, remote), 'remote does not see desk operator actions');
assert(!userCanSeeNotification(desk, standby), 'standby does not see every operator action');
assert(userCanSeeNotification(mine('assigned'), { ...remote, email: remote.email.toUpperCase() }), 'email match is case-insensitive');
assert(userCanSeeNotification({ ...mine('assigned'), target_user_email: remote.email, dismissed_by: [remote.email] }, remote) === false, 'dismissed hidden');
assert(userCanSeeNotification(desk, admin), 'admin still sees desk updates');
assert(userCanSeeNotification(theirs('assigned'), admin), 'admin can see assignment history');

assert(CALENDAR_UPDATE_TYPES.has('schedule_change'), 'time change is a calendar update');
assert(CALENDAR_UPDATE_TYPES.has('google_sync'), 'google sync is a calendar update');
assert(userCanSeeNotification(theirs('schedule_change'), viewer), 'viewer sees time changes aimed at operators');
assert(userCanSeeNotification(theirs('cancelled'), viewer), 'viewer sees calendar cancellations');
assert(userCanSeeNotification(theirs('postponed'), viewer), 'viewer sees calendar postponements');
assert(userCanSeeNotification(syncBroadcast, viewer), 'viewer sees google sync updates');
assert(!userCanSeeNotification(mine('assigned'), viewer), 'viewer does not see assignments');
assert(!userCanSeeNotification(desk, viewer), 'viewer does not see desk operator actions');

assert(userCanSeeNotification(theirs('schedule_change'), analytics), 'data user sees time changes aimed at operators');
assert(userCanSeeNotification(syncBroadcast, analytics), 'data user sees google sync updates');
assert(userCanSeeNotification(theirs('cancelled'), analytics), 'data user sees calendar cancellations');
assert(!userCanSeeNotification(mine('assigned'), analytics), 'data user does not see assignments');
assert(!userCanSeeNotification(desk, analytics), 'data user does not see desk operator actions');
assert(
  userCanSeeNotification({ type: 'calendar_request', target_user_email: analytics.email, target_role: '', dismissed_by: [] }, analytics),
  'data user sees own calendar request'
);
assert(
  !userCanSeeNotification({ type: 'calendar_request', target_user_email: remote.email, target_role: '', dismissed_by: [] }, analytics),
  'data user does not see others calendar requests'
);

assert(
  notificationDedupeKey({ notification_key: 'schedule:abc:maya.chen@example.com' }) === 'schedule:abc',
  'dedupe strips operator email suffix'
);

console.log('notificationVisibility.test.js: ok');
