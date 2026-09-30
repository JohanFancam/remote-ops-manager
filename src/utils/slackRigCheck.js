import { normalizeEmail } from '@/utils/assignmentApproval';
import { normalizeShootStatus } from '@/utils/shootStatus';

export function parseRigCheckUsers(appSettings = []) {
  const raw = appSettings.find((s) => s.key === 'rig_check_users')?.value;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function canPerformCalendarRigCheck({
  shoot,
  user,
  isAdmin = false,
  isStandby = false,
  appSettings = [],
  coverage = null,
  todayStr,
} = {}) {
  if (!shoot || !user?.email || !todayStr) return false;
  if ((shoot.date || '') < todayStr) return false;
  if (normalizeShootStatus(shoot.status) === 'cancelled') return false;
  const permitted = parseRigCheckUsers(appSettings).some((email) => normalizeEmail(email) === normalizeEmail(user.email));
  if (permitted || isAdmin) return true;
  if (isStandby && coverage && normalizeEmail(coverage.admin_email) === normalizeEmail(user.email)) return true;
  return false;
}

export function openSlackHref(href) {
  const url = String(href || 'slack://open');
  try {
    const link = document.createElement('a');
    link.href = url;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } catch {
    window.location.href = url;
  }
}

export function copyButtonLabel({ delivery, canPost, copied, posted } = {}) {
  if (posted) return 'Sent to Slack';
  if (copied && delivery === 'copy_open') return 'Copied — opening Slack';
  if (copied) return 'Copied';
  if (delivery === 'post' && canPost) return 'Send to Slack';
  if (delivery === 'both' && canPost) return 'Copy & send to Slack';
  return 'Copy & open Slack';
}
