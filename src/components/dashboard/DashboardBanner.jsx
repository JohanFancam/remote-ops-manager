import React, { useState, useEffect, useMemo } from 'react';
import { Phone, Clock3, ArrowRight, Camera } from 'lucide-react';
import { format } from 'date-fns';
import { getDisplayName } from '../utils/nameUtils';
import {
  getScheduleDateTimes,
  shortenTitle,
  getPrimaryDateTime,
  isShootComplete,
  isShootCancelled,
  isShootCurrent,
  getStandbyWindowDateTimes,
} from '../utils/scheduleUtils';

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);
  return now;
}

function formatCountdown(ms) {
  if (ms == null) return '—';
  if (ms <= 0) return 'NOW';
  const days = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${days > 0 ? `${days}d ` : ''}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function InfoPill({ children, tone = 'default' }) {
  const toneClasses = {
    default: 'bg-gray-800 text-gray-300 border-gray-700/70',
    blue: 'bg-blue-950/40 text-blue-300 border-blue-800/50',
    yellow: 'bg-yellow-950/30 text-yellow-300 border-yellow-800/40',
    green: 'bg-emerald-950/30 text-emerald-300 border-emerald-800/40',
  };
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${toneClasses[tone] || toneClasses.default}`}>
      {children}
    </span>
  );
}

function Section({ label, accent = 'text-gray-400', children, withDivider = true }) {
  return (
    <div className="flex min-w-0 flex-1 items-stretch">
      <div className="min-w-0 flex-1 px-1 sm:px-3">
        <p className={`mb-2 text-[10px] font-bold uppercase tracking-[0.16em] ${accent}`}>{label}</p>
        {children}
      </div>
      {withDivider && <div className="hidden lg:block w-px bg-gray-800/80" />}
    </div>
  );
}

function getShootStatusLabel(shoot, now) {
  if (isShootComplete(shoot)) return 'Complete';
  if (shoot?.status === 'in_progress' || isShootCurrent(shoot, now)) return 'Current';
  return 'Next Up';
}

export default function DashboardBanner({ user, shoots = [], standbyDays = [], allUsers = [] }) {
  const now = useClock();

  const getStandbyName = (sd) => {
    const u = allUsers.find((x) => x.email === sd.admin_email);
    return getDisplayName(u, sd.admin_email, sd.admin_name);
  };

  const currentStandby = useMemo(() => {
    return standbyDays.filter((sd) => {
      const windowRange = getStandbyWindowDateTimes(sd);
      return windowRange && now >= windowRange.start && now <= windowRange.end;
    });
  }, [standbyDays, now]);

  const nextStandby = useMemo(() => {
    return standbyDays
      .filter((sd) => {
        const windowRange = getStandbyWindowDateTimes(sd);
        return windowRange && windowRange.start > now;
      })
      .sort((a, b) => {
        const aStart = getStandbyWindowDateTimes(a)?.start;
        const bStart = getStandbyWindowDateTimes(b)?.start;
        return aStart - bStart;
      })[0] || null;
  }, [standbyDays, now]);

  const myActiveOrUpcomingShoots = useMemo(() => {
    return shoots
      .filter((shoot) => {
        if (isShootCancelled(shoot) || isShootComplete(shoot)) return false;
        if (!shoot.assigned_operators?.includes(user?.email)) return false;
        return !!getPrimaryDateTime(shoot);
      })
      .sort((a, b) => getPrimaryDateTime(a) - getPrimaryDateTime(b));
  }, [shoots, user?.email]);

  const currentShoot = useMemo(() => {
    const currentTodayShoots = myActiveOrUpcomingShoots
      .filter((shoot) => isShootCurrent(shoot, now))
      .sort((a, b) => getPrimaryDateTime(b) - getPrimaryDateTime(a));
    return currentTodayShoots[0] || null;
  }, [myActiveOrUpcomingShoots, now]);

  const upcomingShoot = useMemo(() => {
    return myActiveOrUpcomingShoots.find((shoot) => {
      const primaryDate = getPrimaryDateTime(shoot);
      return primaryDate && primaryDate >= now;
    }) || null;
  }, [myActiveOrUpcomingShoots, now]);

  const featuredShoot = currentShoot || upcomingShoot;
  const featuredShootSchedule = featuredShoot ? getScheduleDateTimes(featuredShoot) : null;
  const featuredShootTarget = featuredShoot ? getPrimaryDateTime(featuredShoot) : null;
  const featuredShootCountdown = featuredShootTarget ? formatCountdown(featuredShootTarget - now) : '—';
  const featuredShootStatus = featuredShoot ? getShootStatusLabel(featuredShoot, now) : null;

  return (
    <div className="mb-6 rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-900/80 px-4 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] sm:px-5">
      <div className="grid gap-4 lg:grid-cols-4">
        <Section label="Realtime / Date" accent="text-white">
          <div className="font-mono text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {now.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-gray-400">
            {format(now, 'EEEE, d MMMM yyyy')}
          </div>
        </Section>

        <Section label="On Standby Now" accent="text-yellow-400">
          {currentStandby.length > 0 ? (
            <div className="space-y-2">
              {currentStandby.map((sd) => {
                const windowRange = getStandbyWindowDateTimes(sd);
                const startDate = sd.start_date || sd.date;
                const endDate = sd.end_date || startDate;
                return (
                  <div key={`${sd.admin_email}-${startDate}-${sd.start_time || ''}`} className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Phone className="h-3.5 w-3.5 text-yellow-400" />
                      <span className="truncate">{getStandbyName(sd)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-5">
                      <InfoPill>{format(new Date(`${startDate}T12:00:00`), 'MMM d')}</InfoPill>
                      {endDate && endDate !== startDate && <InfoPill>{format(new Date(`${endDate}T12:00:00`), 'MMM d')}</InfoPill>}
                      {windowRange?.end && <InfoPill tone="yellow">ends {format(windowRange.end, 'HH:mm')}</InfoPill>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="pt-1 text-sm italic text-gray-500">No one on standby right now</div>
          )}
        </Section>

        <Section label="Next On Standby" accent="text-gray-400">
          {nextStandby ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <ArrowRight className="h-3.5 w-3.5 text-gray-500" />
                <span className="truncate">{getStandbyName(nextStandby)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pl-5">
                <InfoPill>{format(new Date(`${(nextStandby.start_date || nextStandby.date)}T12:00:00`), 'MMM d')}</InfoPill>
                {nextStandby.start_time && <InfoPill>{nextStandby.start_time}</InfoPill>}
              </div>
            </div>
          ) : (
            <div className="pt-1 text-sm italic text-gray-500">No upcoming standby scheduled</div>
          )}
        </Section>

        <Section label={currentShoot ? 'Your Current Shoot' : 'Your Next Shoot'} accent="text-blue-400" withDivider={false}>
          {featuredShoot ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <Camera className="h-3.5 w-3.5 text-blue-400" />
                <span className="truncate">{shortenTitle(featuredShoot.title)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pl-5">
                <InfoPill>{format(new Date(`${featuredShoot.date}T12:00:00`), 'MMM d')}</InfoPill>
                {featuredShootSchedule?.setup && <InfoPill tone="blue">setup {format(featuredShootSchedule.setup, 'HH:mm')}</InfoPill>}
                {featuredShootStatus && <InfoPill tone={currentShoot ? 'green' : 'blue'}>{featuredShootStatus}</InfoPill>}
              </div>
              <div className="pl-5 flex items-center gap-2">
                <Clock3 className="h-4 w-4 text-blue-400" />
                <span className="font-mono text-lg font-bold text-blue-400">
                  {currentShoot ? 'Active today' : featuredShootCountdown}
                </span>
              </div>
            </div>
          ) : (
            <div className="pt-1 text-sm italic text-gray-500">No upcoming assigned shoot</div>
          )}
        </Section>
      </div>
    </div>
  );
}
