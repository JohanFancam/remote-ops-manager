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
    body: "The Calendar shows all scheduled shoots. Admins can sync Data and Fancam Google calendars here without changing Google. Operators mark Not available on a day. Standby colours highlight the covered games, not the whole day."
  },
  {
    title: "Rigs Page",
    body: "Define rig configurations per team. Each team can have camera settings (HD, Wide, Attention), sound settings, and shoot plan notes. These auto-populate the countdown cards."
  },
  {
    title: "Top notifications",
    body: "New alerts pop in from the top with a sound. If you miss one, open Notifications above your name in the left sidebar and clear it there. The Notifications tab keeps a history you can look back on. Time changes show the original date/time and the new one in South Africa time."
  },
  {
    title: "Online Now",
    body: "The 'Online Now' section in the sidebar shows which team members are currently active in the app — updated in real-time with a 3-minute heartbeat."
  },
  {
    title: "Settings",
    body: "Configure pay rates, Slack message templates, Google Calendar, and team members. Admin settings are grouped into categories and stay collapsed until you open one."
  },
];

const REMOTE_STEPS = [
  {
    title: "Welcome to Remote Ops Manager",
    body: "Sign in with the email and password you were sent. This app is your shoot schedule, calendar, and the place to mark work complete. Open Guide in the menu any time for the written steps."
  },
  {
    title: "Calendar — find a shoot and mark out",
    body: "Open Calendar and tap a game to see details. If you cannot work a day, tap Out / Not available on that date so admins know. Tap it again to become available."
  },
  {
    title: "Dashboard — your game and rig settings",
    body: "Dashboard shows the shoots you are assigned to. Expand a card (chevron) to read rig settings for that team. Logos stay in the corners."
  },
  {
    title: "Mark complete",
    body: "Use Setup / Pre-Shoot / Game Start as you work. When finished, tap Shoot Complete and choose No Issues or Had Issues. Add a note if something went wrong."
  },
  {
    title: "Notifications",
    body: "The Notifications tab is the history of alerts. To get phone or desktop pop-ups, go to Settings → Device Notifications → Enable notifications and allow the browser prompt."
  },
  {
    title: "App faults",
    body: "If the app itself is broken, open App Faults, describe what happened, and send it. Only admins see the list and get notified."
  },
  {
    title: "Earnings and settings",
    body: "Earnings shows this month's shoots and rates. Settings is where you change your password and turn device notifications on or off."
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