import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Save, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import SlackPasteFailSafe from './SlackPasteFailSafe';
import SlackSyncToggle from '../calendar/SlackSyncToggle';

export default function SlackGamesSettings({ canEdit = true }) {
  const queryClient = useQueryClient();
  const [botToken, setBotToken] = useState('');
  const [channelId, setChannelId] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const { data: status } = useQuery({
    queryKey: ['slackStatus'],
    queryFn: () => base44.slack.status(),
  });

  useEffect(() => {
    if (status?.channelId) setChannelId(status.channelId);
  }, [status?.channelId]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.slack.saveSettings({
        botToken: botToken.trim() || undefined,
        channelId: channelId.trim(),
      });
      setBotToken('');
      queryClient.invalidateQueries({ queryKey: ['slackStatus'] });
      toast.success('Slack Gameday channel saved');
    } catch (err) {
      toast.error(err.message || 'Could not save Slack settings');
    } finally {
      setSaving(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await base44.slack.sync();
      queryClient.invalidateQueries({ queryKey: ['shoots'] });
      queryClient.invalidateQueries({ queryKey: ['slackStatus'] });
      toast.success(`Slack sync: ${result.created} new · ${result.updated} updated${result.skipped ? ` · ${result.skipped} not marked for capture` : ''}`);
    } catch (err) {
      toast.error(err.message || 'Slack sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const lastSync = status?.lastSyncAt
    ? new Date(status.lastSyncAt).toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })
    : null;

  return (
    <Card className="bg-slate-900 border-slate-800 mt-4">
      <CardHeader className="border-b border-slate-800 pb-4">
        <CardTitle className="text-slate-100 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-blue-400" /> Slack Gameday fail-safe
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <p className="text-sm text-slate-400">
          Google Calendar stays the source of truth. Slack sync is off until you turn it on. Then Sync from Slack
          reads the Gameday Bot post. Games marked “not for capture” are skipped. This never deletes shoots.
        </p>
        <div className="rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
          <SlackSyncToggle enabled={!!status?.enabled} />
          <p className="text-[11px] text-slate-500 mt-1">
            Off by default. When on, Calendar shows Sync from Slack.
          </p>
        </div>
        {canEdit ? (
          <>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Bot token</label>
              <Input
                type="password"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                placeholder={status?.hasToken ? 'Saved — paste a new token to replace' : 'xoxb-…'}
                className="bg-slate-800 border-slate-800 text-slate-100"
              />
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">Gameday channel ID</label>
              <Input
                value={channelId}
                onChange={(e) => setChannelId(e.target.value)}
                placeholder="C0123456789"
                className="bg-slate-800 border-slate-800 text-slate-100"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Open the Gameday Bot channel in Slack → About → copy the Channel ID. Invite the ROM bot to that channel.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={handleSave} disabled={saving} variant="outline" className="border-slate-700 text-slate-200 hover:bg-slate-800 gap-2">
                <Save className="h-4 w-4" />
                {saving ? 'Saving…' : 'Save Slack channel'}
              </Button>
              <Button onClick={handleSync} disabled={syncing || !status?.configured || !status?.enabled} className="bg-blue-600 hover:bg-blue-500 gap-2">
                <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Syncing…' : 'Sync from Slack'}
              </Button>
            </div>
          </>
        ) : (
          <Button onClick={handleSync} disabled={syncing || !status?.configured || !status?.enabled} className="bg-blue-600 hover:bg-blue-500 gap-2">
            <RefreshCw className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : status?.enabled ? (status?.configured ? 'Sync from Slack' : 'Slack channel not connected') : 'Slack sync is off'}
          </Button>
        )}
        <p className="text-xs text-slate-500">
          {status?.configured ? 'Gameday channel connected.' : 'Gameday channel not connected yet.'}
          {lastSync ? ` Last Slack sync: ${lastSync} SAST` : ''}
        </p>
        <SlackPasteFailSafe />
      </CardContent>
    </Card>
  );
}
