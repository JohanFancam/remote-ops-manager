import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, RefreshCw, MessageSquare } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function SlackGamesSyncModal({ open, onClose, onSynced, configured = false }) {
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const run = async (confirm) => {
    setBusy(true);
    try {
      const result = confirm
        ? await base44.slack.sync({ text })
        : await base44.slack.preview({ text });
      setPreview(result);
      if (confirm) {
        toast.success(`Slack sync: ${result.created} new · ${result.updated} updated. Existing assignments were kept.`);
        onSynced?.(result);
      } else if (!result.parsed) {
        toast.error('No games found in that list.');
      }
    } catch (err) {
      toast.error(err.message || 'Slack sync failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/55" />
      <div
        role="dialog"
        aria-label="Sync from Slack games list"
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-slate-700/80 bg-[#1e2433] p-4 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-50 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-400" /> Sync from Slack
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Fail-safe if Google is down. Paste the 09:00 SAST games list, or pull the latest post from the connected channel.
              SA times are used. This never deletes shoots.
            </p>
          </div>
          <button type="button" onClick={onClose} className="h-8 w-8 rounded-full text-slate-400 hover:bg-slate-800" aria-label="Close">
            <X className="h-4 w-4 mx-auto" />
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={"Games for 24 September 2026\nLakers vs Jazz 7:00 PM ET / 02:00 SAST"}
          className="w-full h-36 rounded-lg border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 font-mono placeholder:text-slate-600"
        />

        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-slate-700 text-slate-200 hover:bg-slate-800"
            disabled={busy || (!text.trim() && !configured)}
            onClick={() => run(false)}
          >
            {busy ? 'Reading…' : text.trim() ? 'Preview paste' : 'Preview Slack channel'}
          </Button>
          <Button
            size="sm"
            className="bg-blue-600 hover:bg-blue-500"
            disabled={busy || (!text.trim() && !configured)}
            onClick={() => run(true)}
          >
            <RefreshCw className={`h-4 w-4 mr-1 ${busy ? 'animate-spin' : ''}`} />
            {busy ? 'Syncing…' : 'Apply to calendar'}
          </Button>
        </div>

        {preview && (
          <div className="mt-4 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
              {preview.preview ? 'Preview' : 'Applied'} · {preview.date} · {preview.parsed} games
            </p>
            {(preview.changes || []).length === 0 ? (
              <p className="text-xs text-slate-500">Nothing to apply.</p>
            ) : (
              <ul className="space-y-1 max-h-40 overflow-y-auto">
                {preview.changes.slice(0, 20).map((item, index) => (
                  <li key={`${item.title}-${index}`} className="text-xs text-slate-300">
                    <span className="text-blue-300">{item.action}</span>
                    {' · '}
                    {item.title}
                    {item.time ? ` · ${item.time} SAST` : ''}
                    {item.localTime ? ` (${item.localTime} local)` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
