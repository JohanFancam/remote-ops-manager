import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { X, ChevronRight, ChevronLeft, BookOpen } from 'lucide-react';

const ADMIN_STEPS = [
  {
    title: "Welcome to Remote Ops Manager",
    body: "This is your admin command centre. You can manage shoots, operators, rigs, and monitor team activity in real-time. Use this tutorial to understand each section."
  },
  {
    title: "Dashboard — My Schedule",
    body: "The 'My Schedule' tab shows your personal upcoming shoots with live countdowns. Each card shows the shoot phases (Setup → Pre-Shoot → Attention → Sound). Mark phases complete as you go."
  },
  {
    title: "Dashboard — Rigs Check",
    body: "The 'Rigs Check' panel lists upcoming shoots in the next 7 days. Tick them off as you confirm rigs are ready, then copy the message and archive once done."
  },
  {
    title: "Dashboard — Shoot Summary",
    body: "The 'Shoot Summary' panel auto-generates completion messages for recently completed shoots. If a report flagged issues, it will show a warning. You can edit any message before copying."
  },
  {
    title: "Dashboard — Team Activity",
    body: "Switch to the 'Team Activity' tab to see what all operators are working on today, phase progress, and upcoming assignments."
  },
  {
    title: "Calendar",
    body: "The Calendar shows all scheduled shoots. Click a date to view shoot details, assign operators, or create new shoots. Use the list view on mobile for a cleaner layout."
  },
  {
    title: "Rigs Page",
    body: "Define rig configurations per team. Each team can have camera settings (HD, Wide, Attention), sound settings, and shoot plan notes. These auto-populate the countdown cards."
  },
  {
    title: "Top notifications",
    body: "Alerts drop in from the top of the screen and stay there until you clear them. That includes assignment updates and when someone selects or swaps a standby day."
  },
  {
    title: "Online Now",
    body: "The 'Online Now' section in the sidebar shows which team members are currently active in the app — updated in real-time with a 3-minute heartbeat."
  },
  {
    title: "Settings",
    body: "Configure pay rates, notification thresholds, Slack message templates, WhatsApp reminders, and manage team members. Admins can also control tutorial visibility here."
  },
];

const REMOTE_STEPS = [
  {
    title: "Welcome to Remote Ops Manager",
    body: "This app keeps you connected with your shoot schedule, earnings, and team. Here's a quick walkthrough of what everything means."
  },
  {
    title: "Dashboard — Your Shoots",
    body: "Your upcoming assigned shoots appear as countdown cards. Each card shows exactly when you need to be set up and ready. The countdown turns red when setup time is approaching."
  },
  {
    title: "Shoot Phases",
    body: "Each shoot has phases: Setup, Pre-Shoot, Attention, and Sound. As you progress through each phase, mark it complete using the phase buttons on your shoot card. This notifies the admin in real-time."
  },
  {
    title: "Standby Banner",
    body: "The banner at the top shows which admin is on standby contact for today. If you have any issues, this is your contact person."
  },
  {
    title: "Top notifications",
    body: "Shoot alerts drop in from the top of the screen and stay there until you clear them. You'll get notified when a shoot setup time is approaching (the admin controls how many hours in advance)."
  },
  {
    title: "Earnings",
    body: "Your earnings summary is on the dashboard. It shows this month's shoots, base rates, and any additional shoot bonuses. You can navigate to previous months to see history."
  },
  {
    title: "Calendar",
    body: "The Calendar shows all your assigned shoots. Tap a shoot to see full details — game time, location, rig type, and standby contact."
  },
  {
    title: "Settings",
    body: "Update your profile here. If you are an admin, you'll also find team management and app configuration options."
  },
];

const STORAGE_KEY_ADMIN = 'tutorial_dismissed_admin';
const STORAGE_KEY_REMOTE = 'tutorial_dismissed_remote';

export default function TutorialOverlay({ isAdmin, tutorialEnabled }) {
  const storageKey = isAdmin ? STORAGE_KEY_ADMIN : STORAGE_KEY_REMOTE;
  const steps = isAdmin ? ADMIN_STEPS : REMOTE_STEPS;

  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!tutorialEnabled) return;
    const dismissed = localStorage.getItem(storageKey);
    if (!dismissed) setVisible(true);
  }, [tutorialEnabled, storageKey]);

  const dismiss = () => {
    localStorage.setItem(storageKey, '1');
    setVisible(false);
  };

  if (!visible || !tutorialEnabled) return null;

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-blue-400" />
            <span className="text-xs font-medium text-slate-400">Tutorial · Step {step + 1} of {steps.length}</span>
          </div>
          <button onClick={dismiss} className="text-gray-600 hover:text-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-slate-800 mx-5 mt-3 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 rounded-full transition-all duration-300"
            style={{ width: `${((step + 1) / steps.length) * 100}%` }}
          />
        </div>

        {/* Content */}
        <div className="px-5 py-5">
          <h3 className="text-slate-100 font-bold text-lg mb-2">{current.title}</h3>
          <p className="text-slate-400 text-sm leading-relaxed">{current.body}</p>
        </div>

        {/* Footer */}
        <div className="px-5 pb-5 flex items-center justify-between">
          <button
            onClick={dismiss}
            className="text-xs text-gray-600 hover:text-slate-400 underline underline-offset-2"
          >
            Skip tutorial
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button size="sm" variant="ghost" className="text-slate-400 hover:text-slate-100 gap-1" onClick={() => setStep(s => s - 1)}>
                <ChevronLeft className="h-4 w-4" /> Back
              </Button>
            )}
            {isLast ? (
              <Button size="sm" className="bg-blue-600 hover:bg-blue-500 gap-1" onClick={dismiss}>
                Done <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button size="sm" className="bg-blue-600 hover:bg-blue-500 gap-1" onClick={() => setStep(s => s + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Floating button to re-open tutorial
export function TutorialReopenButton({ isAdmin, tutorialEnabled }) {
  const storageKey = isAdmin ? STORAGE_KEY_ADMIN : STORAGE_KEY_REMOTE;

  const handleReopen = () => {
    localStorage.removeItem(storageKey);
    window.location.reload();
  };

  if (!tutorialEnabled) return null;

  return (
    <button
      onClick={handleReopen}
      title="Open Tutorial"
      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors text-sm"
    >
      <BookOpen className="h-4 w-4" /> Tutorial
    </button>
  );
}