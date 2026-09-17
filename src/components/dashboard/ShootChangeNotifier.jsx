/**
 * Shoot change notifications are created on the server now
 * (see server/notifications.js) so every device gets the same alerts + Web Push.
 * This component is kept as a no-op for backward-compatible imports.
 */
export default function ShootChangeNotifier() {
  return null;
}
