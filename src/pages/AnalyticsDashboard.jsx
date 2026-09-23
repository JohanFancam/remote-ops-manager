import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, addDays } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Camera, Wrench, Clock, AlertCircle } from 'lucide-react';
import { getDisplayName } from '@/components/utils/nameUtils';
import { formatDateZA, formatTimeZA, normalizeShootStatus } from '@/utils/shootStatus';
import { getShootRigLabel } from '@/components/calendar/ShootQuickView';

function timeToMinutes(time) {
  const [h, m] = String(time || '12:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

function coverageForShoot(shoot, standbyDays) {
  if (!shoot?.date) return null;
  const shootTime = shoot.game_time || shoot.start_time || '12:00';
  const shootDateTime = new Date(`${shoot.date}T00:00:00`);
  shootDateTime.setMinutes(timeToMinutes(shootTime));
  return (standbyDays || []).find((standby) => {
    const startDateStr = standby.start_date || standby.date;
    if (!startDateStr) return false;
    const fallbackEndDate = format(addDays(new Date(`${startDateStr}T00:00:00`), 1), 'yyyy-MM-dd');
    const endDateStr = standby.end_date || fallbackEndDate;
    const start = new Date(`${startDateStr}T${standby.start_time || '18:00'}:00`);
    const end = new Date(`${endDateStr}T${standby.end_time || '06:00'}:00`);
    return shootDateTime >= start && shootDateTime <= end;
  }) || null;
}

export default function AnalyticsDashboard() {
  const { user } = useApp();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const { data: shoots = [] } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list('-date', 800),
  });
  const { data: reports = [] } = useQuery({
    queryKey: ['shootReports'],
    queryFn: () => base44.entities.ShootReport.list('-created_date', 300),
  });
  const { data: users = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
  });
  const { data: standbyDays = [] } = useQuery({
    queryKey: ['standbyDays'],
    queryFn: () => base44.entities.StandbyDay.list('-date', 400),
  });
  const { data: rigSettings = [] } = useQuery({
    queryKey: ['rigSettings'],
    queryFn: () => base44.entities.RigSetting.list(),
  });

  const assignedRows = useMemo(() => {
    return shoots
      .filter((s) => normalizeShootStatus(s.status) !== 'cancelled')
      .filter((s) => (s.date || '') >= todayStr)
      .filter((s) => (s.assigned_operators || []).length > 0)
      .sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.game_time || '').localeCompare(b.game_time || ''))
      .slice(0, 40)
      .flatMap((shoot) => (shoot.assigned_operators || []).map((email) => ({
        id: `${shoot.id}-${email}`,
        date: shoot.date,
        time: shoot.game_time || shoot.start_time || '',
        title: shoot.title,
        photo: getShootRigLabel(shoot, rigSettings),
        operator: getDisplayName(users.find((u) => u.email === email), email),
      })));
  }, [shoots, users, rigSettings, todayStr]);

  const recentReports = useMemo(
    () => [...reports].sort((a, b) => String(b.created_date || b.completed_at || '').localeCompare(String(a.created_date || a.completed_at || ''))).slice(0, 12),
    [reports]
  );

  const upcomingStandby = useMemo(() => {
    return (standbyDays || [])
      .filter((sd) => (sd.start_date || sd.date || '') >= todayStr)
      .sort((a, b) => String(a.start_date || a.date).localeCompare(String(b.start_date || b.date)))
      .slice(0, 8)
      .map((sd) => {
        const covered = shoots.filter((shoot) => {
          if (normalizeShootStatus(shoot.status) === 'cancelled') return false;
          return coverageForShoot(shoot, [sd]);
        });
        return {
          ...sd,
          name: getDisplayName(users.find((u) => u.email === sd.admin_email), sd.admin_email),
          covered,
        };
      });
  }, [standbyDays, shoots, users, todayStr]);

  const firstName = user?.full_name?.split(' ')[0] || 'Analytics';

  return (
    <div className="rom-page">
      <div className="rom-page-inner">
        <header className="mb-8">
          <p className="rom-kicker mb-2">Data Analytics</p>
          <h1 className="rom-title">Welcome, {firstName}</h1>
          <p className="rom-subtitle">Operator photo assignments, rig reports, and standby coverage. Calendar edits go to admins first.</p>
        </header>

        <section className="mb-8">
          <h2 className="rom-section-title mb-3 flex items-center gap-2">
            <Camera className="h-4 w-4 text-blue-400" /> Who is shooting what
          </h2>
          <Card className="bg-slate-900 border-slate-800">
            <CardContent className="p-0">
              {assignedRows.length === 0 ? (
                <p className="text-sm text-slate-500 px-4 py-8 text-center">No upcoming assigned shoots.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-800">
                        <th className="px-4 py-2.5">Date</th>
                        <th className="px-4 py-2.5">Time</th>
                        <th className="px-4 py-2.5">Shoot</th>
                        <th className="px-4 py-2.5">Photo</th>
                        <th className="px-4 py-2.5">Operator</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assignedRows.map((row) => (
                        <tr key={row.id} className="border-b border-slate-800/80 last:border-0">
                          <td className="px-4 py-2.5 text-slate-300 whitespace-nowrap">{formatDateZA(row.date, { weekday: 'short' })}</td>
                          <td className="px-4 py-2.5 text-slate-400 whitespace-nowrap">{row.time ? formatTimeZA(row.time) : '—'}</td>
                          <td className="px-4 py-2.5 text-slate-100">{row.title}</td>
                          <td className="px-4 py-2.5 text-slate-300">{row.photo}</td>
                          <td className="px-4 py-2.5 text-slate-200">{row.operator}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="mb-8">
          <h2 className="rom-section-title mb-3 flex items-center gap-2">
            <Wrench className="h-4 w-4 text-blue-400" /> Rig reports
          </h2>
          <div className="space-y-2">
            {recentReports.length === 0 ? (
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-8 text-center text-sm text-slate-500">No rig reports yet.</CardContent>
              </Card>
            ) : recentReports.map((report) => (
              <Card key={report.id} className="bg-slate-900 border-slate-800">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-100">{report.shoot_title || 'Untitled shoot'}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {report.operator_name || report.operator_email || 'Operator'}
                        {report.shoot_date ? ` · ${formatDateZA(report.shoot_date)}` : ''}
                      </p>
                    </div>
                    {report.had_issues ? (
                      <Badge className="bg-red-950/40 text-red-300 border-red-800 gap-1">
                        <AlertCircle className="h-3 w-3" /> Issues
                      </Badge>
                    ) : (
                      <Badge className="bg-slate-800 text-slate-300 border-slate-700">Clear</Badge>
                    )}
                  </div>
                  {report.notes && <p className="text-xs text-slate-400 mt-2">{report.notes}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="rom-section-title mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-400" /> Standby overview
          </h2>
          <div className="space-y-2">
            {upcomingStandby.length === 0 ? (
              <Card className="bg-slate-900 border-slate-800">
                <CardContent className="p-8 text-center text-sm text-slate-500">No upcoming standby sessions.</CardContent>
              </Card>
            ) : upcomingStandby.map((session) => (
              <Card key={session.id || `${session.start_date}-${session.admin_email}`} className="bg-slate-900 border-slate-800">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold text-slate-100">{session.name}</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {formatDateZA(session.start_date || session.date, { weekday: 'short' })} · {session.start_time || '18:00'}–{session.end_time || '06:00'}
                  </p>
                  {session.covered.length === 0 ? (
                    <p className="text-xs text-slate-500 mt-2">No covered shoots in this window yet.</p>
                  ) : (
                    <ul className="mt-2 space-y-1">
                      {session.covered.slice(0, 8).map((shoot) => (
                        <li key={shoot.id} className="text-xs text-slate-300">
                          {formatTimeZA(shoot.game_time || shoot.start_time || '')} · {shoot.title}
                          {' · '}
                          {getShootRigLabel(shoot, rigSettings)}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
