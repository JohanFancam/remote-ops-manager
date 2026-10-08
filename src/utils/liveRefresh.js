export const LIVE_REFRESH_MS = 5000;

export const LIVE_REFRESH_QUERY_KEYS = [
  ['shoots'],
  ['shootNotifications'],
  ['notificationHistory'],
];

export function startLiveRefresh(queryClient, { intervalMs = LIVE_REFRESH_MS } = {}) {
  if (!queryClient?.invalidateQueries) return () => {};

  const tick = () => {
    LIVE_REFRESH_QUERY_KEYS.forEach((queryKey) => {
      queryClient.invalidateQueries({ queryKey });
    });
  };

  const id = setInterval(tick, intervalMs);
  return () => clearInterval(id);
}
