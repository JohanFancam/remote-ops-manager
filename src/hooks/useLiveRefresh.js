import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { LIVE_REFRESH_MS, startLiveRefresh } from '@/utils/liveRefresh';

export default function useLiveRefresh(enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return undefined;
    return startLiveRefresh(queryClient, { intervalMs: LIVE_REFRESH_MS });
  }, [enabled, queryClient]);
}
