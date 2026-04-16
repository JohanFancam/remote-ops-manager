import React, { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent } from "@/components/ui/card";
import { Camera } from 'lucide-react';
import { format } from 'date-fns';
import AdminDayShootView from '../components/dashboard/AdminDayShootView';
import RemoteEarnings from '../components/dashboard/RemoteEarnings';
import ShootChangeNotifier from '../components/dashboard/ShootChangeNotifier';
import AdminMonthlySummary from '../components/dashboard/AdminMonthlySummary';
import StandbyManager from '../components/dashboard/StandbyManager';
import DashboardBanner from '../components/dashboard/DashboardBanner';
import AdminStandbyShootList from '../components/dashboard/AdminStandbyShootList';
import { OperatorAvailabilityPanel } from '../components/dashboard/OperatorAvailabilityPanel';

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

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  const handleShootUpdate = async (id, data) => {
    await base44.entities.Shoot.update(id, data);
    queryClient.invalidateQueries({ queryKey: ['shoots'] });
  };

  const visibleShoots = shoots
    .filter((s) => s.status !== 'cancelled')
    .sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      return d !== 0 ? d : (a.game_time || '').localeCompare(b.game_time || '');
    });

  const allAssignedShoots = visibleShoots.filter(
    (s) => s.assigned_operators?.includes(user?.email)
  );

  const selfAssignedShoots = isAdmin ? allAssignedShoots : [];
  const remoteShoots = !isAdmin ? allAssignedShoots : [];

  const activeStandbyDates = isAdmin
    ? (() => {
        const dates = new Set();
        const now = new Date();

        standbyDays
          .filter((sd) => sd.admin_email === user?.email)
          .forEach((sd) => {
            const startDate = sd.start_date || sd.date;
            const endDate = sd.end_date || startDate;
            if (!startDate) return;

            const startDt = new Date(`${startDate}T${sd.start_time || '00:00'}`);
            const endDt = new Date(`${endDate}T${sd.end_time || '23:59:59'}`);

            if (endDt < now) return;

            const cur = new Date(`${startDate}T12:00:00`);
            const last = new Date(`${endDate}T12:00:00`);

            while (cur <= last) {
              dates.add(format(cur, 'yyyy-MM-dd'));
              cur.setDate(cur.getDate() + 1);
            }
          });

        return dates;
      })()
    : new Set();

  const myUpcoming = visibleShoots.filter((s) => {
    if (s.assigned_operators?.includes(user?.email)) return true;
    if (isAdmin && activeStandbyDates.has(s.date)) return true;
    return false;
  });

  const allStandbyCoveredShoots = isAdmin
    ? visibleShoots.filter((s) => {
        if (s.assigned_operators?.includes(user?.email)) return false;

        return standbyDays.some((sd) => {
          const start = sd.start_date || sd.date;
          const end = sd.end_date || start;
          return s.date >= start && s.date <= end;
        });
      })
    : [];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-white">
            {`Welcome, ${user?.full_name?.split(' ')[0] || (isAdmin ? 'Admin' : 'Operator')}`}
          </h1>
        </div>

        <ShootChangeNotifier userEmail={user?.email} isAdmin={isAdmin} />

        <DashboardBanner
          user={user}
          isAdmin={isAdmin}
          shoots={shoots}
          standbyDays={standbyDays}
          allUsers={allUsers}
          todayStr={todayStr}
        />

        {isAdmin && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
            <StandbyManager user={user} allUsers={allUsers} />
          </div>
        )}

        {isAdmin && (
          <div className="mb-6">
            <h2 className="text-base font-semibold text-white mb-3">My Assigned Shoots — Live Countdown</h2>
            <AdminDayShootView
              shoots={selfAssignedShoots}
              isAdmin={isAdmin}
              rigSettings={rigSettings}
              onUpdate={handleShootUpdate}
              userEmail={user?.email}
              allUsers={allUsers}
            />
          </div>
        )}

        {isAdmin && (
          <div className="mb-6">
            <h2 className="text-base font-semibold text-white mb-3">Standby Coverage — All Covered Shoots</h2>
            <AdminStandbyShootList
              shoots={allStandbyCoveredShoots}
              allUsers={allUsers}
              userEmail={user?.email}
              rigSettings={rigSettings}
              standbyDays={standbyDays}
              onUpdate={handleShootUpdate}
              isAdmin={isAdmin}
            />
          </div>
        )}

        {isAdmin && myUpcoming.length === 0 && (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-10 text-center">
              <Camera className="h-10 w-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500">No shoots on your assigned schedule or standby coverage.</p>
            </CardContent>
          </Card>
        )}

        {!isAdmin && (
          <div>
            <h2 className="text-base font-semibold text-white mb-3">My Shoots</h2>
            <AdminDayShootView
              shoots={remoteShoots}
              isAdmin={false}
              rigSettings={rigSettings}
              onUpdate={handleShootUpdate}
              userEmail={user?.email}
              allUsers={allUsers}
            />
          </div>
        )}

        <div className="mt-8" />

        {isAdmin && (
          <AdminMonthlySummary shoots={shoots} user={user} appSettings={appSettings} />
        )}

        {!isAdmin && <OperatorAvailabilityPanel user={user} />}

        {!isAdmin && (
          <div className="mt-6">
            <RemoteEarnings user={user} />
          </div>
        )}
      </div>
    </div>
  );
}