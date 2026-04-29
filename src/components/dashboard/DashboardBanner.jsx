import React, { useState, useEffect, useMemo } from 'react';
import { Phone, ArrowRight, Camera } from 'lucide-react';
import { format } from 'date-fns';
import { getDisplayName } from '../utils/nameUtils';
import { getScheduleDateTimes, shortenTitle } from '../utils/scheduleUtils';

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
    default: 'bg-gray-800 text-gray-300 border-gray-700/70',
    blue: 'bg-blue-950/40 text-blue-300 border-blue-800/50',
    yellow: 'bg-yellow-950/30 text-yellow-300 border-yellow-800/40',
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

export default function DashboardBanner({ user, shoots = [], standbyDays = [], allUsers = [] }) {
  const now = useClock();

  const getStandbyName = (sd) => {
    const u = allUsers.find((x) => x.email === sd.admin_email);
    return getDisplayName(u, sd.admin_email, sd.admin_name);
  };

  const currentStandby = useMemo(() => {
    return standbyDays.filter((sd) => {
      const startDate = sd.start_date || sd.date;
      const endDate = sd.end_date || startDate;
      if (!startDate) return false;
      const startDt = new Date(`${startDate}T${sd.start_time || '18:00'}`);
      const endDt = new Date(`${endDate}T${sd.end_time || '06:00'}`);
      return now >= startDt && now <= endDt;
    });
  }, [standbyDays, now]);

  const nextStandby = useMemo(() => {
    return standbyDays
      .filter((sd) => {
        const startDate = sd.start_date || sd.date;
        if (!startDate) return false;
        const startDt = new Date(`${startDate}T${sd.start_time || '18:00'}`);
        return startDt > now;
      })
      .sort((a, b) => {
        const aStart = new Date(`${a.start_date || a.date}T${a.start_time || '18:00'}`);
        const bStart = new Date(`${b.start_date || b.date}T${b.start_time || '18:00'}`);
        return aStart - bStart;
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
    <div className="mb-6 rounded-2xl border border-gray-800 bg-gradient-to-br from-gray-900 to-gray-900/80 px-4 py-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] sm:px-5">
      <div className="grid gap-4 lg:grid-cols-4">
        <Section label="Realtime / Date" accent="text-white">
          <div className="font-mono text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {now.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </div>
          <div className="mt-1 text-[11px] uppercase tracking-[0.16em] text-gray-400">
            {format(now, 'EEE, d MMM yyyy')}
          </div>
        </Section>

        <Section label="On Standby Now" accent="text-yellow-400">
          {currentStandby.length > 0 ? (
            <div className="space-y-2">
              {currentStandby.map((sd) => {
                const startDate = sd.start_date || sd.date;
                return (
                  <div key={`${sd.admin_email}-${startDate}-${sd.start_time || ''}`} className="flex items-center gap-2 text-base font-semibold text-white sm:text-lg">
                    <Phone className="h-4 w-4 text-yellow-400" />
                    <span className="truncate">{getStandbyName(sd)}</span>
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
              <div className="flex items-center gap-2 text-base font-semibold text-white sm:text-lg">
                <ArrowRight className="h-4 w-4 text-gray-500" />
                <span className="truncate">{getStandbyName(nextStandby)}</span>
              </div>
              <div className="pl-6">
                <InfoPill>{format(new Date(`${(nextStandby.start_date || nextStandby.date)}T12:00:00`), 'EEE, MMM d')}</InfoPill>
              </div>
            </div>
          ) : (
            <div className="pt-1 text-sm italic text-gray-500">No upcoming standby scheduled</div>
          )}
        </Section>

        <Section label="Your Next Shoot" accent="text-blue-400" withDivider={false}>
          {nextShoot ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-base font-semibold text-white sm:text-lg">
                <Camera className="h-4 w-4 text-blue-400" />
                <span className="truncate">{shortenTitle(nextShoot.title)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 pl-6">
                <InfoPill>{format(new Date(`${nextShoot.date}T12:00:00`), 'EEE, MMM d')}</InfoPill>
                {nextShootSchedule?.setup && <InfoPill tone="blue">setup {format(nextShootSchedule.setup, 'HH:mm')}</InfoPill>}
              </div>
              <div className="pl-6 font-mono text-lg font-bold text-blue-400">{nextShootCountdown}</div>
            </div>
          ) : (
            <div className="pt-1 text-sm italic text-gray-500">No upcoming assigned shoot</div>
          )}
        </Section>
      </div>
    </div>
  );
}
