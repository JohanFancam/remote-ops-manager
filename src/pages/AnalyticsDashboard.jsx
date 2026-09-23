import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { addDays, format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Badge } from '@/components/ui/badge';
import { Camera, Wrench, Clock, AlertCircle } from 'lucide-react';
import { getDisplayName } from '@/components/utils/nameUtils';
import { formatTimeZA, normalizeShootStatus } from '@/utils/shootStatus';
import { getShootRigLabel } from '@/components/calendar/ShootQuickView';
import DayWindow, { shiftDayWindow } from '@/components/analytics/DayWindow';

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
  const [standbyWindow, setStandbyWindow] = useState(today);

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
      map.set(key, [...(map.get(key) || []), report]);
    });
    for (const [key, list] of map) {
      map.set(key, [...list].sort((a, b) => String(b.created_date || b.completed_at || '').localeCompare(String(a.created_date || a.completed_at || ''))));
    }
    return map;
  }, [reports]);

  const standbyByDate = useMemo(() => {
    const map = new Map();
    (standbyDays || []).forEach((sd) => {
      const key = sd.start_date || sd.date;
      if (!key) return;
      const covered = shoots.filter((shoot) => {
        if (normalizeShootStatus(shoot.status) === 'cancelled') return false;
        return coverageForShoot(shoot, [sd]);
      });
      map.set(key, [...(map.get(key) || []), {
        ...sd,
        name: getDisplayName(users.find((u) => u.email === sd.admin_email), sd.admin_email),
        covered,
      }]);
    });
    return map;
  }, [standbyDays, shoots, users]);

  const firstName = user?.full_name?.split(' ')[0] || 'Analytics';

  return (
    <div className="rom-page">
      <div className="rom-page-inner">
        <header className="mb-8">
          <p className="rom-kicker mb-2">Data Analytics</p>
          <h1 className="rom-title">Welcome, {firstName}</h1>
          <p className="rom-subtitle">
            Operator photo assignments, rig reports, and standby coverage — four days at a time.
            Calendar edits go to admins first.
          </p>
        </header>

        <section className="mb-8">
          <h2 className="rom-section-title mb-3 flex items-center gap-2">
            <Camera className="h-4 w-4 text-blue-400" /> Who is shooting what
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
                      <p className="text-sm font-semibold text-slate-100 leading-snug">{row.title}</p>
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
                        {report.had_issues ? (
                          <Badge className="shrink-0 bg-red-950/40 text-red-300 border-red-800 gap-1">
                            <AlertCircle className="h-3 w-3" /> Issues
                          </Badge>
                        ) : (
                          <Badge className="shrink-0 bg-slate-800 text-slate-300 border-slate-700">Clear</Badge>
                        )}
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

        <section className="mb-8">
          <h2 className="rom-section-title mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-400" /> Standby overview
          </h2>
          <DayWindow
            startDate={standbyWindow}
            onPrev={() => setStandbyWindow((d) => shiftDayWindow(d, -1))}
            onNext={() => setStandbyWindow((d) => shiftDayWindow(d, 1))}
            emptyLabel="No standby coverage."
            renderDay={(dateStr) => {
              const sessions = standbyByDate.get(dateStr) || [];
              if (sessions.length === 0) return null;
              return (
                <ul className="space-y-2">
                  {sessions.map((session) => (
                    <li key={session.id || `${session.start_date}-${session.admin_email}`} className="rounded-lg bg-slate-800/70 px-3 py-2">
                      <p className="text-sm font-semibold text-slate-100">{session.name}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {session.start_time || '18:00'}–{session.end_time || '06:00'}
                      </p>
                      {session.covered.length === 0 ? (
                        <p className="mt-2 text-xs text-slate-500">No covered shoots yet.</p>
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
