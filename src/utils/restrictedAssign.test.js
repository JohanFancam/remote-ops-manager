import assert from 'node:assert/strict';
import {
  parseRestrictedAssignTeams,
  shootMatchesRestrictedAssign,
  isRemoteAssignRestricted,
  isRemoteAssignBlocked,
  canRoleTakeRestrictedShoot,
  RESTRICTED_ASSIGN_TEAMS_KEY,
} from './restrictedAssign.js';

const settings = [{ key: RESTRICTED_ASSIGN_TEAMS_KEY, value: JSON.stringify(['PSG', 'Manual extra']) }];

assert.deepEqual(parseRestrictedAssignTeams(settings), ['PSG', 'Manual extra']);
assert.deepEqual(parseRestrictedAssignTeams([]), []);
assert.equal(shootMatchesRestrictedAssign({ title: 'PSG vs Lyon' }, ['PSG']), true);
assert.equal(shootMatchesRestrictedAssign({ title: 'Paris Saint-Germain vs Lyon', client: 'PSG' }, ['PSG']), true);
assert.equal(shootMatchesRestrictedAssign({ title: 'Chelsea vs Arsenal' }, ['PSG']), false);
assert.equal(isRemoteAssignRestricted({ title: 'PSG vs Lyon' }, settings), true);
assert.equal(isRemoteAssignRestricted({ title: 'Chelsea vs Arsenal' }, settings), false);
assert.equal(isRemoteAssignBlocked({ title: 'PSG vs Lyon' }, { role: 'user' }, settings), true);
assert.equal(isRemoteAssignBlocked({ title: 'PSG vs Lyon' }, { role: 'standby' }, settings), false);
assert.equal(isRemoteAssignBlocked({ title: 'PSG vs Lyon' }, { role: 'admin' }, settings), false);
assert.equal(canRoleTakeRestrictedShoot('user', { title: 'PSG vs Lyon' }, settings), false);
assert.equal(canRoleTakeRestrictedShoot('standby', { title: 'PSG vs Lyon' }, settings), true);
assert.equal(canRoleTakeRestrictedShoot('admin', { title: 'PSG vs Lyon' }, settings), true);

console.log('restrictedAssign.test.js: ok');
