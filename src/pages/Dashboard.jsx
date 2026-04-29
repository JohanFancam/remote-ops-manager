import React, { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { format } from 'date-fns';
import AdminDayShootView from '../components/dashboard/AdminDayShootView';
import RemoteEarnings from '../components/dashboard/RemoteEarnings';
import ShootChangeNotifier from '../components/dashboard/ShootChangeNotifier';
import AdminMonthlySummary from '../components/dashboard/AdminMonthlySummary';
import DashboardBanner from '../components/dashboard/DashboardBanner';
import AdminStandbyShootList from '../components/dashboard/AdminStandbyShootList';

export default function Dashboard() {
  const { user, isAdmin } = useApp();
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
    enabled: isAdmin,
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
    await base44.entities.Shoot.update(id, data);
    await queryClient.invalidateQueries({ queryKey: ['shoots'] });
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

  const selfAssignedShoots = isAdmin ? allAssignedShoots : [];
  const remoteShoots = !isAdmin ? allAssignedShoots : [];

  const myStandbyDays = useMemo(() => {
    if (!isAdmin || !user?.email) return [];
    return standbyDays.filter((sd) => sd.admin_email === user.email);
  }, [standbyDays, isAdmin, user?.email]);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-white">
            {`Welcome, ${user?.full_name?.split(' ')[0] || (isAdmin ? 'Admin' : 'Operator')}`}
          </h1>
        </div>

        <ShootChangeNotifier userEmail={user?.email} isAdmin={isAdmin} />

        <section className="mb-6">
          <DashboardBanner
            user={user}
            isAdmin={isAdmin}
            shoots={shoots}
            standbyDays={standbyDays}
            allUsers={allUsers}
            todayStr={todayStr}
          />
        </section>

        <section className="mb-8">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-white">My Assigned Shoots</h2>
            </div>
            <p className="hidden text-xs text-gray-500 sm:block">Current or next shoot shows first. Previous/Next lets you browse your history.</p>
          </div>
          <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-3 md:p-4">
            <AdminDayShootView
              shoots={isAdmin ? selfAssignedShoots : remoteShoots}
              isAdmin={isAdmin}
              rigSettings={rigSettings}
              onUpdate={handleShootUpdate}
              userEmail={user?.email}
              allUsers={allUsers}
            />
          </div>
        </section>

        {isAdmin && (
          <section className="mb-8">
            <div className="mb-3 flex items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-white">Standby Coverage Shoots</h2>
              </div>
              <p className="hidden text-xs text-gray-500 sm:block">Uses your 18:00 - 06:00 standby windows from the main calendar.</p>
            </div>
            <div className="rounded-2xl border border-gray-800 bg-gray-900/70 p-3 md:p-4">
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

        <div className="mt-8" />

        {isAdmin && <AdminMonthlySummary shoots={shoots} user={user} appSettings={appSettings} />}

        {!isAdmin && (
          <div className="mt-6">
            <RemoteEarnings user={user} />
          </div>
        )}
      </div>
    </div>
  );
}
