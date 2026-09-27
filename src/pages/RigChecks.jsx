import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CheckSquare, StickyNote } from 'lucide-react';
import { format } from 'date-fns';
import { getDisplayName } from '@/components/utils/nameUtils';
import { assignmentProgress, isRigCheckOverdue } from '@/utils/rigChecks';
import { shortenTitle } from '@/components/utils/scheduleUtils';
import RigCheckAssignPanel from '@/components/rigs/RigCheckAssignPanel';

export default function RigChecks() {
  const { user, isAdmin, isAnalytics } = useApp();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const { data: assignments = [] } = useQuery({
    queryKey: ['rigCheckAssignments'],
    queryFn: () => base44.entities.RigCheckAssignment.list('-created_date', 400),
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
    enabled: isAdmin,
  });

  const active = assignments.filter((row) => row.status !== 'cancelled');
  const completed = active.filter((row) => row.status === 'completed');
  const pending = active.filter((row) => row.status !== 'completed');

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

        <section className="rom-panel p-4 mb-8">
          <h2 className="text-sm font-semibold text-slate-100 mb-3">All assignments</h2>
          <div className="space-y-2">
            {active.length === 0 && <p className="text-sm text-slate-500">Nothing assigned yet.</p>}
            {active.slice(0, 40).map((row) => {
              const progress = assignmentProgress(row);
              const name = getDisplayName(users.find((u) => u.email === row.assignee_email), row.assignee_email);
              const overdue = isRigCheckOverdue(row, todayStr);
              return (
                <div key={row.id} className={`rounded-lg border bg-slate-900/60 px-3 py-2 ${overdue ? 'border-red-700/70' : 'border-slate-800'}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm text-slate-100">
                      {row.team || 'Rig'}
                      <span className="text-slate-500"> · {name}</span>
                    </p>
                    <span className={`text-xs ${row.status === 'completed' ? 'text-emerald-400' : overdue ? 'text-red-400' : 'text-orange-300'}`}>
                      {row.status === 'completed' ? 'Checked' : overdue ? 'Overdue' : `${progress.done}/${progress.total || 0} open`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {row.shoot_title ? shortenTitle(row.shoot_title) : 'Rig test'}
                    {row.shoot_date ? ` · ${row.shoot_date}` : ''}
                    {row.due_date ? ` · due ${row.due_date}` : ''}
                    {row.completed_at ? ` · done ${format(new Date(row.completed_at), 'd MMM HH:mm')}` : ''}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rom-panel p-4">
          <div className="flex items-center gap-2 mb-3">
            <StickyNote className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-slate-100">Notes</h2>
          </div>
          {notes.length === 0 ? (
            <p className="text-sm text-slate-500">No notes on assigned checks yet.</p>
          ) : (
            <div className="space-y-2">
              {notes.map((row) => (
                <div key={row.id} className="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2">
                  <p className="text-xs text-slate-500 mb-1">
                    {row.team}
                    {row.shoot_title ? ` · ${shortenTitle(row.shoot_title)}` : ''}
                    {' · '}
                    {getDisplayName(users.find((u) => u.email === row.assignee_email), row.assignee_email)}
                  </p>
                  <p className="text-sm text-slate-200 whitespace-pre-wrap">{row.notes}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
