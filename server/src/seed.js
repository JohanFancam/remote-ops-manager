import { migrate, db, setSetting } from './db.js';
import { hashPassword } from './middleware/auth.js';
import { addAssignment } from './services/domain.js';

function addDays(base, days) {
  const d = new Date(`${base}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function seedIfEmpty() {
  migrate();
  const count = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;
  if (count > 0) return;
  seed();
}

export function seed({ force = false } = {}) {
  migrate();
  if (force) {
    db.exec(`
      DELETE FROM pay_records;
      DELETE FROM shoot_phases;
      DELETE FROM shoot_assignments;
      DELETE FROM shoots;
      DELETE FROM rig_tests;
      DELETE FROM standby_windows;
      DELETE FROM rig_settings;
      DELETE FROM settings;
      DELETE FROM users;
    `);
  }

  const password = hashPassword('cueboard123');

  const users = [
    { id: crypto.randomUUID(), email: 'admin@cueboard.demo', name: 'Alex Admin', role: 'admin' },
    { id: crypto.randomUUID(), email: 'standby@cueboard.demo', name: 'Sam Standby', role: 'standby' },
    { id: crypto.randomUUID(), email: 'accounts@cueboard.demo', name: 'Casey Accounts', role: 'accounts' },
    { id: crypto.randomUUID(), email: 'operator@cueboard.demo', name: 'Jordan Operator', role: 'user' },
    { id: crypto.randomUUID(), email: 'operator2@cueboard.demo', name: 'Riley Cam', role: 'user' },
  ];

  const insertUser = db.prepare(`
    INSERT INTO users (id, email, password_hash, full_name, role)
    VALUES (?, ?, ?, ?, ?)
  `);
  for (const u of users) {
    insertUser.run(u.id, u.email, password, u.name, u.role);
  }

  setSetting('auto_assign_teams', ['Reds', 'Red Sox', 'Rangers']);
  setSetting('auto_assign_window_minutes', 120);
  setSetting('base_rate', 1000);
  setSetting('additional_rate', 250);
  setSetting('phase_messages', {
    setup_complete: 'Setup complete for {team}',
    pre_shoot_started: 'Pre-shoot started — {team}',
    attention_started: 'Attention rolling — {team}',
    sound_started: 'Sound live — {team}',
    shoot_complete: 'Shoot complete — {team}',
  });

  const rigInsert = db.prepare(`
    INSERT INTO rig_settings (
      id, team, venue_type, sport, rig_type, shoot_plan, remote_rigs,
      data_enabled, data_hd, data_wide_enabled, data_wide,
      attention_enabled, attention_hd, sound_enabled, notes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, 1, ?, ?, ?, ?, ?)
  `);

  const teams = [
    {
      team: 'Reds',
      venue: 'Outdoor',
      sport: 'MLB',
      attention: 1,
      sound: 1,
      plan: 'Centerfield data + first-base fancam',
      hd: { shutter: '1/1000', aperture: 'f/4', iso: '800' },
      wide: { shutter: '1/500', aperture: 'f/2.8', iso: '400' },
    },
    {
      team: 'Red Sox',
      venue: 'Outdoor',
      sport: 'MLB',
      attention: 1,
      sound: 0,
      plan: 'Plate angle data, night fancam ready',
      hd: { shutter: '1/800', aperture: 'f/3.5', iso: '1000' },
      wide: { shutter: '1/400', aperture: 'f/2.8', iso: '640' },
    },
    {
      team: 'Rangers',
      venue: 'Outdoor',
      sport: 'MLB',
      attention: 0,
      sound: 1,
      plan: 'Dual data sticks on RF corner',
      hd: { shutter: '1/1000', aperture: 'f/4', iso: '640' },
      wide: { shutter: '1/500', aperture: 'f/2.8', iso: '400' },
    },
    {
      team: 'Lakers',
      venue: 'Arena',
      sport: 'NBA',
      attention: 1,
      sound: 1,
      plan: 'Baseline data / crowd fancam',
      hd: { shutter: '1/500', aperture: 'f/2.8', iso: '1600' },
      wide: { shutter: '1/250', aperture: 'f/2', iso: '1250' },
    },
    {
      team: 'Knicks',
      venue: 'Arena',
      sport: 'NBA',
      attention: 0,
      sound: 0,
      plan: 'Tunnel exit data only',
      hd: { shutter: '1/500', aperture: 'f/2.8', iso: '2000' },
      wide: { shutter: '1/250', aperture: 'f/2', iso: '1600' },
    },
  ];

  for (const t of teams) {
    rigInsert.run(
      crypto.randomUUID(),
      t.team,
      t.venue,
      t.sport,
      'Data/Fancam',
      t.plan,
      JSON.stringify([`${t.team}-Remote-A`, `${t.team}-Remote-B`]),
      JSON.stringify(t.hd),
      JSON.stringify(t.wide),
      t.attention,
      JSON.stringify({ shutter: '1/250', aperture: 'f/2.8', iso: '800' }),
      t.sound,
      `${t.team} house look — cool white balance`
    );
  }

  const today = todayStr();
  const shootInsert = db.prepare(`
    INSERT INTO shoots (
      id, title, client, location, date, game_time, status, notes, standby_admin
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const schedule = [
    // Today — operator focus
    { title: 'Reds @ Guardians', client: 'Reds', location: 'Progressive Field', day: 0, time: '19:10', status: 'confirmed' },
    { title: 'Red Sox @ Yankees', client: 'Red Sox', location: 'Yankee Stadium', day: 0, time: '19:05', status: 'confirmed' },
    { title: 'Lakers @ Suns', client: 'Lakers', location: 'Footprint Center', day: 0, time: '21:00', status: 'upcoming' },
    { title: 'Knicks @ Nets', client: 'Knicks', location: 'Barclays Center', day: 0, time: '19:30', status: 'upcoming' },
    // Pair candidate for Reds
    { title: 'Rangers @ Astros', client: 'Rangers', location: 'Minute Maid Park', day: 0, time: '20:10', status: 'upcoming' },
    // Rest of week
    { title: 'Reds @ Tigers', client: 'Reds', location: 'Comerica Park', day: 1, time: '18:40', status: 'upcoming' },
    { title: 'Red Sox @ Orioles', client: 'Red Sox', location: 'Camden Yards', day: 1, time: '19:05', status: 'upcoming' },
    { title: 'Lakers @ Warriors', client: 'Lakers', location: 'Chase Center', day: 2, time: '20:00', status: 'upcoming' },
    { title: 'Rangers @ Mariners', client: 'Rangers', location: 'T-Mobile Park', day: 2, time: '18:40', status: 'upcoming' },
    { title: 'Knicks @ Celtics', client: 'Knicks', location: 'TD Garden', day: 3, time: '19:30', status: 'upcoming' },
    { title: 'Reds @ Brewers', client: 'Reds', location: 'American Family Field', day: 3, time: '19:10', status: 'upcoming' },
    { title: 'Red Sox @ Rays', client: 'Red Sox', location: 'Tropicana Field', day: 4, time: '18:40', status: 'upcoming' },
    { title: 'Lakers @ Nuggets', client: 'Lakers', location: 'Ball Arena', day: 5, time: '21:00', status: 'upcoming' },
    { title: 'Rangers @ Angels', client: 'Rangers', location: 'Angel Stadium', day: 5, time: '18:38', status: 'upcoming' },
    { title: 'Knicks @ Heat', client: 'Knicks', location: 'Kaseya Center', day: 6, time: '19:00', status: 'upcoming' },
    // Past completed for pay demo
    { title: 'Reds @ Cubs', client: 'Reds', location: 'Wrigley Field', day: -2, time: '19:20', status: 'completed' },
    { title: 'Red Sox @ Blue Jays', client: 'Red Sox', location: 'Rogers Centre', day: -2, time: '19:07', status: 'completed' },
    { title: 'Lakers @ Clippers', client: 'Lakers', location: 'Crypto.com Arena', day: -1, time: '20:00', status: 'completed' },
  ];

  const created = [];
  for (const s of schedule) {
    const id = crypto.randomUUID();
    const date = addDays(today, s.day);
    shootInsert.run(
      id,
      s.title,
      s.client,
      s.location,
      date,
      s.time,
      s.status,
      null,
      'standby@cueboard.demo'
    );
    created.push({ ...s, id, date });
  }

  const op = 'operator@cueboard.demo';
  const redsToday = created.find((s) => s.client === 'Reds' && s.day === 0);
  if (redsToday) {
    addAssignment(redsToday.id, op, 'assigned');
    addAssignment(redsToday.id, op, 'pre_approved');
  }

  const past = created.filter((s) => s.day < 0);
  for (const s of past) {
    addAssignment(s.id, op, 'assigned');
    addAssignment(s.id, op, 'pre_approved');
  }

  // Fill operator2 toward the 6-cap (leave Rangers today open for auto-pair demo)
  const op2 = 'operator2@cueboard.demo';
  const forOp2 = created
    .filter(
      (s) =>
        s.day >= 0 &&
        !(s.client === 'Reds' && s.day === 0) &&
        s.client !== 'Knicks' &&
        !(s.client === 'Rangers' && s.day === 0) &&
        !(s.client === 'Red Sox' && s.day === 0)
    )
    .slice(0, 7);
  forOp2.forEach((s, i) => {
    if (i < 6) {
      addAssignment(s.id, op2, 'assigned');
      addAssignment(s.id, op2, 'pre_approved');
    } else {
      addAssignment(s.id, op2, 'pending');
    }
  });

  db.prepare(`
    INSERT INTO standby_windows (id, start_date, start_time, end_date, end_time, admin_email, admin_name, notes)
    VALUES (?, ?, '08:00', ?, '08:00', ?, ?, ?)
  `).run(
    crypto.randomUUID(),
    today,
    addDays(today, 2),
    'standby@cueboard.demo',
    'Sam Standby',
    'Primary standby window'
  );

  db.prepare(`
    INSERT INTO rig_tests (id, title, scheduled_date, due_date, assigned_to, assigned_name, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)
  `).run(
    crypto.randomUUID(),
    'Weekly Remote Rig Sweep',
    today,
    addDays(today, 1),
    'standby@cueboard.demo',
    'Sam Standby',
    'Focus on MLB outdoor units'
  );

  const phaseStmt = db.prepare(`
    INSERT INTO shoot_phases (shoot_id, phase, completed_at, completed_by)
    VALUES (?, ?, ?, ?)
  `);
  for (const s of past) {
    for (const phase of ['setup_complete', 'pre_shoot_started', 'shoot_complete']) {
      phaseStmt.run(s.id, phase, new Date().toISOString(), op);
    }
  }

  console.log('Cueboard demo seed complete.');
  console.log('  admin@cueboard.demo / cueboard123');
  console.log('  operator@cueboard.demo / cueboard123');
  console.log('  standby@cueboard.demo / cueboard123');
  console.log('  accounts@cueboard.demo / cueboard123');
}

const isDirect = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'));
if (isDirect || process.argv[1]?.endsWith('seed.js')) {
  seed({ force: true });
}
