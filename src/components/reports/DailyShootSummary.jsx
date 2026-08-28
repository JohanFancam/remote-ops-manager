import React, { useState } from 'react';
import { format } from 'date-fns';
import { Copy, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { homeTeamFromTitle } from '../utils/scheduleUtils';

// Builds the copy-ready daily shoot message from a day's ShootReport records.
// Format:
//   Shoot summary :
//
//   <Title> shoot complete. No issues to report.   (clean)
//   <Title> shoot complete.                        (had issues)
//
//   Shoot issues :
//
//   <Title> - <notes>
export function buildDaySummaryMessage(reports) {
  if (!reports || reports.length === 0) return '';
  const issues = reports.filter(r => r.had_issues);

  let msg = 'Shoot summary :\n\n';
  reports.forEach(r => {
    const team = homeTeamFromTitle(r.shoot_title) || 'Shoot';
    msg += r.had_issues
      ? `${team} shoot complete.\n`
      : `${team} shoot complete. No issues to report.\n`;
  });

  if (issues.length > 0) {
    msg += '\nShoot issues :\n\n';
    issues.forEach(r => {
      const team = homeTeamFromTitle(r.shoot_title) || 'Shoot';
      const note = (r.notes || '').trim() || 'Issues reported';
      msg += `${team} - ${note}\n`;
    });
  }

  return msg.trimEnd();
}

// One row per day — collapsed by default. The Copy button is always available
// so operators can grab the message without expanding it.
export default function DailyShootSummary({ date, reports }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const message = buildDaySummaryMessage(reports);
  const dayLabel = format(date, 'EEE, MMMM d');
  const issueCount = reports.filter(r => r.had_issues).length;
  const cleanCount = reports.length - issueCount;

  const copy = () => {
    navigator.clipboard.writeText(message);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 text-left flex-1 min-w-0"
        >
          {open
            ? <ChevronDown className="h-4 w-4 text-gray-500 flex-shrink-0" />
            : <ChevronRight className="h-4 w-4 text-gray-500 flex-shrink-0" />}
          <span className="text-sm font-semibold text-white truncate">{dayLabel}</span>
          <span className="text-xs text-gray-500 flex-shrink-0">
            {reports.length} shoot{reports.length !== 1 ? 's' : ''}
          </span>
          {cleanCount > 0 && (
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs flex-shrink-0">
              {cleanCount} clean
            </Badge>
          )}
          {issueCount > 0 && (
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs flex-shrink-0">
              {issueCount} issue{issueCount !== 1 ? 's' : ''}
            </Badge>
          )}
        </button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 text-xs text-gray-400 hover:text-white gap-1 flex-shrink-0"
          onClick={copy}
        >
          {copied
            ? <><Check className="h-3 w-3 text-green-400" />Copied</>
            : <><Copy className="h-3 w-3" />Copy</>}
        </Button>
      </div>
      {open && (
        <div className="px-4 pb-4">
          <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed bg-gray-950/60 rounded-lg p-3 border border-gray-800">
            {message}
          </pre>
        </div>
      )}
    </div>
  );
}