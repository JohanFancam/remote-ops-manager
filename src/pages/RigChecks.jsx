import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import RigCheckAssignPanel from '@/components/rigs/RigCheckAssignPanel';
import RigCheckDayPanel, { RigCheckDayListItem, formatRigCheckDay } from '@/components/rigs/RigCheckDayPanel';
import { mergeChecklistFromRig, groupRigChecksByDay, RIG_CHECK_DAYS_PER_PAGE } from '@/utils/rigChecks';
import { matchRig } from '@/components/utils/rigUtils';
import { getDisplayName } from '@/components/utils/nameUtils';

export default function RigChecks() {
  const { user, isAdmin, isAnalytics } = useApp();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [expandedId, setExpandedId] = useState('');
  const [selectedDay, setSelectedDay] = useState(null);
  const [dayPage, setDayPage] = useState(0);

  const { data: assignments = [] } = useQuery({
    queryKey: ['rigCheckAssignments'],
    queryFn: () => base44.entities.RigCheckAssignment.list('-created_date', 400),
    refetchOnMount: 'always',
    staleTime: 0,
  });
  const { data: users = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
  });
  const { data: shoots = [] } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list('-date', 500),
    enabled: isAdmin,
  });
  const { data: rigSettings = [] } = useQuery({
    queryKey: ['rigSettings'],
    queryFn: () => base44.entities.RigSetting.list(),
    enabled: isAdmin || isAnalytics,
  });

  const hydrate = (row) => mergeChecklistFromRig(
    row,
    rigSettings.find((rig) => rig.id === row.rig_setting_id)
      || matchRig({ title: row.shoot_title, client: row.team }, rigSettings)
  );

  const active = assignments.filter((row) => row.status !== 'cancelled').map(hydrate);
  const completed = active.filter((row) => row.status === 'completed');
  const pending = active.filter((row) => row.status !== 'completed');

  const assignmentsByDay = useMemo(
    () => groupRigChecksByDay(active, todayStr),
    [active, todayStr]
  );

  const totalDayPages = Math.max(1, Math.ceil(assignmentsByDay.length / RIG_CHECK_DAYS_PER_PAGE));
  const safePage = Math.min(dayPage, totalDayPages - 1);
  const visibleDays = assignmentsByDay.slice(
    safePage * RIG_CHECK_DAYS_PER_PAGE,
    safePage * RIG_CHECK_DAYS_PER_PAGE + RIG_CHECK_DAYS_PER_PAGE
  );

  const selectedGroup = assignmentsByDay.find((group) => group.day === selectedDay);

  const chartData = useMemo(() => {
    const map = new Map();
    active.forEach((row) => {
      const team = row.team || 'Unknown';
      if (!map.has(team)) map.set(team, { team, completed: 0, pending: 0 });
      if (row.status === 'completed') map.get(team).completed += 1;
      else map.get(team).pending += 1;
    });
    return [...map.values()].sort((a, b) => (b.completed + b.pending) - (a.completed + a.pending)).slice(0, 12);
  }, [active]);

  const notes = active
    .filter((row) => String(row.notes || '').trim())
    .slice(0, 20);

  if (!isAdmin && !isAnalytics) {
    return (
      <div className="rom-page">
        <div className="rom-page-inner">
          <p className="text-slate-400">This dashboard is for admins and data users.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rom-page">
      <div className="rom-page-inner">
        <header className="mb-8">
          <p className="rom-kicker mb-2">Rig Checks</p>
          <h1 className="rom-title">Checked rigs</h1>
          <p className="rom-subtitle">Grouped by day, four days at a time. Open a day for the checklist and notes.</p>
        </header>

        {isAdmin && (
          <RigCheckAssignPanel
            rigSettings={rigSettings}
            users={users}
            shoots={shoots}
            currentEmail={user?.email}
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
          <div className="rom-panel p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Completed</p>
            <p className="text-2xl font-semibold text-emerald-300 mt-1">{completed.length}</p>
          </div>
          <div className="rom-panel p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Open</p>
            <p className="text-2xl font-semibold text-orange-300 mt-1">{pending.length}</p>
          </div>
          <div className="rom-panel p-4">
            <p className="text-xs text-slate-500 uppercase tracking-wide">With notes</p>
            <p className="text-2xl font-semibold text-slate-100 mt-1">{notes.length}</p>
          </div>
        </div>

        <section className="rom-panel p-4 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <CheckSquare className="h-4 w-4 text-orange-400" />
            <h2 className="text-sm font-semibold text-slate-100">Checks by team</h2>
          </div>
          {chartData.length === 0 ? (
            <p className="text-sm text-slate-500 py-10 text-center">No assigned rig checks yet.</p>
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="team" tick={{ fill: '#94a3b8', fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                  <YAxis allowDecimals={false} tick={{ fill: '#94a3b8', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, color: '#e2e8f0' }}
                  />
                  <Bar dataKey="completed" name="Checked" fill="#34d399" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="pending" name="Open" fill="#fb923c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section>
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-sm font-semibold text-slate-400">Checks by day</p>
            {assignmentsByDay.length > RIG_CHECK_DAYS_PER_PAGE && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setDayPage((p) => Math.max(0, p - 1)); setSelectedDay(null); }}
                  disabled={safePage === 0}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-800 text-slate-400 hover:bg-slate-800 disabled:opacity-30"
                  aria-label="Previous days"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-[11px] text-slate-500 tabular-nums">
                  {safePage + 1} / {totalDayPages}
                </span>
                <button
                  type="button"
                  onClick={() => { setDayPage((p) => Math.min(totalDayPages - 1, p + 1)); setSelectedDay(null); }}
                  disabled={safePage >= totalDayPages - 1}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-orange-700/60 bg-orange-950/40 text-orange-400 hover:bg-orange-950/50 disabled:opacity-30"
                  aria-label="Next days"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
          {active.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing assigned yet.</p>
          ) : (
            <div className="space-y-5">
              {visibleDays.map(({ day, rows, openCount, doneCount }) => (
                <div key={day || 'unscheduled'}>
                  <button
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className="w-full flex items-baseline justify-between gap-2 mb-2 text-left rounded-lg px-1 py-0.5 hover:bg-slate-800/60"
                  >
                    <p className="text-sm font-semibold text-slate-100">{formatRigCheckDay(day)}</p>
                    <p className="text-[11px] text-slate-500">
                      {openCount > 0 && <span className="text-orange-300">{openCount} open</span>}
                      {openCount > 0 && doneCount > 0 && <span className="text-slate-600"> · </span>}
                      {doneCount > 0 && <span className="text-emerald-400">{doneCount} done</span>}
                    </p>
                  </button>
                  <div className="space-y-2">
                    {rows.map((row) => (
                      <RigCheckDayListItem
                        key={row.id}
                        row={row}
                        assigneeName={getDisplayName(users.find((u) => u.email === row.assignee_email), row.assignee_email)}
                        onClick={() => setSelectedDay(day)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {selectedGroup && (
        <RigCheckDayPanel
          day={selectedGroup.day}
          rows={selectedGroup.rows}
          users={users}
          todayStr={todayStr}
          onClose={() => setSelectedDay(null)}
          expandedId={expandedId}
          onToggleExpand={(id) => setExpandedId((current) => (current === id ? '' : id))}
        />
      )}
    </div>
  );
}
