import { migrate, db, setSetting, newId, todayStr } from './db.js';
import { hashPassword } from './middleware/auth.js';

function addDays(base, days) {
  const d = new Date(`${base}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function seedIfEmpty() {
  migrate();
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (count > 0) return;
  seed({ force: false });
}

export function seed({ force = false } = {}) {
  migrate();
  if (force) {
    db.exec(`
      DELETE FROM payment_line_overrides; DELETE FROM payment_records;
      DELETE FROM notifications; DELETE FROM assignment_audit; DELETE FROM assignments;
      DELETE FROM shoot_status_events; DELETE FROM shoots; DELETE FROM operator_availability;
      DELETE FROM standby_days; DELETE FROM user_presence; DELETE FROM rigs; DELETE FROM settings; DELETE FROM users;
    `);
  } else if (db.prepare('SELECT COUNT(*) AS c FROM users').get().c > 0) {
    return;
  }

  const password = hashPassword('rom123');
  const adminId = newId();
  const op1 = newId();
  const op2 = newId();
  const accountsId = newId();

  const ins = db.prepare(`
    INSERT INTO users (id, email, password_hash, full_name, role, active)
    VALUES (?, ?, ?, ?, ?, 1)
  `);
  ins.run(adminId, 'admin@rom.demo', password, 'Alex Admin', 'admin');
  ins.run(op1, 'operator@rom.demo', password, 'Jordan Operator', 'operator');
  ins.run(op2, 'operator2@rom.demo', password, 'Riley Cam', 'operator');
  ins.run(accountsId, 'accounts@rom.demo', password, 'Casey Accounts', 'accounts');

  setSetting('application_name', 'Remote Ops Manager');
  setSetting('currency', 'ZAR');
  setSetting('base_rate', 1000);
  setSetting('additional_rate', 250);
  setSetting('pre_approved_limit', 6);
  setSetting('auto_pair_teams', ['Reds', 'Red Sox', 'Rangers']);
  setSetting('auto_pair_window_minutes', 120);
  setSetting('notification_lead_hours', 48);

  const rigIns = db.prepare(`
    INSERT INTO rigs (id, name, team_name, venue_type, shoot_type, recipe_json, active)
    VALUES (?, ?, ?, ?, ?, ?, 1)
  `);
  const teams = [
    { team: 'Reds', venue: 'Outdoor', type: 'Data/Fancam' },
    { team: 'Red Sox', venue: 'Outdoor', type: 'Data/Fancam' },
    { team: 'Rangers', venue: 'Outdoor', type: 'Data' },
    { team: 'Lakers', venue: 'Arena', type: 'Data/Fancam' },
    { team: 'Knicks', venue: 'Arena', type: 'Data' },
  ];
  const rigIds = {};
  for (const t of teams) {
    const id = newId();
    rigIds[t.team] = id;
    rigIns.run(
      id,
      `${t.team} House`,
      t.team,
      t.venue,
      t.type,
      JSON.stringify({
        sport: t.venue === 'Arena' ? 'NBA' : 'MLB',
        shootPlan: `${t.team} remote package`,
        remoteRigs: [`${t.team}-CAM-1`, `${t.team}-CAM-2`],
        dataEnabled: true,
        dataHd: { shutter: '1/1000', aperture: 'f/4', iso: '800' },
        dataWide: { shutter: '1/500', aperture: 'f/2.8', iso: '1600' },
        attentionEnabled: t.type.includes('Fancam'),
        attentionHd: { shutter: '1/1000', aperture: 'f/4', iso: '800' },
        soundEnabled: false,
        notes: `Default ${t.team} house settings`,
      })
    );
  }

  const today = todayStr();
  const shootIns = db.prepare(`
    INSERT INTO shoots (
      id, title, team_name, opponent, date, setup_time, game_time, expected_end_time,
      venue, shoot_type, rig_id, status, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const schedule = [
    { team: 'Reds', opp: 'Guardians', venue: 'Progressive Field', day: 0, setup: '16:40', game: '19:10', status: 'scheduled' },
    { team: 'Red Sox', opp: 'Yankees', venue: 'Yankee Stadium', day: 0, setup: '16:35', game: '19:05', status: 'scheduled' },
    { team: 'Rangers', opp: 'Astros', venue: 'Minute Maid Park', day: 0, setup: '17:40', game: '20:10', status: 'scheduled' },
    { team: 'Lakers', opp: 'Suns', venue: 'Footprint Center', day: 0, setup: '18:30', game: '21:00', status: 'scheduled' },
    { team: 'Knicks', opp: 'Nets', venue: 'Barclays Center', day: 0, setup: '17:00', game: '19:30', status: 'scheduled' },
    { team: 'Reds', opp: 'Tigers', venue: 'Comerica Park', day: 1, setup: '16:10', game: '18:40', status: 'scheduled' },
    { team: 'Red Sox', opp: 'Orioles', venue: 'Camden Yards', day: 1, setup: '16:35', game: '19:05', status: 'scheduled' },
    { team: 'Lakers', opp: 'Warriors', venue: 'Chase Center', day: 2, setup: '17:30', game: '20:00', status: 'scheduled' },
    { team: 'Rangers', opp: 'Mariners', venue: 'T-Mobile Park', day: 2, setup: '16:10', game: '18:40', status: 'scheduled' },
    { team: 'Knicks', opp: 'Celtics', venue: 'TD Garden', day: 3, setup: '17:00', game: '19:30', status: 'scheduled' },
    { team: 'Reds', opp: 'Cubs', venue: 'Wrigley Field', day: -2, setup: '16:50', game: '19:20', status: 'completed' },
    { team: 'Lakers', opp: 'Clippers', venue: 'Crypto.com Arena', day: -1, setup: '17:30', game: '20:00', status: 'completed' },
  ];

  const created = [];
  for (const s of schedule) {
    const id = newId();
    const date = addDays(today, s.day);
    shootIns.run(
      id,
      `${s.team} @ ${s.opp}`,
      s.team,
      s.opp,
      date,
      s.setup,
      s.game,
      null,
      s.venue,
      'Data/Fancam',
      rigIds[s.team],
      s.status,
      adminId
    );
    created.push({ ...s, id, date });
  }

  // Assign operator to today's Reds + past completed (for pay)
  const asg = db.prepare(`
    INSERT INTO assignments (
      id, shoot_id, operator_id, status, source, is_pre_approved, is_additional, assigned_by, created_at, updated_at
    ) VALUES (?, ?, ?, 'assigned', 'admin', ?, 0, ?, datetime('now'), datetime('now'))
  `);

  const redsToday = created.find((s) => s.team === 'Reds' && s.day === 0);
  if (redsToday) {
    asg.run(newId(), redsToday.id, op1, 1, adminId);
    // Also assign admin to reds for admin dashboard focus
    asg.run(newId(), redsToday.id, adminId, 1, adminId);
  }
  for (const s of created.filter((x) => x.day < 0)) {
    asg.run(newId(), s.id, op1, 1, adminId);
  }

  // Standby: admin on duty today through tomorrow
  db.prepare(`
    INSERT INTO standby_days (
      id, start_date, start_time, end_date, end_time,
      admin_id, admin_email, admin_name, notes, created_by, created_at, updated_at
    ) VALUES (?, ?, '08:00', ?, '23:59', ?, 'admin@rom.demo', 'Alex Admin', 'Seeded standby window', ?, datetime('now'), datetime('now'))
  `).run(newId(), today, addDays(today, 1), adminId, adminId);

  console.log('ROM demo seed complete.');
  console.log('  admin@rom.demo / rom123   (Admin)');
  console.log('  operator@rom.demo / rom123 (Remote)');
  console.log('  accounts@rom.demo / rom123 (Account)');
}

if (process.argv[1]?.endsWith('seed.js')) {
  seed({ force: true });
}
