import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Camera, Shield } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useApp } from '@/components/AppContext';
import { getDisplayName } from '@/components/utils/nameUtils';
import { formatDateZA, formatTimeZA, normalizeShootStatus } from '@/utils/shootStatus';
import { coverageForShoot } from '@/utils/standbyCoverage';
import DashboardSection from '@/components/dashboard/DashboardSection';

export default function ViewerSchedule() {
  const { user } = useApp();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const firstName = user?.full_name?.split(' ')[0] || 'Viewer';

  const { data: shoots = [] } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list('-date', 500),
  });
  const { data: users = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    staleTime: 5 * 60_000,
  });
  const { data: standbyDays = [] } = useQuery({
    queryKey: ['standbyDays'],
    queryFn: () => base44.entities.StandbyDay.list('-date', 500),
    staleTime: 2 * 60_000,
  });

  const upcoming = useMemo(() => (
    (shoots || [])
      .filter((shoot) => {
        if (!shoot?.date || shoot.date < todayStr) return false;
        const status = normalizeShootStatus(shoot.status);
        return status !== 'cancelled';
      })
      .sort((a, b) => {
        const date = String(a.date).localeCompare(String(b.date));
        if (date !== 0) return date;
        return String(a.game_time || a.start_time || '').localeCompare(String(b.game_time || b.start_time || ''));
      })
      .slice(0, 24)
  ), [shoots, todayStr]);

  return (
    <div className="rom-page">
      <div className="rom-page-inner">
        <header className="mb-8">
          <p className="rom-kicker mb-2">Dashboard</p>
          <h1 className="rom-title">Welcome, {firstName}</h1>
          <p className="rom-subtitle">Upcoming games, who is capturing, and who is on standby.</p>
        </header>

        <DashboardSection
          title="Upcoming games"
          extra={<span className="text-xs text-slate-500">View only</span>}
        >
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No upcoming games.</p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((shoot) => {
                const operators = (shoot.assigned_operators || [])
                  .map((email) => getDisplayName(users.find((item) => item.email === email), email))
                  .filter(Boolean);
                const standby = coverageForShoot(shoot, standbyDays);
                const standbyName = standby
                  ? (standby.admin_name || getDisplayName(users.find((item) => item.email === standby.admin_email), standby.admin_email))
                  : '';
                return (
                  <div key={shoot.id} className="rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-100">{shoot.title || 'Untitled shoot'}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {formatDateZA(shoot.date, { weekday: 'short' })}
                      {(shoot.game_time || shoot.start_time) ? ` · ${formatTimeZA(shoot.game_time || shoot.start_time)}` : ''}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                      <span className="inline-flex items-center gap-1.5 text-slate-300">
                        <Camera className="h-3.5 w-3.5 text-blue-400" />
                        {operators.length ? operators.join(', ') : 'Unassigned'}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-slate-300">
                        <Shield className="h-3.5 w-3.5 text-amber-400" />
                        {standbyName || 'No standby'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DashboardSection>
      </div>
    </div>
  );
}
