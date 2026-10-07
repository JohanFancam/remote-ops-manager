import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckSquare } from 'lucide-react';
import { format } from 'date-fns';
import { getDisplayName } from '@/components/utils/nameUtils';
import RigCheckAssignPanel from '@/components/rigs/RigCheckAssignPanel';
import RigCheckTile from '@/components/rigs/RigCheckTile';
import { mergeChecklistFromRig } from '@/utils/rigChecks';
import { matchRig } from '@/components/utils/rigUtils';

function assignmentDay(row) {
  return String(row.due_date || row.shoot_date || row.created_date || '').slice(0, 10);
}

function formatAssignmentDay(dayStr) {
  if (!dayStr) return 'No date';
  const parsed = new Date(`${dayStr}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return dayStr;
  return format(parsed, 'EEEE, d MMMM yyyy');
}

export default function RigChecks() {
  const { user, isAdmin, isAnalytics } = useApp();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [expandedId, setExpandedId] = useState('');

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

  const active = assignments.filter((row) => row.status !== 'cancelled');
  const completed = active.filter((row) => row.status === 'completed');
  const pending = active.filter((row) => row.status !== 'completed');

  const assignmentsByDay = useMemo(() => {
    const map = new Map();
    active.forEach((row) => {
      const day = assignmentDay(row);
      if (!map.has(day)) map.set(day, []);
      map.get(day).push(row);
    });
    return [...map.entries()]
      .sort((a, b) => String(b[0]).localeCompare(String(a[0])))
      .map(([day, rows]) => {
        const sorted = [...rows].sort((a, b) => {
          const aDone = a.status === 'completed' ? 1 : 0;
          const bDone = b.status === 'completed' ? 1 : 0;
          if (aDone !== bDone) return aDone - bDone;
          return String(a.team || a.shoot_title || '').localeCompare(String(b.team || b.shoot_title || ''));
        });
        return {
          day,
          rows: sorted,
          openCount: sorted.filter((row) => row.status !== 'completed').length,
          doneCount: sorted.filter((row) => row.status === 'completed').length,
        };
      });
  }, [active]);

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
          <p className="rom-subtitle">Assign a shoot’s rig test, then track what was checked and any notes.</p>
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

        <section className="rom-panel p-4">
          <h2 className="text-sm font-semibold text-slate-100 mb-3">Assignments</h2>
          <p className="text-xs text-slate-500 mb-3">Grouped by the day each check was assigned. Open checks sit first on that day — expand one for the items and notes.</p>
          {active.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing assigned yet.</p>
          ) : (
            <div className="space-y-6">
              {assignmentsByDay.map(({ day, rows, openCount, doneCount }) => (
                <div key={day || 'unscheduled'}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-slate-100">{formatAssignmentDay(day)}</p>
                    <p className="text-[11px] text-slate-500">
                      {openCount > 0 && <span className="text-orange-300">{openCount} open</span>}
                      {openCount > 0 && doneCount > 0 && <span className="text-slate-600"> · </span>}
                      {doneCount > 0 && <span className="text-emerald-400">{doneCount} done</span>}
                    </p>
                  </div>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {rows.map((row) => (
                      <RigCheckTile
                        key={row.id}
                        row={mergeChecklistFromRig(
                          row,
                          rigSettings.find((rig) => rig.id === row.rig_setting_id)
                            || matchRig({ title: row.shoot_title, client: row.team }, rigSettings)
                        )}
                        assigneeName={getDisplayName(users.find((u) => u.email === row.assignee_email), row.assignee_email)}
                        todayStr={todayStr}
                        expanded={expandedId === row.id}
                        onToggleExpand={() => setExpandedId((id) => (id === row.id ? '' : row.id))}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
