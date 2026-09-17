import React, { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { format } from 'date-fns';
import AdminDayShootView from '../components/dashboard/AdminDayShootView';
import RemotePendingShoots from '../components/dashboard/RemotePendingShoots';
import RemoteEarnings from '../components/dashboard/RemoteEarnings';
import ShootChangeNotifier from '../components/dashboard/ShootChangeNotifier';
import AdminMonthlySummary from '../components/dashboard/AdminMonthlySummary';
import DashboardBanner from '../components/dashboard/DashboardBanner';
import AdminStandbyShootList from '../components/dashboard/AdminStandbyShootList';
import StandbyUserQuota from '../components/dashboard/StandbyUserQuota';

export default function Dashboard() {
  const { user, isAdmin, isStandby, isOperator } = useApp();
  const queryClient = useQueryClient();

  const { data: shoots = [] } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list('-date', 500),
    staleTime: 60_000,
  });

  const { data: rigSettings = [] } = useQuery({
    queryKey: ['rigSettings'],
    queryFn: () => base44.entities.RigSetting.list(),
    staleTime: 5 * 60_000,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    staleTime: 5 * 60_000,
  });

  const { data: presenceRecords = [] } = useQuery({
    queryKey: ['userPresence'],
    queryFn: () => base44.entities.UserPresence.list(),
    staleTime: 2 * 60_000,
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

  const allUsers = useMemo(() => {
    const map = new Map();

    presenceRecords.forEach((p) => {
      if (p.user_email) {
        map.set(p.user_email, {
          email: p.user_email,
          full_name: p.user_name,
          role: p.user_role,
        });
      }
    });

    users.forEach((u) => {
      if (u.email) map.set(u.email, u);
    });

    return Array.from(map.values());
  }, [users, presenceRecords]);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const handleShootUpdate = async (id, data) => {
    queryClient.setQueryData(['shoots'], (old = []) =>
      old.map((s) => (s.id === id ? { ...s, ...data } : s))
    );
    try {
      await base44.entities.Shoot.update(id, data);
    } catch {
      queryClient.invalidateQueries({ queryKey: ['shoots'] });
    }
  };

  const visibleShoots = useMemo(() => {
    return shoots
      .filter((s) => s.status !== 'cancelled')
      .sort((a, b) => {
        const d = a.date.localeCompare(b.date);
        return d !== 0 ? d : (a.game_time || '').localeCompare(b.game_time || '');
      });
  }, [shoots]);

  const allAssignedShoots = useMemo(() => {
    return visibleShoots.filter((s) => s.assigned_operators?.includes(user?.email));
  }, [visibleShoots, user?.email]);

  const myStandbyDays = useMemo(() => {
    if ((!isAdmin && !isStandby) || !user?.email) return [];
    return standbyDays.filter((sd) => sd.admin_email === user.email);
  }, [standbyDays, isAdmin, isStandby, user?.email]);

  const firstName =
    user?.full_name?.split(' ')[0] || (isAdmin ? 'Admin' : isStandby ? 'Standby' : 'Operator');

  return (
    <div className="rom-page">
      <div className="rom-page-inner">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="rom-kicker mb-2">Dashboard</p>
            <h1 className="rom-title">Welcome, {firstName}</h1>
            <p className="rom-subtitle">Assigned shoots, standby coverage, and rig checks for tonight.</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="rom-live-dot" />
            <span>Desk online</span>
          </div>
        </header>

        <ShootChangeNotifier userEmail={user?.email} isAdmin={isAdmin} />

        <section className="mb-8 rom-enter-delay">
          <DashboardBanner
            user={user}
            isAdmin={isAdmin}
            shoots={shoots}
            standbyDays={standbyDays}
            allUsers={allUsers}
            todayStr={todayStr}
          />
        </section>

        {isStandby && <StandbyUserQuota user={user} shoots={shoots} />}

        <section className="mb-8 rom-enter-delay-2">
          <div className="mb-3 flex items-end justify-between gap-3">
            <h2 className="rom-section-title">My Assigned Shoots</h2>
            <p className="hidden text-xs text-slate-500 sm:block">Current or next shoot shows first.</p>
          </div>
          <div className="rom-panel">
            <AdminDayShootView
              shoots={allAssignedShoots}
              isAdmin={isAdmin || isStandby}
              rigSettings={rigSettings}
              onUpdate={handleShootUpdate}
              userEmail={user?.email}
              allUsers={allUsers}
              allShoots={shoots}
              appSettings={appSettings}
            />
          </div>
        </section>

        {(isAdmin || isStandby) && (
          <section className="mb-8">
            <div className="mb-3 flex items-end justify-between gap-3">
              <h2 className="rom-section-title">Standby Coverage Shoots</h2>
              <p className="hidden text-xs text-slate-500 sm:block">18:00 – 06:00 standby windows.</p>
            </div>
            <div className="rom-panel">
              <AdminStandbyShootList
                shoots={visibleShoots}
                allUsers={allUsers}
                userEmail={user?.email}
                rigSettings={rigSettings}
                standbyDays={myStandbyDays}
                onUpdate={handleShootUpdate}
                isAdmin={isAdmin}
              />
            </div>
          </section>
        )}

        {isAdmin && <AdminMonthlySummary shoots={shoots} user={user} appSettings={appSettings} />}

        {isOperator && (
          <section className="mb-8">
            <div className="mb-3">
              <h2 className="rom-section-title">Pending Approval</h2>
              <p className="text-xs text-slate-500 mt-0.5">Requests waiting for admin approval.</p>
            </div>
            <div className="rom-panel">
              <RemotePendingShoots shoots={shoots} user={user} onUpdate={handleShootUpdate} />
            </div>
          </section>
        )}

        {isOperator && (
          <div className="mt-6">
            <RemoteEarnings user={user} />
          </div>
        )}
      </div>
    </div>
  );
}