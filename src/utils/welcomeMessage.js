export function appOrigin() {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return 'https://remoteopsmanger.com';
}

export function welcomeFirstName(item) {
  const fromName = String(item?.full_name || '').trim().split(/\s+/)[0];
  if (fromName) return fromName;
  const email = String(item?.email || '').trim();
  return email.split('@')[0] || 'there';
}

export function buildWelcomeMessage(item, appUrl = appOrigin()) {
  const first = welcomeFirstName(item);
  const email = String(item?.email || '').trim();
  const password = String(item?.password || '').trim();
  const link = String(appUrl || appOrigin()).replace(/\/$/, '');

  return [
    `Hi ${first},`,
    '',
    'Your Remote Ops Manager login is ready.',
    '',
    `Sign-in: ${link}`,
    `Username: ${email}`,
    `Temporary password: ${password}`,
    '',
    'How to get started:',
    '1. Open the link and sign in with the username and temporary password above.',
    '2. You will be asked to choose your own password the first time you sign in.',
    '3. After that you can see the calendar, assigned shoots, and notifications.',
    '',
    'Keep this password private. If anything does not look right, reply to this message and we will sort it out.',
    '',
    'Remote Ops',
  ].join('\n');
}

export function buildWelcomeList(issued, appUrl = appOrigin()) {
  return (issued || [])
    .map((item) => buildWelcomeMessage(item, appUrl))
    .join('\n\n----------\n\n');
}
