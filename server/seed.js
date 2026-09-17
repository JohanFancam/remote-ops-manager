/**
 * Demo seed modeled on a typical Base44 Remote Ops Manager dataset:
 * multi-role crew, venue rig profiles, calendar shoots, standby windows,
 * rig tests, payments, and presence — so the UI is reviewable with real shape.
 */
import { findUserByEmail, createUser } from './auth.js';
import { listEntities, createEntity } from './entities.js';
import { db } from './db.js';

function addDays(base, days) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function ymd(d) {
  // Local calendar date (avoid UTC shifting the seed day for non-UTC timezones)
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function hm(hours, minutes = 0) {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

const CHECKLIST = [
  'Power on all rigs and confirm boot',
  'Check network / remote connectivity',
  'Verify camera feeds (HD + Wide)',
  'Test audio / sound recording',
  'Confirm rig type settings match team profile',
  'Review storage / SD cards',
  'Check battery levels',
];

const CAM = (shutter, aperture, iso) => ({ shutter, aperture, iso });

export const DEMO_SEED_DISABLED_KEY = 'demo_seed_disabled';

/**
 * Demo users/shoots are for evaluating the UI. Live installs disable them via
 * SEED_DEMO_DATA=false or the AppSettings marker written by clear-demo-data.
 */
export function isDemoSeedDisabled() {
  if (String(process.env.SEED_DEMO_DATA || '').toLowerCase() === 'false') return true;
  return listEntities('AppSettings').some(
    (s) => s.key === DEMO_SEED_DISABLED_KEY && String(s.value) === 'true'
  );
}

export function seedIfEmpty() {
  const demoDisabled = isDemoSeedDisabled();
  seedUsers(demoDisabled);
  seedSettings();
  if (!demoDisabled) seedDemoDataset();
}

function seedUsers(demoDisabled = false) {
  if (demoDisabled) {
    // Keep a way in if the database is brand new, but never recreate the demo crew
    const hasUsers = db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0;
    if (!hasUsers) {
      createUser({
        email: process.env.ADMIN_EMAIL || 'admin@example.com',
        password: process.env.ADMIN_PASSWORD || 'admin123',
        full_name: process.env.ADMIN_NAME || 'Admin User',
        role: 'admin',
        standby: true,
      });
      console.log('Seeded initial admin only (demo data disabled).');
    }
    return;
  }

  const roster = [
    { email: 'admin@example.com', password: process.env.ADMIN_PASSWORD || 'admin123', full_name: process.env.ADMIN_NAME || 'Admin User', role: 'admin', standby: true },
    { email: 'operator@example.com', password: 'operator123', full_name: 'Demo Operator', role: 'user' },
    { email: 'jordan.lee@example.com', password: 'operator123', full_name: 'Jordan Lee', role: 'user' },
    { email: 'sam.okonkwo@example.com', password: 'operator123', full_name: 'Sam Okonkwo', role: 'user' },
    { email: 'maya.chen@example.com', password: 'operator123', full_name: 'Maya Chen', role: 'user' },
    { email: 'priya.nair@example.com', password: 'standby123', full_name: 'Priya Nair', role: 'standby', standby: true },
    { email: 'accounts@example.com', password: 'accounts123', full_name: 'Accounts Desk', role: 'accounts' },
  ];

  for (const u of roster) {
    if (!findUserByEmail(u.email)) {
      createUser(u);
      console.log(`Seeded user: ${u.email} / ${u.password} (${u.role})`);
    }
  }
}

function seedSettings() {
  const settings = listEntities('AppSettings');
  const ensure = (key, value, description) => {
    if (!settings.find((s) => s.key === key)) {
      createEntity('AppSettings', { key, value, description });
    }
  };

  ensure('app_version', '1', 'App version — bump to notify users to refresh');
  ensure('notify_hours_before', '5', 'Hours before setup to notify operators');
  ensure('tutorial_admin', 'false', 'Show admin tutorial');
  ensure('tutorial_remote', 'false', 'Show remote tutorial');
  ensure('timezone', 'Africa/Johannesburg', 'Display timezone');
  ensure('currency', 'ZAR', 'Display currency (South African Rand)');
  ensure('day_rate', '850', 'Default day rate (ZAR)');
  ensure('base_rate', '1000', 'Operator base shoot rate (ZAR)');
  ensure('additional_rate', '250', 'Additional same-day shoot rate (ZAR)');
  ensure('postponed_rate', '250', 'Postponed shoot fee (ZAR)');
  ensure('rig_test_checklist', JSON.stringify(CHECKLIST), 'Default rig test checklist items');
  ensure(
    'auto_assign_teams',
    JSON.stringify(['Lakers', 'Celtics', 'Knicks', 'Warriors', 'Rangers', 'Maple Leafs']),
    'Teams eligible for auto-assign pairing'
  );
}

function seedDemoDataset() {
  // Only seed operational demo data once
  if (listEntities('Shoot').length > 0) {
    return;
  }

  console.log('Seeding demo ops dataset (shoots, rigs, standby, payments)…');

  const today = new Date();
  today.setHours(12, 0, 0, 0);

  const admin = 'admin@example.com';
  const ops = {
    demo: 'operator@example.com',
    jordan: 'jordan.lee@example.com',
    sam: 'sam.okonkwo@example.com',
    maya: 'maya.chen@example.com',
    priya: 'priya.nair@example.com',
  };

  // Pending invites
  createEntity('PendingUser', {
    email: 'alex.brooks@example.com',
    full_name: 'Alex Brooks',
    role: 'user',
    invited: false,
    notes: 'New remote hire — pending invite',
  });
  createEntity('PendingUser', {
    email: 'casey.nguyen@example.com',
    full_name: 'Casey Nguyen',
    role: 'admin',
    invited: false,
    notes: 'Standby desk candidate',
  });

  // Rig profiles (match shoot.client)
  const rigs = [
    {
      team: 'Lakers',
      sport: 'NBA',
      venue_type: 'Arena',
      rig_type: 'Data/Fancam',
      remote_rigs: ['LA-Remote-01', 'LA-Remote-02'],
      data_enabled: true,
      data_hd: CAM('1/500', 'f/2.8', '800'),
      data_wide_enabled: true,
      data_wide: CAM('1/500', 'f/4', '1000'),
      fancam_day_enabled: false,
      fancam_night_enabled: true,
      fancam_night_hd: CAM('1/250', 'f/2.8', '1600'),
      fancam_night_wide_enabled: true,
      fancam_night_wide: CAM('1/250', 'f/4', '2000'),
      attention_enabled: true,
      attention_hd: CAM('1/500', 'f/2.8', '1250'),
      sound_enabled: true,
      shoot_plan: 'Baseline + baseline fan cam. Follow coach reaction on attention.',
      notes: 'Crypto.com Arena — confirm IP whitelist before setup.',
    },
    {
      team: 'Celtics',
      sport: 'NBA',
      venue_type: 'Arena',
      rig_type: 'Data',
      remote_rigs: ['BOS-Remote-01'],
      data_enabled: true,
      data_hd: CAM('1/500', 'f/2.8', '640'),
      data_wide_enabled: true,
      data_wide: CAM('1/500', 'f/4', '800'),
      attention_enabled: true,
      attention_hd: CAM('1/500', 'f/2.8', '1000'),
      sound_enabled: false,
      shoot_plan: 'Data only. Wide for inbound plays.',
    },
    {
      team: 'Knicks',
      sport: 'NBA',
      venue_type: 'Arena',
      rig_type: 'Fancam',
      remote_rigs: ['NYK-Remote-01', 'NYK-Remote-02'],
      data_enabled: false,
      fancam_night_enabled: true,
      fancam_night_hd: CAM('1/250', 'f/2.0', '2000'),
      fancam_night_wide_enabled: true,
      fancam_night_wide: CAM('1/250', 'f/2.8', '2500'),
      sound_enabled: true,
      shoot_plan: 'Garden crowd energy — prioritize celebrations.',
    },
    {
      team: 'Warriors',
      sport: 'NBA',
      venue_type: 'Arena',
      rig_type: 'Data/Fancam',
      remote_rigs: ['GSW-Remote-01'],
      data_enabled: true,
      data_hd: CAM('1/500', 'f/2.8', '800'),
      data_wide_enabled: true,
      data_wide: CAM('1/500', 'f/4', '1000'),
      fancam_night_enabled: true,
      fancam_night_hd: CAM('1/250', 'f/2.8', '1600'),
      attention_enabled: false,
      sound_enabled: true,
      shoot_plan: 'Chase three-point reactions.',
    },
    {
      team: 'Rangers',
      sport: 'NHL',
      venue_type: 'Arena',
      rig_type: 'Data',
      remote_rigs: ['NYR-Remote-01'],
      data_enabled: true,
      data_hd: CAM('1/800', 'f/2.8', '1600'),
      data_wide_enabled: true,
      data_wide: CAM('1/800', 'f/4', '2000'),
      sound_enabled: true,
      shoot_plan: 'Ice glare — keep shutter fast.',
    },
    {
      team: 'Maple Leafs',
      sport: 'NHL',
      venue_type: 'Arena',
      rig_type: 'Data/Fancam',
      remote_rigs: ['TOR-Remote-01'],
      data_enabled: true,
      data_hd: CAM('1/800', 'f/2.8', '1600'),
      fancam_night_enabled: true,
      fancam_night_hd: CAM('1/400', 'f/2.8', '2500'),
      sound_enabled: false,
      shoot_plan: 'Center ice + goal celebrations.',
    },
    {
      team: 'Arsenal',
      sport: 'Soccer',
      venue_type: 'Outdoor',
      rig_type: 'Data/Fancam',
      remote_rigs: ['ARS-Remote-01'],
      data_enabled: true,
      data_hd: CAM('1/1000', 'f/4', '400'),
      fancam_day_enabled: true,
      fancam_day_hd: CAM('1/1000', 'f/4', '200'),
      sound_enabled: true,
      shoot_plan: 'Daylight outdoor — watch white balance on grass.',
    },
    {
      team: 'Chelsea',
      sport: 'Soccer',
      venue_type: 'Outdoor',
      rig_type: 'Data',
      remote_rigs: ['CHE-Remote-01'],
      data_enabled: true,
      data_hd: CAM('1/1000', 'f/4', '400'),
      data_wide_enabled: true,
      data_wide: CAM('1/1000', 'f/5.6', '400'),
      sound_enabled: false,
      shoot_plan: 'Touchline data feed only.',
    },
  ];

  for (const r of rigs) createEntity('RigSetting', r);

  createEntity('Rig', { name: 'LA-Remote-01', type: 'Camera', status: 'in_use', notes: 'Primary Lakers data rig', description: 'Crypto.com Arena' });
  createEntity('Rig', { name: 'BOS-Remote-01', type: 'Camera', status: 'available', description: 'TD Garden' });
  createEntity('Rig', { name: 'NYK-Remote-01', type: 'Camera', status: 'available', description: 'Madison Square Garden' });
  createEntity('Rig', { name: 'GSW-Remote-01', type: 'Camera', status: 'maintenance', notes: 'Firmware update pending', description: 'Chase Center' });

  const shootDefs = [
    // Past completed
    { day: -5, title: 'Lakers vs Jazz', client: 'Lakers', location: 'Crypto.com Arena', game: [19, 30], status: 'completed', ops: [ops.demo, ops.jordan], phase: 'done', rate: 850 },
    { day: -4, title: 'Celtics vs Heat', client: 'Celtics', location: 'TD Garden', game: [19, 0], status: 'completed', ops: [ops.sam], phase: 'done', rate: 850 },
    { day: -3, title: 'Rangers vs Bruins', client: 'Rangers', location: 'Madison Square Garden', game: [19, 0], status: 'completed', ops: [ops.maya], phase: 'done', rate: 900 },
    { day: -2, title: 'Arsenal vs Fulham', client: 'Arsenal', location: 'Emirates Stadium', game: [15, 0], status: 'completed', ops: [ops.jordan, ops.demo], phase: 'done', rate: 800 },
    { day: -1, title: 'Warriors vs Suns', client: 'Warriors', location: 'Chase Center', game: [19, 30], status: 'completed', ops: [ops.sam], phase: 'done', rate: 850 },
    // Today / near
    { day: 0, title: 'New York Knicks vs Milwaukee Bucks', client: 'Knicks', location: 'Madison Square Garden', game: [12, 0], status: 'upcoming', ops: [ops.demo, admin], phase: 'pre', rate: 900 },
    { day: 0, title: 'Toronto Maple Leafs vs Ottawa Senators', client: 'Maple Leafs', location: 'Scotiabank Arena', game: [13, 0], status: 'upcoming', ops: [ops.maya], phase: null, rate: 900 },
    { day: 0, title: 'Los Angeles Lakers vs Denver Nuggets', client: 'Lakers', location: 'Crypto.com Arena', game: [15, 30], status: 'upcoming', ops: [ops.jordan, ops.sam], phase: null, rate: 850 },
    { day: 0, title: 'Boston Celtics vs Philadelphia 76ers', client: 'Celtics', location: 'TD Garden', game: [16, 0], status: 'cancelled', ops: [ops.maya, ops.jordan], phase: null, rate: 850 },
    { day: 0, title: 'Golden State Warriors vs Phoenix Suns', client: 'Warriors', location: 'Chase Center', game: [17, 0], status: 'postponed', ops: [ops.sam], phase: null, rate: 850 },
    { day: 0, title: 'New York Rangers vs New Jersey Devils', client: 'Rangers', location: 'Madison Square Garden', game: [18, 0], status: 'upcoming', ops: [ops.demo], phase: null, rate: 900 },
    { day: 0, title: 'Arsenal vs Liverpool', client: 'Arsenal', location: 'Emirates Stadium', game: [19, 0], status: 'upcoming', ops: [ops.jordan, ops.maya], phase: null, rate: 900 },
    { day: 0, title: 'Chelsea Football Club vs Tottenham Hotspur', client: 'Chelsea', location: 'Stamford Bridge', game: [19, 30], status: 'upcoming', ops: [ops.demo], phase: null, rate: 800 },
    { day: 1, title: 'Lakers vs Nuggets', client: 'Lakers', location: 'Crypto.com Arena', game: [19, 0], status: 'upcoming', ops: [ops.jordan, ops.sam], phase: null, rate: 850 },
    { day: 1, title: 'Chelsea vs Spurs', client: 'Chelsea', location: 'Stamford Bridge', game: [16, 30], status: 'upcoming', ops: [ops.demo], phase: null, rate: 800 },
    { day: 2, title: 'Celtics vs 76ers', client: 'Celtics', location: 'TD Garden', game: [19, 30], status: 'upcoming', ops: [ops.maya, ops.jordan], phase: null, rate: 850 },
    { day: 3, title: 'Warriors vs Kings', client: 'Warriors', location: 'Chase Center', game: [19, 0], status: 'upcoming', ops: [], pending: [ops.sam], phase: null, rate: 850 },
    { day: 4, title: 'Rangers vs Devils', client: 'Rangers', location: 'Madison Square Garden', game: [19, 0], status: 'upcoming', ops: [ops.demo], phase: null, rate: 900 },
    { day: 5, title: 'Arsenal vs Liverpool', client: 'Arsenal', location: 'Emirates Stadium', game: [17, 30], status: 'upcoming', ops: [ops.jordan, ops.maya], phase: null, rate: 900 },
    { day: 6, title: 'Knicks vs Nets', client: 'Knicks', location: 'Madison Square Garden', game: [13, 0], status: 'upcoming', ops: [admin], phase: null, rate: 850 },
    { day: 7, title: 'Lakers vs Clippers', client: 'Lakers', location: 'Crypto.com Arena', game: [19, 30], status: 'upcoming', ops: [ops.sam, ops.demo], phase: null, rate: 900 },
    { day: 8, title: 'Maple Leafs vs Canadiens', client: 'Maple Leafs', location: 'Scotiabank Arena', game: [19, 0], status: 'upcoming', ops: [ops.maya], phase: null, rate: 850 },
    { day: 10, title: 'Celtics vs Knicks', client: 'Celtics', location: 'TD Garden', game: [19, 30], status: 'upcoming', ops: [ops.jordan], phase: null, rate: 900 },
    { day: 12, title: 'Chelsea vs Arsenal', client: 'Chelsea', location: 'Stamford Bridge', game: [16, 0], status: 'upcoming', ops: [], pending: [ops.demo, ops.maya], phase: null, rate: 850 },
    { day: 14, title: 'Warriors vs Lakers', client: 'Warriors', location: 'Chase Center', game: [19, 0], status: 'upcoming', ops: [ops.sam, ops.jordan], phase: null, rate: 950 },
  ];

  const createdShoots = [];
  for (const s of shootDefs) {
    const date = ymd(addDays(today, s.day));
    const game_time = hm(s.game[0], s.game[1]);
    let phase_status = {};
    if (s.phase === 'done') {
      phase_status = {
        setup_complete: `${date}T${hm(s.game[0] - 3)}:00.000Z`,
        pre_shoot_started: `${date}T${hm(s.game[0] - 2)}:00.000Z`,
        game_started: `${date}T${game_time}:00.000Z`,
        shoot_complete: `${date}T${hm(s.game[0] + 3)}:00.000Z`,
      };
    } else if (s.phase === 'pre') {
      phase_status = {
        setup_complete: new Date().toISOString(),
        pre_shoot_started: new Date().toISOString(),
      };
    }

    const shoot = createEntity('Shoot', {
      title: s.title,
      client: s.client,
      location: s.location,
      date,
      game_time,
      setup_offset: -150,
      pre_shoot_offset: -120,
      attention_offset: -30,
      sound_offset: -30,
      status: s.status,
      assigned_operators: s.ops || [],
      pending_operators: s.pending || [],
      pre_approved_operators: (s.ops || []).slice(0, 2),
      rate: s.rate,
      rate_type: 'day_rate',
      standby_admin: admin,
      phase_status,
      notes: s.day === 0 ? 'Priority broadcast window tonight.' : '',
      description: `${s.client} remote shoot`,
    });
    createdShoots.push(shoot);
  }

  // Standby coverage (overnight windows)
  createEntity('StandbyDay', {
    start_date: ymd(addDays(today, -1)),
    start_time: '18:00',
    end_date: ymd(today),
    end_time: '06:00',
    admin_email: admin,
    admin_name: 'Admin User',
    notes: 'Overnight desk',
    date: ymd(addDays(today, -1)),
  });
  createEntity('StandbyDay', {
    start_date: ymd(today),
    start_time: '18:00',
    end_date: ymd(addDays(today, 1)),
    end_time: '06:00',
    admin_email: ops.priya,
    admin_name: 'Priya Nair',
    notes: 'Primary standby',
    date: ymd(today),
  });
  createEntity('StandbyDay', {
    start_date: ymd(addDays(today, 2)),
    start_time: '18:00',
    end_date: ymd(addDays(today, 3)),
    end_time: '06:00',
    admin_email: admin,
    admin_name: 'Admin User',
    date: ymd(addDays(today, 2)),
  });
  createEntity('StandbyDay', {
    start_date: ymd(addDays(today, 5)),
    start_time: '18:00',
    end_date: ymd(addDays(today, 6)),
    end_time: '06:00',
    admin_email: ops.priya,
    admin_name: 'Priya Nair',
    date: ymd(addDays(today, 5)),
  });

  // Rig tests
  createEntity('RigTest', {
    title: 'Weekly Rig Test — West Coast',
    scheduled_date: ymd(addDays(today, 1)),
    due_date: ymd(addDays(today, 2)),
    assigned_to: admin,
    assigned_name: 'Admin User',
    checklist: CHECKLIST.map((item, i) => ({ item, checked: i < 2 })),
    status: 'in_progress',
    comments: '',
  });
  createEntity('RigTest', {
    title: 'Garden Fan Cam Validation',
    scheduled_date: ymd(addDays(today, 3)),
    assigned_to: ops.priya,
    assigned_name: 'Priya Nair',
    checklist: CHECKLIST.map((item) => ({ item, checked: false })),
    status: 'pending',
  });
  createEntity('RigTest', {
    title: 'Monthly Network Sweep',
    scheduled_date: ymd(addDays(today, -7)),
    assigned_to: admin,
    assigned_name: 'Admin User',
    checklist: CHECKLIST.map((item) => ({ item, checked: true })),
    status: 'completed',
    completed_at: addDays(today, -6).toISOString(),
    comments: 'All remotes green.',
  });

  // Presence
  const now = new Date().toISOString();
  for (const [email, name, role] of [
    [admin, 'Admin User', 'admin'],
    [ops.demo, 'Demo Operator', 'user'],
    [ops.jordan, 'Jordan Lee', 'user'],
    [ops.maya, 'Maya Chen', 'user'],
    [ops.priya, 'Priya Nair', 'standby'],
  ]) {
    createEntity('UserPresence', {
      user_email: email,
      user_name: name,
      user_role: role,
      last_seen: now,
      is_online: true,
    });
  }

  // Operator unavailability windows
  createEntity('OperatorAvailability', {
    operator_email: ops.demo,
    operator_name: 'Demo Operator',
    start_date: ymd(addDays(today, 3)),
    end_date: ymd(addDays(today, 3)),
    type: 'unavailable',
    notes: 'Travel day',
  });
  createEntity('OperatorAvailability', {
    operator_email: ops.sam,
    operator_name: 'Sam Okonkwo',
    start_date: ymd(addDays(today, 8)),
    end_date: ymd(addDays(today, 9)),
    type: 'unavailable',
    notes: 'Personal leave',
  });
  createEntity('OperatorAvailability', {
    operator_email: ops.jordan,
    operator_name: 'Jordan Lee',
    start_date: ymd(today),
    end_date: ymd(addDays(today, 14)),
    type: 'available',
    notes: 'Open for overtime',
  });

  // Payments / time for completed shoots
  const month = ymd(today).slice(0, 7);
  const completed = createdShoots.filter((s) => s.status === 'completed');
  for (const shoot of completed) {
    for (const email of shoot.assigned_operators || []) {
      const name =
        email === ops.demo ? 'Demo Operator' :
        email === ops.jordan ? 'Jordan Lee' :
        email === ops.sam ? 'Sam Okonkwo' :
        email === ops.maya ? 'Maya Chen' : email;
      createEntity('PaymentRecord', {
        operator_email: email,
        operator_name: name,
        period_month: month,
        shoot_id: shoot.id,
        shoot_title: shoot.title,
        shoot_date: shoot.date,
        base_fee: shoot.rate || 850,
        paid: shoot.date < ymd(addDays(today, -3)),
        paid_date: shoot.date < ymd(addDays(today, -3)) ? shoot.date : null,
      });
      createEntity('TimeEntry', {
        operator_email: email,
        operator_name: name,
        shoot_id: shoot.id,
        date: shoot.date,
        hours: 6,
        rate: shoot.rate || 850,
        total: shoot.rate || 850,
        status: shoot.date < ymd(addDays(today, -3)) ? 'paid' : 'approved',
        entry_type: 'manual',
      });
    }
  }

  // One unpaid pending for accounts view
  const upcomingPaid = createdShoots.find((s) => s.status === 'upcoming' && (s.assigned_operators || []).length);
  if (upcomingPaid) {
    createEntity('PaymentRecord', {
      operator_email: ops.demo,
      operator_name: 'Demo Operator',
      period_month: month,
      shoot_id: upcomingPaid.id,
      shoot_title: upcomingPaid.title,
      shoot_date: upcomingPaid.date,
      base_fee: upcomingPaid.rate || 850,
      paid: false,
      notes: 'Awaiting approval',
    });
  }

  if (completed[0]) {
    createEntity('ShootReport', {
      shoot_id: completed[0].id,
      shoot_title: completed[0].title,
      shoot_date: completed[0].date,
      operator_email: ops.demo,
      operator_name: 'Demo Operator',
      had_issues: true,
      notes: 'Clean feed overall. Minor latency spike mid Q3 — recovered.',
      completed_at: completed[0].phase_status?.shoot_complete || now,
      slack_message: 'Shoot complete — Lakers vs Jazz',
    });
  }

  createEntity('Event', {
    title: 'Weekly ops standup',
    date: ymd(addDays(today, 2)),
    type: 'meeting',
    description: 'Crew sync on upcoming NBA/NHL windows',
    location: 'Remote',
    all_day: false,
  });
  createEntity('Event', {
    title: 'Remote firmware window',
    date: ymd(addDays(today, 4)),
    end_date: ymd(addDays(today, 4)),
    type: 'maintenance',
    description: 'GSW remote firmware update',
    all_day: true,
  });

  createEntity('ReferenceImage', {
    title: 'Arena baseline framing',
    description: 'Example wide baseline for NBA arenas',
    image_url: '/favicon.svg',
    type: 'do',
    category: 'Camera Setup',
    sort_order: 1,
  });
  createEntity('ReferenceImage', {
    title: 'Avoid low angle fan cam',
    description: 'Crowds block the lens when mounted too low',
    image_url: '/favicon.svg',
    type: 'dont',
    category: 'Camera Setup',
    sort_order: 2,
  });

  createEntity('Report', {
    title: `${month} earnings summary`,
    type: 'earnings',
    period_start: `${month}-01`,
    period_end: ymd(today),
    generated_by: admin,
    notes: 'Demo month summary for accounts review',
  });
  createEntity('Report', {
    title: `${month} shoot summary`,
    type: 'shoot_summary',
    period_start: `${month}-01`,
    period_end: ymd(today),
    generated_by: admin,
    notes: `${completed.length} completed shoots in demo dataset`,
  });

  console.log(`Demo seed complete: ${createdShoots.length} shoots, ${rigs.length} rig profiles.`);
}

/** Wipe entity rows (keeps users) and re-seed demo data. */
export function resetDemoData() {
  db.prepare('DELETE FROM entities').run();
  seedSettings();
  seedDemoDataset();
  console.log('Demo data reset.');
}
