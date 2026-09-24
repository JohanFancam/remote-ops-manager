import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function SlackSyncToggle({ enabled = false, compact = false }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const handleChange = async (next) => {
    setSaving(true);
    try {
      await base44.slack.saveSettings({ enabled: next });
      await queryClient.invalidateQueries({ queryKey: ['slackStatus'] });
      toast.success(next ? 'Slack calendar sync is on' : 'Slack calendar sync is off');
    } catch (err) {
      toast.error(err.message || 'Could not update Slack sync');
    } finally {
      setSaving(false);
    }
  };

  return (
    <label className={`inline-flex items-center gap-2 select-none ${compact ? '' : 'w-full justify-between'}`}>
      <span className={compact ? 'text-xs text-slate-400' : 'text-sm text-slate-200'}>
        {compact ? 'Slack sync' : 'Enable Slack calendar sync'}
      </span>
      <Switch
        checked={!!enabled}
        disabled={saving}
        onCheckedChange={handleChange}
        className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-slate-700"
      />
    </label>
  );
}
