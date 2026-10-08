import React, { useState, useEffect, useMemo } from 'react';
import { Phone, ArrowRight, Camera } from 'lucide-react';
import { getDisplayName } from '../utils/nameUtils';
import { getScheduleDateTimes, shortenTitle } from '../utils/scheduleUtils';
import { useTimezone } from '@/components/TimezoneContext';
import { formatHmInTz, parseSourceDateTime } from '@/utils/timezone';
import { formatDateZA, formatTimeZA } from '@/utils/shootStatus';

function useClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);
  return now;
}

function formatCountdown(ms) {
  if (ms == null) return '-';
  if (ms <= 0) return 'NOW';
  const days = Math.floor(ms / 86400000);
  const h = Math.floor((ms % 86400000) / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${days > 0 ? `${days}d ` : ''}${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function InfoPill({ children, tone = 'default' }) {
  const toneClasses = {
    default: 'bg-white/5 text-slate-300 border-[color:var(--rom-line)]',
    blue: 'bg-orange-500/10 text-orange-300 border-orange-500/25',
    yellow: 'bg-sky-500/10 text-sky-300 border-sky-500/25',
  };
  return (
    <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${toneClasses[tone] || toneClasses.default}`}>
      {children}
    </span>
  );
}

function Section({ label, accent = 'text-slate-500', children, withDivider = true }) {
  return (
    <div className="flex min-w-0 flex-1 items-stretch">
      <div className="min-w-0 flex-1 px-1 sm:px-3">
        <p className={`mb-2.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${accent}`}>{label}</p>
        {children}
      </div>
      {withDivider && <div className="hidden lg:block w-px shrink-0 bg-[color:var(--rom-line)]" />}
    </div>
  );
}

export default function DashboardBanner({ user, shoots = [], standbyDays = [], allUsers = [], showNextShoot = true }) {
  const now = useClock();
  const { timeZone, abbr } = useTimezone();

  const getStandbyName = (sd) => {
    const u = allUsers.find((x) => x.email === sd.admin_email);
    return getDisplayName(u, sd.admin_email, sd.admin_name);
  };

  const currentStandby = useMemo(() => {
    return standbyDays.filter((sd) => {
      const startDate = sd.start_date || sd.date;
      const endDate = sd.end_date || startDate;
      if (!startDate) return false;
      const startDt = parseSourceDateTime(startDate, sd.start_time || '18:00');
      const endDt = parseSourceDateTime(endDate, sd.end_time || '06:00');
      return startDt && endDt && now >= startDt && now <= endDt;
    });
  }, [standbyDays, now]);

  const nextStandby = useMemo(() => {
    return standbyDays
      .filter((sd) => {
        const startDate = sd.start_date || sd.date;
        if (!startDate) return false;
        const startDt = parseSourceDateTime(startDate, sd.start_time || '18:00');
        return startDt && startDt > now;
      })
      .sort((a, b) => {
        const aStart = parseSourceDateTime(a.start_date || a.date, a.start_time || '18:00');
        const bStart = parseSourceDateTime(b.start_date || b.date, b.start_time || '18:00');
        return (aStart?.getTime() || 0) - (bStart?.getTime() || 0);
      })[0] || null;
  }, [standbyDays, now]);

  const nextShoot = useMemo(() => {
    const assigned = shoots
      .filter((shoot) => {
        if (shoot.status === 'cancelled' || shoot.status === 'completed' || shoot.phase_status?.shoot_complete) return false;
        if (!shoot.assigned_operators?.includes(user?.email)) return false;
        const scheduleDates = getScheduleDateTimes(shoot);
        const game = scheduleDates.game || new Date(`${shoot.date}T${shoot.game_time || '23:59'}`);
        return game && game >= new Date(now.getTime() - 6 * 60 * 60 * 1000);
      })
      .sort((a, b) => {
        const aSchedule = getScheduleDateTimes(a);
        const bSchedule = getScheduleDateTimes(b);
        const aTarget = aSchedule.setup || aSchedule.game || new Date(`${a.date}T${a.game_time || '23:59'}`);
        const bTarget = bSchedule.setup || bSchedule.game || new Date(`${b.date}T${b.game_time || '23:59'}`);
        return aTarget - bTarget;
      });
    return assigned[0] || null;
  }, [shoots, user?.email, now]);

  const nextShootSchedule = nextShoot ? getScheduleDateTimes(nextShoot) : null;
  const nextShootTarget = nextShootSchedule?.setup || nextShootSchedule?.game || null;
  const nextShootCountdown = nextShootTarget ? formatCountdown(nextShootTarget - now) : '-';

  return (
    <div className="rom-panel relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-orange-500/[0.07] via-transparent to-orange-400/[0.04]" />
      <div className={`relative grid gap-5 sm:grid-cols-2 ${showNextShoot ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
        <Section label="Now" accent="text-orange-400/80">
          <div className="rom-mono text-2xl font-medium tracking-tight text-slate-50 sm:text-3xl tabular-nums">
            {now.toLocaleTimeString('en-ZA', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
          </div>
          <div className="mt-1.5 text-[11px] uppercase tracking-[0.14em] text-slate-500">
            {now.toLocaleDateString('en-ZA', { timeZone, weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            <span className="ml-2 text-slate-600">{abbr}</span>
          </div>
        </Section>

        <Section label="On Standby" accent="text-sky-400/80">
          {currentStandby.length > 0 ? (
            <div className="space-y-2">
              {currentStandby.map((sd) => {
                const startDate = sd.start_date || sd.date;
                return (
                  <div key={`${sd.admin_email}-${startDate}-${sd.start_time || ''}`} className="space-y-1">
                    <div className="flex items-center gap-2 text-base font-semibold text-slate-50 sm:text-lg">
                      <Phone className="h-4 w-4 text-sky-400" />
                      <span className="truncate">{getStandbyName(sd)}</span>
                    </div>
                    <div className="pl-6">
                      <InfoPill tone="yellow">
                        {formatDateZA(startDate, { weekday: 'short', month: 'short', time: sd.start_time || '18:00' })}
                        {sd.start_time ? ` · ${formatTimeZA(sd.start_time, startDate)}` : ''}
                      </InfoPill>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="pt-1 text-sm text-slate-500">No one on standby</div>
          )}
        </Section>

        <Section label="Next Standby" accent="text-slate-500" withDivider={showNextShoot}>
          {nextStandby ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-base font-semibold text-slate-50 sm:text-lg">
                <ArrowRight className="h-4 w-4 text-slate-500" />
                <span className="truncate">{getStandbyName(nextStandby)}</span>
              </div>
              <div className="pl-6">
                <InfoPill>
                  {formatDateZA(nextStandby.start_date || nextStandby.date, {
                    weekday: 'short',
                    month: 'short',
                    time: nextStandby.start_time || '18:00',
                  })}
                  {nextStandby.start_time ? ` · ${formatTimeZA(nextStandby.start_time, nextStandby.start_date || nextStandby.date)}` : ''}
                </InfoPill>
              </div>
            </div>
          ) : (
            <div className="pt-1 text-sm text-slate-500">None scheduled</div>
          )}
        </Section>

        {showNextShoot && (
          <Section label="Your Next Shoot" accent="text-orange-400/80" withDivider={false}>
            {nextShoot ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-base font-semibold text-slate-50 sm:text-lg">
                  <Camera className="h-4 w-4 text-orange-400" />
                  <span className="truncate">{shortenTitle(nextShoot.title)}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pl-6">
                  <InfoPill>{formatDateZA(nextShoot.date, { weekday: 'short', month: 'short', time: nextShoot.game_time })}</InfoPill>
                  {nextShootSchedule?.setup && <InfoPill tone="blue">setup {formatHmInTz(nextShootSchedule.setup, timeZone)}</InfoPill>}
                </div>
                <div className="pl-6 rom-mono text-lg font-medium text-orange-300 tabular-nums">{nextShootCountdown}</div>
              </div>
            ) : (
              <div className="pt-1 text-sm text-slate-500">No upcoming shoot</div>
            )}
          </Section>
        )}
      </div>
    </div>
  );
}
