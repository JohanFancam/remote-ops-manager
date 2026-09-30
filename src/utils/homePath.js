/** Landing page after a successful login. Accounts has its own dashboard. */
export function homePathForUser(user) {
  return user?.role === 'accounts' ? '/AccountsDashboard' : '/';
}
