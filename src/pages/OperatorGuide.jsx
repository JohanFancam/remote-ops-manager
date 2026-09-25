import React from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Calendar, Bell, AlertTriangle, LayoutDashboard, Settings } from 'lucide-react';

const STEPS = [
  {
    title: 'Sign in',
    body: 'Open the app and sign in with the email and password you were sent. After the first sign-in you may be asked to choose your own password.',
  },
  {
    title: 'Open the calendar',
    body: 'Use Calendar in the left menu (or the calendar icon on your phone). This is the list of upcoming games.',
  },
  {
    title: 'Select a shoot',
    body: 'Tap a game on the calendar to open its details — date, setup time, rig type, and who is assigned.',
  },
  {
    title: 'Mark yourself out',
    body: 'If you cannot work a full day, tap Out (month view) or Not available (week view) on that day. Admins will see you are unavailable. Tap it again if you become available.',
  },
  {
    title: 'Your game on the dashboard',
    body: 'Go back to Dashboard. Assigned shoots you are on appear as countdown cards.',
  },
  {
    title: 'Expand the card for rig settings',
    body: 'Tap the chevron on the right of a card. The card opens to show rig config — cameras, sound, and any notes for that team. The logos stay in the corners.',
  },
  {
    title: 'Mark a phase or shoot complete',
    body: 'Use Setup / Pre-Shoot / Game Start as you work. When the shoot is done, tap Shoot Complete. Choose No Issues or Had Issues. If there were issues, add a short note, then copy the Slack message if you use Slack.',
  },
  {
    title: 'Notifications',
    body: 'Open Notifications to see shoot-start alerts, time changes, and assignments. To get alerts on your phone or computer even when the app is closed, go to Settings → Device Notifications → Enable notifications, then allow the browser prompt.',
  },
  {
    title: 'Log an app fault',
    body: 'If something in the app is broken, open App Faults. Add a short title and what happened, then Send to admins. Only admins see the list; they get notified.',
  },
];

export default function OperatorGuide() {
  return (
    <div className="rom-page">
      <div className="rom-page-inner max-w-3xl">
        <header className="mb-8">
          <p className="rom-kicker mb-2">Operators</p>
          <h1 className="rom-title flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-blue-400" /> Operator guide
          </h1>
          <p className="rom-subtitle">
            A short walkthrough of the screens you use every match day. Ask an admin if your login does not work.
          </p>
        </header>

        <ol className="space-y-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-400">Step {index + 1}</p>
              <h2 className="mt-1 text-base font-semibold text-slate-100">{step.title}</h2>
              <p className="mt-1.5 text-sm text-slate-400 leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <Link to="/" className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-200 hover:border-blue-500/40">
            <LayoutDashboard className="mb-1 h-4 w-4 text-blue-400" /> Dashboard
          </Link>
          <Link to="/Calendar" className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-200 hover:border-blue-500/40">
            <Calendar className="mb-1 h-4 w-4 text-blue-400" /> Calendar
          </Link>
          <Link to="/Notifications" className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-200 hover:border-blue-500/40">
            <Bell className="mb-1 h-4 w-4 text-blue-400" /> Notifications
          </Link>
          <Link to="/Settings" className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-200 hover:border-blue-500/40">
            <Settings className="mb-1 h-4 w-4 text-blue-400" /> Settings
          </Link>
          <Link to="/AppFaults" className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-200 hover:border-blue-500/40 sm:col-span-2">
            <AlertTriangle className="mb-1 h-4 w-4 text-amber-400" /> App Faults
          </Link>
        </div>
      </div>
    </div>
  );
}
