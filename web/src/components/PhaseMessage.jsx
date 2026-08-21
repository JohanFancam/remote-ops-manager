import { useState } from 'react';

export default function PhaseMessage({ message, onClose }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="animate-rise-in border border-lime/30 bg-ink-900/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wider text-mist-muted">Copy for Slack / WhatsApp</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={copy}
            className="text-xs text-lime hover:text-lime-glow"
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button type="button" onClick={onClose} className="text-xs text-mist-muted hover:text-mist">
            Close
          </button>
        </div>
      </div>
      <pre className="whitespace-pre-wrap font-mono text-sm text-mist">{message}</pre>
    </div>
  );
}
