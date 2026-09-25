import React from 'react';
import { format } from 'date-fns';
import { getDisplayName } from '@/components/utils/nameUtils';
import { uniqueStandbyPeople, upcomingStandbySessions, standbyColorForEmail } from '@/components/utils/standbyColors';
import { normalizeEmail } from '@/utils/assignmentApproval';

function firstName(name) {
  return String(name || '').trim().split(/\s+/)[0] || name;
}

/**
 * Shared standby roster for admins, operator/standby, and data users.
 * Remotes keep the day-name chip on the calendar and do not get this panel.
 */
export default function StandbyCoverageOverview({
  standbyDays = [],
  allUsers = [],
  todayStr,
  currentUserEmail = '',
  overviewOnly = false,
}) {
  const people = uniqueStandbyPeople(standbyDays);
  const sessions = upcomingStandbySessions(standbyDays, todayStr).slice(0, 12);

  if (!people.length && !sessions.length) {
    return (
      <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900 p-3">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Standby coverage</p>
        <p className="mt-1.5 text-sm text-slate-500">Nobody is on the standby roster yet.</p>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-xl border border-slate-800 bg-slate-900 p-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Standby coverage</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {overviewOnly
              ? 'Who is covering each night (18:00–06:00).'
              : 'Your nights and everyone else’s, so you can plan coverage together.'}
          </p>
        </div>
      </div>

      {people.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {people.map((person) => {
            const mine = normalizeEmail(person.email) === normalizeEmail(currentUserEmail);
            return (
              <span
                key={person.email}
                className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] ${person.color.chip}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${person.color.dot}`} />
                {firstName(person.name)}
                {mine ? ' · you' : ''}
              </span>
            );
          })}
        </div>
      )}

      {sessions.length > 0 && (
        <ul className="mt-3 divide-y divide-slate-800/80">
          {sessions.map((session) => {
            const start = session.start_date || session.date;
            const color = standbyColorForEmail(session.admin_email);
            const name = getDisplayName(
              allUsers.find((user) => user.email === session.admin_email),
              session.admin_email,
              session.admin_name
            );
            const mine = normalizeEmail(session.admin_email) === normalizeEmail(currentUserEmail);
            return (
              <li key={session.id || `${start}-${session.admin_email}`} className="flex items-center justify-between gap-3 py-1.5">
                <div className="min-w-0">
                  <p className={`truncate text-sm ${color.text}`}>
                    {name}{mine ? ' · you' : ''}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {start ? format(new Date(`${start}T12:00:00`), 'EEE, d MMM') : '—'}
                    {' · '}
                    {session.start_time || '18:00'}–{session.end_time || '06:00'}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
