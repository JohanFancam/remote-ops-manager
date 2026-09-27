import React, { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Save } from 'lucide-react';
import { toast } from 'sonner';

const DELIVERY_OPTIONS = [
  { value: 'copy_open', label: 'Copy the message and open Slack' },
  { value: 'post', label: 'Send the message straight to the Slack group' },
  { value: 'both', label: 'Copy, send to the group, and open Slack' },
];

export default function RigCheckSlackSettings() {
  const queryClient = useQueryClient();
  const [channelId, setChannelId] = useState('');
  const [teamId, setTeamId] = useState('');
  const [openUrl, setOpenUrl] = useState('');
  const [delivery, setDelivery] = useState('copy_open');
  const [saving, setSaving] = useState(false);

  const { data: status } = useQuery({
    queryKey: ['slackRigCheckStatus'],
    queryFn: () => base44.slack.rigCheckStatus(),
  });

  useEffect(() => {
    if (!status) return;
    setChannelId(status.channelId || '');
    setTeamId(status.teamId || '');
    setOpenUrl(status.openUrl || '');
    setDelivery(status.delivery || 'copy_open');
  }, [status]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.slack.saveRigCheckSettings({
        channelId: channelId.trim(),
        teamId: teamId.trim(),
        openUrl: openUrl.trim(),
        delivery,
      });
      await queryClient.invalidateQueries({ queryKey: ['slackRigCheckStatus'] });
      toast.success('Rig-check Slack destination saved');
    } catch (err) {
      toast.error(err.message || 'Could not save Slack settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-slate-900 border-slate-800 mb-6">
      <CardHeader className="border-b border-slate-800 pb-4">
        <CardTitle className="text-slate-100 flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-amber-400" /> Rig check Slack group
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        <p className="text-xs text-slate-500">
          When someone copies the calendar rig-check message, use this open Slack group.
          Sending directly uses the same bot token as Gameday Slack — invite that bot to this channel and give it <code className="text-blue-400">chat:write</code>.
        </p>
        <p className="text-xs text-slate-500">
          {status?.hasToken ? 'Bot token is saved.' : 'Save a Slack bot token under Calendar → Slack Gameday first if you want direct posts.'}
        </p>
        <div>
          <label className="text-xs text-slate-400 block mb-1">After copy</label>
          <select
            value={delivery}
            onChange={(e) => setDelivery(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-md px-2 py-2"
          >
            {DELIVERY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Open group channel ID</label>
          <Input
            value={channelId}
            onChange={(e) => setChannelId(e.target.value)}
            placeholder="C0123456789"
            className="bg-slate-800 border-slate-800 text-slate-100"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Slack → the group → About → copy Channel ID. This can be a different channel from Gameday.
          </p>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Workspace team ID (optional)</label>
          <Input
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
            placeholder="T0123456789"
            className="bg-slate-800 border-slate-800 text-slate-100"
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Opens the Slack app straight to that channel. Slack → workspace menu → copy Team ID.
          </p>
        </div>
        <div>
          <label className="text-xs text-slate-400 block mb-1">Custom Slack link (optional)</label>
          <Input
            value={openUrl}
            onChange={(e) => setOpenUrl(e.target.value)}
            placeholder="https://app.slack.com/client/T…/C… or slack://…"
            className="bg-slate-800 border-slate-800 text-slate-100"
          />
        </div>
        <Button onClick={handleSave} disabled={saving} className="bg-amber-700 hover:bg-amber-600 gap-2">
          <Save className="h-4 w-4" />
          {saving ? 'Saving…' : 'Save Slack group'}
        </Button>
      </CardContent>
    </Card>
  );
}
