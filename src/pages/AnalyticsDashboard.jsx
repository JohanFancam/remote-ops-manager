import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addDays } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Badge } from '@/components/ui/badge';
import { Camera, Wrench, AlertCircle } from 'lucide-react';
import { getDisplayName } from '@/components/utils/nameUtils';
import { formatTimeZA, normalizeShootStatus } from '@/utils/shootStatus';
import { getShootRigLabel } from '@/components/calendar/ShootQuickView';
import DayWindow, { shiftDayWindow } from '@/components/analytics/DayWindow';
import { compareLiveDataFirst, isLiveData, LiveDataBadge } from '@/components/shoots/LiveDataControls';

function reportDayKey(report) {
  return report.shoot_date || String(report.created_date || report.completed_at || '').slice(0, 10);
}

export default function AnalyticsDashboard() {
  const { user } = useApp();
  const today = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    return now;
  }, []);
  const [shootWindow, setShootWindow] = useState(today);
  const [reportWindow, setReportWindow] = useState(addDays(today, -3));

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
  const { data: rigSettings = [] } = useQuery({
    queryKey: ['rigSettings'],
    queryFn: () => base44.entities.RigSetting.list(),
  });

  const assignedByDate = useMemo(() => {
    const map = new Map();
    shoots
      .filter((s) => normalizeShootStatus(s.status) !== 'cancelled')
      .filter((s) => (s.assigned_operators || []).length > 0)
      .forEach((shoot) => {
        const key = shoot.date;
        if (!key) return;
        const rows = (shoot.assigned_operators || []).map((email) => ({
          id: `${shoot.id}-${email}`,
          time: shoot.game_time || shoot.start_time || '',
          title: shoot.title,
          photo: getShootRigLabel(shoot, rigSettings),
          operator: getDisplayName(users.find((u) => u.email === email), email),
          liveData: isLiveData(shoot),
        }));
        map.set(key, [...(map.get(key) || []), ...rows].sort((a, b) => (a.time || '').localeCompare(b.time || '')));
      });
    return map;
  }, [shoots, users, rigSettings]);

  const reportsByDate = useMemo(() => {
    const map = new Map();
    reports.forEach((report) => {
      const key = reportDayKey(report);
      if (!key) return;
      const shoot = shoots.find((item) => item.id === report.shoot_id)
        || shoots.find((item) => item.title === report.shoot_title && item.date === report.shoot_date);
      map.set(key, [...(map.get(key) || []), { ...report, live_data: isLiveData(shoot) }]);
    });
    for (const [key, list] of map) {
      map.set(key, [...list].sort((a, b) => compareLiveDataFirst(a, b, () => (
        String(b.created_date || b.completed_at || '').localeCompare(String(a.created_date || a.completed_at || ''))
      ))));
    }
    return map;
  }, [reports, shoots]);

  const firstName = user?.full_name?.split(' ')[0] || 'Analytics';

  return (
    <div className="rom-page">
      <div className="rom-page-inner">
        <header className="mb-8">
          <p className="rom-kicker mb-2">Data Analytics</p>
          <h1 className="rom-title">Welcome, {firstName}</h1>
          <p className="rom-subtitle">
            Photography overview and rig reports — four days at a time.
            Calendar edits go to admins first.
          </p>
        </header>

        <section className="mb-8">
          <h2 className="rom-section-title mb-3 flex items-center gap-2">
            <Camera className="h-4 w-4 text-blue-400" /> Photography overview
          </h2>
          <DayWindow
            startDate={shootWindow}
            onPrev={() => setShootWindow((d) => shiftDayWindow(d, -1))}
            onNext={() => setShootWindow((d) => shiftDayWindow(d, 1))}
            emptyLabel="No assigned shoots."
            renderDay={(dateStr) => {
              const rows = assignedByDate.get(dateStr) || [];
              if (rows.length === 0) return null;
              return (
                <ul className="space-y-2">
                  {rows.map((row) => (
                    <li key={row.id} className="rounded-lg bg-slate-800/70 px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-100 leading-snug">{row.title}</p>
                        {row.liveData ? <LiveDataBadge /> : null}
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        {row.time ? formatTimeZA(row.time) : 'Time TBC'}
                        {' · '}
                        {row.photo || 'Photo TBC'}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-200">{row.operator}</p>
                    </li>
                  ))}
                </ul>
              );
            }}
          />
        </section>

        <section className="mb-8">
          <h2 className="rom-section-title mb-3 flex items-center gap-2">
            <Wrench className="h-4 w-4 text-blue-400" /> Rig issues
          </h2>
          <DayWindow
            startDate={reportWindow}
            onPrev={() => setReportWindow((d) => shiftDayWindow(d, -1))}
            onNext={() => setReportWindow((d) => shiftDayWindow(d, 1))}
            emptyLabel="No rig reports."
            renderDay={(dateStr) => {
              const dayReports = reportsByDate.get(dateStr) || [];
              if (dayReports.length === 0) return null;
              return (
                <ul className="space-y-2">
                  {dayReports.map((report) => (
                    <li key={report.id} className="rounded-lg bg-slate-800/70 px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-100 leading-snug">{report.shoot_title || 'Untitled shoot'}</p>
                        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                          {isLiveData(report) ? <LiveDataBadge /> : null}
                          {report.had_issues ? (
                            <Badge className="shrink-0 bg-red-950/40 text-red-300 border-red-800 gap-1">
                              <AlertCircle className="h-3 w-3" /> Issues
                            </Badge>
                          ) : (
                            <Badge className="shrink-0 bg-slate-800 text-slate-300 border-slate-700">Clear</Badge>
                          )}
                        </div>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {report.operator_name || report.operator_email || 'Operator'}
                      </p>
                      {report.notes && <p className="mt-1 text-xs text-slate-400">{report.notes}</p>}
                    </li>
                  ))}
                </ul>
              );
            }}
          />
        </section>
      </div>
    </div>
  );
}
