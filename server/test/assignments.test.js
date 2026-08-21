import { describe, it, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

// Isolate DB before importing app modules
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rom-asg-'));
process.env.ROM_DB = path.join(dir, 'test.db');

const dbMod = await import('../src/db.js');
const { hashPassword } = await import('../src/middleware/auth.js');
const asg = await import('../src/services/assignments.js');
const { roleHas, PERMISSIONS, ROLES, homePathForRole } = await import('../src/permissions.js');

const { migrate, setSetting, newId, db } = dbMod;

function reset() {
  db.exec(`
    DELETE FROM notifications; DELETE FROM assignment_audit; DELETE FROM assignments;
    DELETE FROM shoot_status_events; DELETE FROM shoots; DELETE FROM operator_availability;
    DELETE FROM payment_line_overrides; DELETE FROM payment_records;
    DELETE FROM settings; DELETE FROM users; DELETE FROM rigs; DELETE FROM user_presence;
  `);
}

function seedUsers() {
  const pw = hashPassword('rom123');
  const adminId = newId();
  const op1 = newId();
  const op2 = newId();
  const accountsId = newId();
  const ins = db.prepare(
    `INSERT INTO users (id, email, password_hash, full_name, role, active) VALUES (?,?,?,?,?,1)`
  );
  ins.run(adminId, 'admin@t.test', pw, 'Admin', 'admin');
  ins.run(op1, 'op1@t.test', pw, 'Op One', 'operator');
  ins.run(op2, 'op2@t.test', pw, 'Op Two', 'operator');
  ins.run(accountsId, 'acc@t.test', pw, 'Accounts', 'accounts');
  setSetting('pre_approved_limit', 6);
  setSetting('auto_pair_teams', ['Reds', 'Red Sox', 'Rangers']);
  setSetting('auto_pair_window_minutes', 120);
  setSetting('base_rate', 1000);
  setSetting('additional_rate', 250);
  return { adminId, op1, op2, accountsId };
}

function shoot({ teamName, title, date, gameTime = '19:00', id }) {
  const sid = id || newId();
  db.prepare(`
    INSERT INTO shoots (id, title, team_name, date, setup_time, game_time, venue, shoot_type, status)
    VALUES (?, ?, ?, ?, '16:30', ?, 'Park', 'Data', 'scheduled')
  `).run(sid, title || `${teamName} Game`, teamName, date, gameTime);
  return sid;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}
function addDays(base, n) {
  const d = new Date(`${base}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

migrate();

describe('permissions', () => {
  it('maps routes by role', () => {
    assert.equal(homePathForRole('admin'), '/dashboard');
    assert.equal(homePathForRole('operator'), '/dashboard');
    assert.equal(homePathForRole('user'), '/dashboard');
    assert.equal(homePathForRole('accounts'), '/accounts');
  });

  it('denies accounts from ops and operator from settle', () => {
    assert.equal(roleHas(ROLES.ACCOUNTS, PERMISSIONS.DASHBOARD_OPS), false);
    assert.equal(roleHas(ROLES.ACCOUNTS, PERMISSIONS.CALENDAR_OPS), false);
    assert.equal(roleHas(ROLES.OPERATOR, PERMISSIONS.PAY_SETTLE), false);
    assert.equal(roleHas(ROLES.ADMIN, PERMISSIONS.PAY_SETTLE), false);
    assert.equal(roleHas(ROLES.ACCOUNTS, PERMISSIONS.PAY_SETTLE), true);
  });
});

describe('assignment rules', () => {
  let ids;

  beforeEach(() => {
    reset();
    ids = seedUsers();
  });

  it('assigns directly when operator is below the six-assignment limit', () => {
    const date = addDays(today(), 1);
    const sid = shoot({ teamName: 'Lakers', date, gameTime: '20:00' });
    const result = asg.selfAssign({ operatorId: ids.op1, shootId: sid, actorId: ids.op1 });
    assert.equal(result.status, 'assigned');
    assert.equal(result.preApprovedCount, 1);
  });

  it('goes pending when operator is at the six-assignment limit', () => {
    const base = today();
    for (let i = 0; i < 6; i++) {
      const sid = shoot({ teamName: 'Lakers', date: addDays(base, i + 1), gameTime: '19:00' });
      const r = asg.selfAssign({ operatorId: ids.op1, shootId: sid, actorId: ids.op1 });
      assert.equal(r.status, 'assigned');
    }
    const sid7 = shoot({ teamName: 'Knicks', date: addDays(base, 10), gameTime: '19:00' });
    const r7 = asg.selfAssign({ operatorId: ids.op1, shootId: sid7, actorId: ids.op1 });
    assert.equal(r7.status, 'pending');
    assert.match(r7.reason, /limit/i);
  });

  it('pairs Red Sox and Rangers', () => {
    const date = addDays(today(), 2);
    const sox = shoot({ teamName: 'Red Sox', date, gameTime: '19:05' });
    const rangers = shoot({ teamName: 'Rangers', date, gameTime: '20:10' });
    const result = asg.selfAssign({ operatorId: ids.op1, shootId: sox, actorId: ids.op1 });
    assert.equal(result.status, 'assigned');
    assert.equal(result.paired?.id, rangers);
  });

  it('pairs Reds and Rangers', () => {
    const date = addDays(today(), 2);
    const reds = shoot({ teamName: 'Reds', date, gameTime: '19:10' });
    const rangers = shoot({ teamName: 'Rangers', date, gameTime: '20:10' });
    const result = asg.selfAssign({ operatorId: ids.op1, shootId: reds, actorId: ids.op1 });
    assert.equal(result.paired?.id, rangers);
  });

  it('priority pair with Charlotte present — pairs priorities, leaves Charlotte', () => {
    const date = addDays(today(), 3);
    const sox = shoot({ teamName: 'Red Sox', date, gameTime: '19:00' });
    const rangers = shoot({ teamName: 'Rangers', date, gameTime: '19:30' });
    const charlotte = shoot({ teamName: 'Charlotte', date, gameTime: '19:15' });
    const result = asg.selfAssign({ operatorId: ids.op1, shootId: sox, actorId: ids.op1 });
    assert.equal(result.paired?.id, rangers);
    const onCharlotte = db.prepare(
      `SELECT * FROM assignments WHERE shoot_id = ? AND operator_id = ?`
    ).get(charlotte, ids.op1);
    assert.equal(onCharlotte, undefined);
  });

  it('priority pair with Mariners present', () => {
    const date = addDays(today(), 3);
    const reds = shoot({ teamName: 'Reds', date, gameTime: '19:00' });
    const rangers = shoot({ teamName: 'Rangers', date, gameTime: '19:40' });
    shoot({ teamName: 'Mariners', date, gameTime: '19:20' });
    const result = asg.selfAssign({ operatorId: ids.op1, shootId: reds, actorId: ids.op1 });
    assert.equal(result.paired?.id, rangers);
  });

  it('does not fail when partner shoot already assigned — assigns selected only', () => {
    const date = addDays(today(), 4);
    const sox = shoot({ teamName: 'Red Sox', date, gameTime: '19:00' });
    const rangers = shoot({ teamName: 'Rangers', date, gameTime: '19:30' });
    asg.adminAssign({ shootId: rangers, operatorId: ids.op2, adminId: ids.adminId, override: true });
    const result = asg.selfAssign({ operatorId: ids.op1, shootId: sox, actorId: ids.op1 });
    assert.equal(result.status, 'assigned');
    assert.equal(result.paired, null);
  });

  it('does not pair when partner already pending', () => {
    for (let i = 0; i < 6; i++) {
      asg.selfAssign({
        operatorId: ids.op2,
        shootId: shoot({ teamName: 'Lakers', date: addDays(today(), 20 + i), gameTime: '19:00' }),
        actorId: ids.op2,
      });
    }
    const date = addDays(today(), 4);
    // Pending on Rangers first — before partner shoot exists
    const rangers = shoot({ teamName: 'Rangers', date, gameTime: '19:30' });
    const pending = asg.selfAssign({ operatorId: ids.op2, shootId: rangers, actorId: ids.op2 });
    assert.equal(pending.status, 'pending');
    const sox = shoot({ teamName: 'Red Sox', date, gameTime: '19:00' });
    const result = asg.selfAssign({ operatorId: ids.op1, shootId: sox, actorId: ids.op1 });
    assert.equal(result.status, 'assigned');
    assert.equal(result.paired, null);
  });

  it('pair selected in either direction produces same group', () => {
    const date = addDays(today(), 5);
    const sox = shoot({ teamName: 'Red Sox', date, gameTime: '19:00' });
    const rangers = shoot({ teamName: 'Rangers', date, gameTime: '20:00' });

    const a = asg.selfAssign({ operatorId: ids.op1, shootId: sox, actorId: ids.op1 });
    assert.equal(a.paired?.id, rangers);
    asg.withdraw({ shootId: sox, operatorId: ids.op1, actorId: ids.op1 });

    const b = asg.selfAssign({ operatorId: ids.op1, shootId: rangers, actorId: ids.op1 });
    assert.equal(b.paired?.id, sox);
  });

  it('withdrawal from a paired assignment removes both', () => {
    const date = addDays(today(), 5);
    const sox = shoot({ teamName: 'Red Sox', date, gameTime: '19:00' });
    const rangers = shoot({ teamName: 'Rangers', date, gameTime: '20:00' });
    asg.selfAssign({ operatorId: ids.op1, shootId: sox, actorId: ids.op1 });
    const result = asg.withdraw({ shootId: sox, operatorId: ids.op1, actorId: ids.op1 });
    assert.ok(result.shootIds.includes(sox));
    assert.ok(result.shootIds.includes(rangers));
    const left = db.prepare(
      `SELECT COUNT(*) AS c FROM assignments WHERE operator_id = ? AND status IN ('assigned','pending')`
    ).get(ids.op1);
    assert.equal(left.c, 0);
  });

  it('admin manual assignment does not trigger pairing', () => {
    const date = addDays(today(), 6);
    const sox = shoot({ teamName: 'Red Sox', date, gameTime: '19:00' });
    shoot({ teamName: 'Rangers', date, gameTime: '20:00' });
    asg.adminAssign({ shootId: sox, operatorId: ids.op1, adminId: ids.adminId, override: true });
    const onRangers = db.prepare(
      `SELECT COUNT(*) AS c FROM assignments WHERE operator_id = ? AND status = 'assigned'`
    ).get(ids.op1);
    assert.equal(onRangers.c, 1);
  });

  it('approves paired pending requests together', () => {
    for (let i = 0; i < 6; i++) {
      asg.selfAssign({
        operatorId: ids.op1,
        shootId: shoot({ teamName: 'Lakers', date: addDays(today(), 30 + i) }),
        actorId: ids.op1,
      });
    }
    const date = addDays(today(), 8);
    const sox = shoot({ teamName: 'Red Sox', date, gameTime: '19:00' });
    const rangers = shoot({ teamName: 'Rangers', date, gameTime: '20:00' });
    const pending = asg.selfAssign({ operatorId: ids.op1, shootId: sox, actorId: ids.op1 });
    assert.equal(pending.status, 'pending');
    assert.ok(pending.paired);
    asg.approvePending({ shootId: sox, operatorId: ids.op1, adminId: ids.adminId });
    const both = db.prepare(
      `SELECT COUNT(*) AS c FROM assignments WHERE operator_id = ? AND status = 'assigned'
       AND shoot_id IN (?, ?)`
    ).get(ids.op1, sox, rangers);
    assert.equal(both.c, 2);
  });

  it('rejects paired pending requests together', () => {
    for (let i = 0; i < 6; i++) {
      asg.selfAssign({
        operatorId: ids.op1,
        shootId: shoot({ teamName: 'Lakers', date: addDays(today(), 40 + i) }),
        actorId: ids.op1,
      });
    }
    const date = addDays(today(), 9);
    const sox = shoot({ teamName: 'Red Sox', date, gameTime: '19:00' });
    const rangers = shoot({ teamName: 'Rangers', date, gameTime: '20:00' });
    asg.selfAssign({ operatorId: ids.op1, shootId: sox, actorId: ids.op1 });
    asg.rejectPending({ shootId: sox, operatorId: ids.op1, adminId: ids.adminId });
    const left = db.prepare(
      `SELECT COUNT(*) AS c FROM assignments WHERE operator_id = ? AND status = 'pending'
       AND shoot_id IN (?, ?)`
    ).get(ids.op1, sox, rangers);
    assert.equal(left.c, 0);
  });

  it('blocks self-assign when operator marked unavailable', () => {
    const date = addDays(today(), 2);
    db.prepare(
      `INSERT INTO operator_availability (id, operator_id, date, unavailable) VALUES (?,?,?,1)`
    ).run(newId(), ids.op1, date);
    const sid = shoot({ teamName: 'Lakers', date });
    assert.throws(
      () => asg.selfAssign({ operatorId: ids.op1, shootId: sid, actorId: ids.op1 }),
      (err) => err.code === 'UNAVAILABLE'
    );
  });
});
