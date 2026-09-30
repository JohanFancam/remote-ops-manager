import { userCanSeeNotification, OPERATOR_PERSONAL_TYPES } from './notificationVisibility.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const remote = { email: 'maya.chen@example.com', role: 'user' };
const standby = { email: 'priya.nair@example.com', role: 'standby', standby: true };
const admin = { email: 'admin@example.com', role: 'admin' };

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

console.log('notificationVisibility.test.js: ok');
