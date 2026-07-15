import { findUserByEmail, createUser } from './auth.js';
import { listEntities, createEntity } from './entities.js';

export function seedIfEmpty() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@example.com').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  const adminName = process.env.ADMIN_NAME || 'Admin User';

  if (!findUserByEmail(adminEmail)) {
    createUser({
      email: adminEmail,
      password: adminPassword,
      full_name: adminName,
      role: 'admin',
      standby: true,
    });
    console.log(`Seeded admin user: ${adminEmail} / ${adminPassword}`);
  }

  const demoOp = 'operator@example.com';
  if (!findUserByEmail(demoOp)) {
    createUser({
      email: demoOp,
      password: 'operator123',
      full_name: 'Demo Operator',
      role: 'user',
    });
    console.log(`Seeded operator user: ${demoOp} / operator123`);
  }

  const settings = listEntities('AppSettings');
  if (!settings.find((s) => s.key === 'app_version')) {
    createEntity('AppSettings', {
      key: 'app_version',
      value: '1',
      description: 'App version — bump to notify users to refresh',
    });
  }

  if (!settings.find((s) => s.key === 'notify_hours_before')) {
    createEntity('AppSettings', {
      key: 'notify_hours_before',
      value: '5',
      description: 'Hours before setup to notify operators',
    });
  }
}
