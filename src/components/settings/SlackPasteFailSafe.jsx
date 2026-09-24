import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

export default function SlackPasteFailSafe() {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  const run = async (confirm) => {
    if (!text.trim()) {
      toast.error('Paste one game or the Gameday list first.');
      return;
    }
    setBusy(true);
    try {
      const result = confirm
        ? await base44.slack.sync({ text })
        : await base44.slack.preview({ text });
      setPreview(result);
      if (confirm) {
        queryClient.invalidateQueries({ queryKey: ['shoots'] });
        queryClient.invalidateQueries({ queryKey: ['slackStatus'] });
        toast.success(`Slack paste: ${result.created} new · ${result.updated} updated. Assignments kept.`);
      } else if (!result.parsed) {
        toast.error('No games found in that paste.');
      }
    } catch (err) {
      toast.error(err.message || 'Slack paste failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-3 space-y-2">
      <p className="text-xs font-medium text-slate-200">Manual fail-safe</p>
      <p className="text-[11px] text-slate-500">
        Paste one Gameday game (or the full list) when you only need to update that match. Uses Scheduled Start (SAST). Never deletes.
      </p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={'Texas Rangers vs New York Mets\nScheduled Start (SAST): 2026-09-24 20:35\nCapture Requirements: Data'}
        className="w-full h-28 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-100 font-mono placeholder:text-slate-600"
      />
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          className="border-slate-700 text-slate-200 hover:bg-slate-800 h-8 text-xs"
          disabled={busy || !text.trim()}
          onClick={() => run(false)}
        >
          {busy ? 'Reading…' : 'Preview paste'}
        </Button>
        <Button
          size="sm"
          className="bg-blue-600 hover:bg-blue-500 h-8 text-xs"
          disabled={busy || !text.trim()}
          onClick={() => run(true)}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1 ${busy ? 'animate-spin' : ''}`} />
          {busy ? 'Updating…' : 'Update pasted game'}
        </Button>
      </div>
      {preview && (
        <div className="pt-1">
          <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
            {preview.preview ? 'Preview' : 'Applied'} · {preview.parsed || 0} games
          </p>
          {(preview.changes || []).length === 0 ? (
            <p className="text-xs text-slate-500">Nothing to apply.</p>
          ) : (
            <ul className="space-y-1 max-h-32 overflow-y-auto">
              {preview.changes.slice(0, 16).map((item, index) => (
                <li key={`${item.title}-${index}`} className="text-xs text-slate-300">
                  <span className="text-blue-300">{item.action}</span>
                  {' · '}
                  {item.title}
                  {item.time ? ` · ${item.time} SAST` : ''}
                  {item.reason ? ` · ${item.reason}` : ''}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
