import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function AnalyticsGoogleSync() {
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);
  const { data: status } = useQuery({
    queryKey: ['googleStatus'],
    queryFn: () => base44.google.status(),
  });

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await base44.google.sync();
      queryClient.invalidateQueries({ queryKey: ['shoots'] });
      queryClient.invalidateQueries({ queryKey: ['googleStatus'] });
      toast.success(`Data + Fancam sync: ${result.created} new · ${result.updated} updated · ${result.cancelled} cancelled.`);
    } catch (err) {
      toast.error(err.message || 'Google sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const lastSync = status?.lastSyncAt
    ? new Date(status.lastSyncAt).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })
    : null;

  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardHeader className="border-b border-slate-800 pb-4">
        <CardTitle className="text-slate-100 flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-orange-400" /> Google calendars
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <p className="text-sm text-slate-400">
          Same one-way pull the admins use. Google is not changed. Auto-sync still runs at 06:00, 13:00 and 20:00 SAST.
        </p>
        <Button onClick={handleSync} disabled={syncing || !status?.connected} className="bg-orange-500 hover:bg-orange-400 gap-2">
          <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Syncing…' : status?.connected ? 'Sync calendars' : 'Google not connected yet'}
        </Button>
        {lastSync && <p className="text-xs text-slate-500">Last Google sync: {lastSync} SAST</p>}
      </CardContent>
    </Card>
  );
}
