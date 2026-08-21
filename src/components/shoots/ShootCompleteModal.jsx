import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Copy, Check, AlertCircle, CheckCircle2 } from 'lucide-react';

export default function ShootCompleteModal({ shoot, user, onClose }) {
  const [hadIssues, setHadIssues] = useState(null); // null = not answered yet
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [slackText, setSlackText] = useState('');

  const team = shoot.client || shoot.title;

  const handleSubmit = async () => {
    setSaving(true);

    try {
      const completedAt = new Date().toISOString();

      const slack = `✅ ${team} shoot is now complete${
        hadIssues ? ' — issues noted' : ' — no issues'
      }. ${notes ? `Notes: ${notes}` : ''}`;

      await base44.entities.ShootReport.create({
        shoot_id: shoot.id,
        shoot_title: shoot.title,
        shoot_date: shoot.date,
        operator_email: user?.email,
        operator_name: user?.full_name,
        had_issues: hadIssues,
        notes,
        completed_at: completedAt,
        slack_message: slack,
      });

      // Note: shoot status is updated by the parent via onClose(true)

      setSlackText(slack);
      setSaved(true);
    } catch (error) {
      console.error('Failed to save shoot report:', error);
      alert('Failed to save report. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(slackText);
    setCopied(true);

    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  if (saved) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 max-w-md w-full space-y-4">

          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-7 w-7 text-emerald-700 flex-shrink-0" />
            <h2 className="text-zinc-900 font-bold text-lg">
              Report Saved!
            </h2>
          </div>

          <p className="text-zinc-500 text-sm">
            Report saved. Copy the message below to Slack, then confirm if the shoot is complete:
          </p>

          <div className="bg-zinc-100 border border-zinc-200 rounded-lg p-3">
            <pre className="text-sm text-gray-200 whitespace-pre-wrap font-mono leading-relaxed">
              {slackText}
            </pre>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleCopy}
              className="flex-1 bg-teal-700 hover:bg-teal-700"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2 text-green-300" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy to Slack
                </>
              )}
            </Button>
          </div>

          <div className="flex gap-2 pt-1 border-t border-zinc-200">
            <Button
              onClick={() => onClose(true)}
              className="flex-1 bg-green-700 hover:bg-green-600 text-sm"
            >
              ✓ Mark Shoot Complete
            </Button>

            <Button
              variant="outline"
              onClick={() => onClose(false)}
              className="border-zinc-200 text-zinc-600 hover:bg-zinc-100 text-sm"
            >
              Close Without Completing
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (hadIssues === null) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-white border border-zinc-200 rounded-2xl p-6 max-w-sm w-full space-y-5">

          <h2 className="text-zinc-900 font-bold text-lg">
            Mark Shoot Complete?
          </h2>

          <p className="text-zinc-500 text-sm">
            Were there any issues during the{' '}
            <span className="text-zinc-900 font-medium">
              {team}
            </span>{' '}
            shoot?
          </p>

          <div className="grid grid-cols-2 gap-3">

            <Button
              className="bg-green-700 hover:bg-green-600 h-14 flex-col gap-1"
              onClick={() => setHadIssues(false)}
            >
              <CheckCircle2 className="h-5 w-5" />
              <span className="text-xs">No Issues</span>
            </Button>

            <Button
              className="bg-red-800 hover:bg-red-700 h-14 flex-col gap-1"
              onClick={() => setHadIssues(true)}
            >
              <AlertCircle className="h-5 w-5" />
              <span className="text-xs">Had Issues</span>
            </Button>

          </div>

          {/* FIXED BUG HERE */}
          <Button
            variant="ghost"
            className="w-full text-zinc-400"
            onClick={() => onClose(false)}
          >
            Cancel
          </Button>

        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white border border-zinc-200 rounded-2xl p-6 max-w-md w-full space-y-4">

        <h2 className="text-zinc-900 font-bold text-lg">
          {hadIssues
            ? '⚠️ Describe the Issues'
            : '✅ Confirm Shoot Complete'}
        </h2>

        {hadIssues && (
          <p className="text-zinc-500 text-sm">
            Please describe the issues encountered:
          </p>
        )}

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={
            hadIssues
              ? "Describe issues..."
              : "Any additional notes? (optional)"
          }
          className="w-full bg-zinc-100 border border-zinc-200 text-zinc-900 rounded-lg p-3 text-sm resize-none h-28 placeholder:text-zinc-400"
        />

        <div className="flex gap-2">

          <Button
            onClick={handleSubmit}
            disabled={saving || (hadIssues && !notes)}
            className="flex-1 bg-teal-700 hover:bg-teal-800"
          >
            {saving ? 'Saving...' : 'Submit & Complete'}
          </Button>

          <Button
            variant="ghost"
            className="text-zinc-400"
            onClick={() => setHadIssues(null)}
          >
            Back
          </Button>

        </div>
      </div>
    </div>
  );
}