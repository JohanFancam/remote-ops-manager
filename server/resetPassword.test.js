import { db } from './db.js';
import {
  createUser,
  findUserByEmail,
  resetLoginPasswords,
  userMustChangePassword,
  verifyPassword,
} from './auth.js';

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

const stamp = Date.now();
const email = `pwreset-test-${stamp}@example.com`;
const inactiveEmail = `pwreset-inactive-${stamp}@example.com`;
const created = [];

try {
  const user = createUser({
    email,
    password: 'oldpass123',
    full_name: 'Reset Test User',
    role: 'user',
  });
  created.push(email);
  assert(user.email === email, 'created reset target');

  const inactive = createUser({
    email: inactiveEmail,
    password: 'oldpass123',
    full_name: 'Inactive Reset User',
    role: 'viewer',
    inactive: true,
  });
  created.push(inactiveEmail);
  assert(inactive.inactive === true, 'created inactive target');

  const none = resetLoginPasswords({ emails: [] });
  assert(none.issued.length === 0 && none.skipped.length === 0, 'empty emails issues nothing');

  const skippedInactive = resetLoginPasswords({ emails: [inactiveEmail] });
  assert(skippedInactive.issued.length === 0, 'inactive not issued');
  assert(skippedInactive.skipped[0]?.reason === 'inactive', 'inactive skipped');

  const missing = resetLoginPasswords({ emails: [`missing-${stamp}@example.com`] });
  assert(missing.issued.length === 0, 'unknown email not issued');
  assert(missing.skipped[0]?.reason === 'not_found', 'unknown email skipped');

  const result = resetLoginPasswords({ emails: [email] });
  assert(result.issued.length === 1, 'one password issued');
  assert(result.issued[0].email === email, 'issued for the chosen user');
  assert(typeof result.issued[0].password === 'string' && result.issued[0].password.length >= 8, 'temp password present');

  const row = findUserByEmail(email);
  assert(row, 'user still exists');
  assert(!verifyPassword('oldpass123', row.password_hash), 'old password no longer works');
  assert(verifyPassword(result.issued[0].password, row.password_hash), 'new password works');
  assert(userMustChangePassword(row), 'must change generated password');

  console.log('resetPassword.test.js: ok');
} finally {
  for (const value of created) {
    db.prepare('DELETE FROM users WHERE lower(email) = lower(?)').run(value);
  }
}
