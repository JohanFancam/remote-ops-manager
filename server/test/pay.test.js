import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rom-pay-'));
process.env.ROM_DB = path.join(dir, 'pay.db');

const dbMod = await import('../src/db.js');
const { hashPassword } = await import('../src/middleware/auth.js');
const asg = await import('../src/services/assignments.js');
const pay = await import('../src/services/pay.js');
const { roleHas, PERMISSIONS, ROLES } = await import('../src/permissions.js');

const { migrate, setSetting, newId, db } = dbMod;

function reset() {
  db.exec(`
    DELETE FROM notifications; DELETE FROM assignment_audit; DELETE FROM assignments;
    DELETE FROM shoot_status_events; DELETE FROM shoots; DELETE FROM operator_availability;
    DELETE FROM payment_line_overrides; DELETE FROM payment_records;
    DELETE FROM settings; DELETE FROM users; DELETE FROM rigs; DELETE FROM user_presence;
  `);
}

function seed() {
  const pw = hashPassword('rom123');
  const adminId = newId();
  const op1 = newId();
  const accountsId = newId();
  const ins = db.prepare(
    `INSERT INTO users (id, email, password_hash, full_name, role, active) VALUES (?,?,?,?,?,1)`
  );
  ins.run(adminId, 'admin@t.test', pw, 'Admin', 'admin');
  ins.run(op1, 'op1@t.test', pw, 'Op One', 'operator');
  ins.run(accountsId, 'acc@t.test', pw, 'Accounts', 'accounts');
  setSetting('base_rate', 1000);
  setSetting('additional_rate', 250);
  setSetting('currency', 'ZAR');
  setSetting('pre_approved_limit', 6);
  setSetting('auto_pair_teams', ['Reds', 'Red Sox', 'Rangers']);
  setSetting('auto_pair_window_minutes', 120);
  return { adminId, op1, accountsId };
}

function shoot(teamName, date, gameTime = '19:00') {
  const sid = newId();
  db.prepare(`
    INSERT INTO shoots (id, title, team_name, date, setup_time, game_time, venue, shoot_type, status)
    VALUES (?, ?, ?, ?, '16:30', ?, 'Park', 'Data', 'scheduled')
  `).run(sid, `${teamName} Game`, teamName, date, gameTime);
  return sid;
}

function monthOf(date) {
  return date.slice(0, 7);
}

migrate();

describe('payment & access', () => {
  beforeEach(() => {
    reset();
  });

  it('accounts cannot access admin routes (permission)', () => {
    assert.equal(roleHas(ROLES.ACCOUNTS, PERMISSIONS.DASHBOARD_OPS), false);
    assert.equal(roleHas(ROLES.ACCOUNTS, PERMISSIONS.USER_MANAGE), false);
  });

  it('operator cannot access accounts settle', () => {
    assert.equal(roleHas(ROLES.OPERATOR, PERMISSIONS.DASHBOARD_ACCOUNTS), false);
    assert.equal(roleHas(ROLES.OPERATOR, PERMISSIONS.PAY_SETTLE), false);
  });

  it('admin can view payments but cannot mark paid', () => {
    assert.equal(roleHas(ROLES.ADMIN, PERMISSIONS.PAY_VIEW_ALL), true);
    assert.equal(roleHas(ROLES.ADMIN, PERMISSIONS.PAY_SETTLE), false);
    const ids = seed();
    const date = new Date().toISOString().slice(0, 10);
    const sid = shoot('Lakers', date);
    asg.adminAssign({ shootId: sid, operatorId: ids.op1, adminId: ids.adminId, override: true });
    assert.throws(
      () =>
        pay.markMonthPaid({
          operatorId: ids.op1,
          month: monthOf(date),
          actorId: ids.adminId,
          paidDate: date,
        }),
      (err) => err.status === 403
    );
  });

  it('accounts marks an operator paid with a custom date', () => {
    const ids = seed();
    const date = new Date().toISOString().slice(0, 10);
    const sid = shoot('Lakers', date);
    asg.adminAssign({ shootId: sid, operatorId: ids.op1, adminId: ids.adminId, override: true });
    const custom = '2026-07-01';
    const dash = pay.markMonthPaid({
      operatorId: ids.op1,
      month: monthOf(date),
      actorId: ids.accountsId,
      paidDate: custom,
    });
    const row = dash.operators.find((o) => o.operatorId === ids.op1);
    assert.equal(row.paid, true);
    assert.equal(row.paidDate, custom);
    assert.equal(row.amount, 1000);
  });

  it('preserves finalised amount after rate change', () => {
    const ids = seed();
    const date = new Date().toISOString().slice(0, 10);
    const sid = shoot('Lakers', date);
    asg.adminAssign({ shootId: sid, operatorId: ids.op1, adminId: ids.adminId, override: true });
    pay.markMonthPaid({
      operatorId: ids.op1,
      month: monthOf(date),
      actorId: ids.accountsId,
      paidDate: date,
    });
    setSetting('base_rate', 9999);
    const earnings = pay.getOperatorEarnings(ids.op1, monthOf(date));
    assert.equal(earnings.total, 1000);
    assert.equal(earnings.paid, true);
  });

  it('paired shoot counts as additional fee', () => {
    const ids = seed();
    const date = new Date().toISOString().slice(0, 10);
    const sox = shoot('Red Sox', date, '19:00');
    shoot('Rangers', date, '20:00');
    asg.selfAssign({ operatorId: ids.op1, shootId: sox, actorId: ids.op1 });
    const calc = pay.calculateOperatorMonth(ids.op1, monthOf(date));
    assert.equal(calc.shootCount, 2);
    assert.equal(calc.total, 1250); // 1000 + 250
  });

  it('csv export escapes fields and names file correctly', () => {
    const ids = seed();
    const date = new Date().toISOString().slice(0, 10);
    db.prepare(`UPDATE users SET full_name = ? WHERE id = ?`).run('Op, "One"', ids.op1);
    const sid = shoot('Lakers', date);
    asg.adminAssign({ shootId: sid, operatorId: ids.op1, adminId: ids.adminId, override: true });
    const { filename, content } = pay.exportMonthCsv(monthOf(date));
    assert.equal(filename, `Earnings_${monthOf(date)}.csv`);
    assert.match(content, /"Op, ""One""/);
  });
});
