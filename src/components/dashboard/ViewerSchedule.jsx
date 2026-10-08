import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, Camera, Shield } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useApp } from '@/components/AppContext';
import { getDisplayName } from '@/components/utils/nameUtils';
import { shortenTitle } from '@/components/utils/scheduleUtils';
import { formatDateTimeZA, normalizeShootStatus } from '@/utils/shootStatus';
import { coverageForShoot } from '@/utils/standbyCoverage';
import DashboardSection from '@/components/dashboard/DashboardSection';
import DashboardBanner from '@/components/dashboard/DashboardBanner';
import { useTimezone } from '@/components/TimezoneContext';
import { displayYmdForSource, formatYmdInTz } from '@/utils/timezone';

const PAGE_SIZE_KEY = 'viewer_dashboard_page_size';
const LOCAL_KEY = 'rom_viewer_dashboard_page_size';

function parsePageSize(value) {
  const n = Number(value);
  return n === 6 ? 6 : 4;
}

function ViewerGameTile({ shoot, users, standbyDays }) {
  const operators = (shoot.assigned_operators || [])
    .map((email) => getDisplayName(users.find((item) => item.email === email), email))
    .filter(Boolean);
  const standby = coverageForShoot(shoot, standbyDays);
  const standbyName = standby
    ? (standby.admin_name || getDisplayName(users.find((item) => item.email === standby.admin_email), standby.admin_email))
    : '';
  const status = normalizeShootStatus(shoot.status);
  const postponed = status === 'postponed';

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-3 min-h-[132px] flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-slate-100 leading-snug line-clamp-2">
          {shortenTitle(shoot.title) || 'Untitled shoot'}
        </p>
        {postponed && (
          <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
            Postponed
          </span>
        )}
      </div>
      <p className="text-xs text-slate-500 mt-1">
        {formatDateTimeZA(shoot.date, shoot.game_time || shoot.start_time)}
      </p>
      <div className="mt-auto pt-3 space-y-1.5">
        <p className="flex items-center gap-1.5 text-xs text-slate-300 min-w-0">
          <Camera className="h-3.5 w-3.5 text-orange-400 shrink-0" />
          <span className="truncate">{operators.length ? operators.join(', ') : 'Unassigned'}</span>
        </p>
        <p className="flex items-center gap-1.5 text-xs text-slate-300 min-w-0">
          <Shield className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="truncate">{standbyName || 'No standby'}</span>
        </p>
      </div>
    </div>
  );
}

export default function ViewerSchedule() {
  const { user } = useApp();
  const { timeZone } = useTimezone();
  const queryClient = useQueryClient();
  const todayStr = formatYmdInTz(new Date(), timeZone);
  const firstName = user?.full_name?.split(' ')[0] || 'Viewer';
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(() => {
    try {
      return parsePageSize(localStorage.getItem(LOCAL_KEY));
    } catch {
      return 4;
    }
  });
  const [savingSize, setSavingSize] = useState(false);

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
  const { data: appSettings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (savingSize) return;
    const saved = appSettings.find((item) => item.key === PAGE_SIZE_KEY)?.value;
    if (saved == null) return;
    const next = parsePageSize(saved);
    setPageSize((current) => (current === next ? current : next));
    try {
      localStorage.setItem(LOCAL_KEY, String(next));
    } catch {
      /* ignore */
    }
  }, [appSettings, savingSize]);

  const upcoming = useMemo(() => (
    (shoots || [])
      .filter((shoot) => {
        if (!shoot?.date) return false;
        const displayDate = displayYmdForSource(shoot.date, shoot.game_time || shoot.start_time || '23:59', timeZone);
        if (displayDate < todayStr) return false;
        const status = normalizeShootStatus(shoot.status);
        return status !== 'cancelled' && status !== 'completed';
      })
      .sort((a, b) => {
        const date = String(a.date).localeCompare(String(b.date));
        if (date !== 0) return date;
        return String(a.game_time || a.start_time || '').localeCompare(String(b.game_time || b.start_time || ''));
      })
  ), [shoots, todayStr, timeZone]);

  const totalPages = Math.max(1, Math.ceil(upcoming.length / pageSize));
  const safePage = Math.min(page, totalPages - 1);
  const visible = upcoming.slice(safePage * pageSize, safePage * pageSize + pageSize);

  const persistPageSize = async (next) => {
    const size = parsePageSize(next);
    setPageSize(size);
    setPage(0);
    try {
      localStorage.setItem(LOCAL_KEY, String(size));
    } catch {
      /* ignore */
    }
    setSavingSize(true);
    try {
      const existing = appSettings.find((item) => item.key === PAGE_SIZE_KEY);
      if (existing) {
        await base44.entities.AppSettings.update(existing.id, { value: String(size) });
      } else {
        await base44.entities.AppSettings.create({
          key: PAGE_SIZE_KEY,
          value: String(size),
          description: 'Viewer dashboard tiles per page',
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['appSettings'] });
    } catch {
      /* local default still applies */
    } finally {
      setSavingSize(false);
    }
  };

  return (
    <div className="rom-page">
      <div className="rom-page-inner">
        <header className="mb-8">
          <p className="rom-kicker mb-2">Dashboard</p>
          <h1 className="rom-title">Welcome, {firstName}</h1>
          <p className="rom-subtitle">Upcoming games, who is capturing, and who is on standby.</p>
        </header>

        <section className="mb-8 rom-enter-delay">
          <DashboardBanner
            user={user}
            shoots={shoots}
            standbyDays={standbyDays}
            allUsers={users}
            showNextShoot={false}
          />
        </section>

        <DashboardSection
          title="Upcoming games"
          icon={CalendarDays}
          extra={(
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 hidden sm:inline">Tiles per page</span>
              <div className="flex rounded-lg bg-slate-800 p-0.5">
                {[4, 6].map((size) => (
                  <button
                    key={size}
                    type="button"
                    disabled={savingSize}
                    onClick={() => persistPageSize(size)}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                      pageSize === size
                        ? 'bg-orange-500 text-white'
                        : 'text-slate-400 hover:text-slate-100'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          )}
        >
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No upcoming games.</p>
          ) : (
            <>
              <div className="mb-3 flex items-center justify-end">
                <div className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-500">
                  Showing max {pageSize}
                </div>
              </div>
              <div className={pageSize === 6
                ? 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3'
                : 'grid grid-cols-1 xl:grid-cols-2 gap-3'}
              >
                {visible.map((shoot) => (
                  <ViewerGameTile
                    key={shoot.id}
                    shoot={shoot}
                    users={users}
                    standbyDays={standbyDays}
                  />
                ))}
              </div>
              {upcoming.length > pageSize && (
                <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={safePage === 0}
                    className="rounded-md border border-slate-800 px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-30"
                  >
                    Previous
                  </button>
                  <span className="text-[10px] font-bold text-gray-600">
                    SHOWING {safePage * pageSize + 1}-{Math.min((safePage + 1) * pageSize, upcoming.length)} OF {upcoming.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={safePage >= totalPages - 1}
                    className="rounded-md border border-orange-700/60 bg-orange-950/40 px-2.5 py-1 text-xs font-semibold text-orange-400 hover:bg-orange-950/50 disabled:opacity-30"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </DashboardSection>
      </div>
    </div>
  );
}
