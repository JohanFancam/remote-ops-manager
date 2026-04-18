import React, { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent } from "@/components/ui/card";
import { Camera } from 'lucide-react';
import AdminDayShootView from '../components/dashboard/AdminDayShootView';
import RemoteEarnings from '../components/dashboard/RemoteEarnings';
import ShootChangeNotifier from '../components/dashboard/ShootChangeNotifier';
import AdminMonthlySummary from '../components/dashboard/AdminMonthlySummary';
import StandbyManager from '../components/dashboard/StandbyManager';
import DashboardBanner from '../components/dashboard/DashboardBanner';
import AdminStandbyShootList from '../components/dashboard/AdminStandbyShootList';
import { OperatorAvailabilityPanel } from '../components/dashboard/OperatorAvailabilityPanel';
import { isShootWithinStandbyWindow, isShootCancelled, isShootComplete, getPrimaryDateTime, isShootCurrent } from '../components/utils/scheduleUtils';

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

  const now = new Date();

  const handleShootUpdate = async (id, data) => {
    await base44.entities.Shoot.update(id, data);
    queryClient.invalidateQueries({ queryKey: ['shoots'] });
  };

  const visibleShoots = useMemo(() => {
    return shoots
      .filter((s) => !isShootCancelled(s))
      .sort((a, b) => getPrimaryDateTime(a) - getPrimaryDateTime(b));
  }, [shoots]);

  const allAssignedShoots = useMemo(() => {
    return visibleShoots.filter((s) => s.assigned_operators?.includes(user?.email));
  }, [visibleShoots, user?.email]);

  // For the history/day-month navigator:
  // keep all assigned shoots, including past/completed.
  const selfAssignedShoots = isAdmin ? allAssignedShoots : [];
  const remoteShoots = !isAdmin ? allAssignedShoots : [];

  const currentOrNextAssignedShoots = useMemo(() => {
    return allAssignedShoots.filter((s) => {
      if (isShootCancelled(s) || isShootComplete(s)) return false;
      const primaryDate = getPrimaryDateTime(s);
      return isShootCurrent(s, now) || (primaryDate && primaryDate >= now);
    });
  }, [allAssignedShoots, now]);

  // Helper: convert standby record to start/end datetimes.
  const standbyWindows = useMemo(() => {
    return standbyDays
      .filter((sd) => sd.admin_email === user?.email)
      .map((sd) => {
        const startDate = sd.start_date || sd.date;
        const endDate = sd.end_date || startDate;
        if (!startDate) return null;

        const startDt = new Date(`${startDate}T${sd.start_time || '00:00'}`);
        const endDt = new Date(`${endDate}T${sd.end_time || '23:59:59'}`);

        return {
          ...sd,
          startDate,
          endDate,
          startDt,
          endDt,
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.startDt - b.startDt);
  }, [standbyDays, user?.email]);

  const currentStandbyWindow = useMemo(() => {
    return standbyWindows.find((w) => w.startDt <= now && w.endDt >= now) || null;
  }, [standbyWindows, now]);

  const nextStandbyWindow = useMemo(() => {
    return standbyWindows.find((w) => w.startDt > now) || null;
  }, [standbyWindows, now]);


  // Show only the shoots the admin is covering during the exact standby window.
  const currentStandbyShoots = useMemo(() => {
    if (!isAdmin || !currentStandbyWindow) return [];

    return visibleShoots.filter((s) => {
      if (s.assigned_operators?.includes(user?.email)) return false;
      return isShootWithinStandbyWindow(s, currentStandbyWindow);
    });
  }, [isAdmin, currentStandbyWindow, visibleShoots, user?.email]);

  // If not currently on standby, show the shoots for the NEXT standby period.
  const upcomingStandbyShoots = useMemo(() => {
    if (!isAdmin || currentStandbyWindow || !nextStandbyWindow) return [];

    return visibleShoots.filter((s) => {
      if (s.assigned_operators?.includes(user?.email)) return false;
      return isShootWithinStandbyWindow(s, nextStandbyWindow);
    });
  }, [isAdmin, currentStandbyWindow, nextStandbyWindow, visibleShoots, user?.email]);

  const hasAnyCurrentOrNextCoverage =
    currentOrNextAssignedShoots.length > 0 ||
    currentStandbyShoots.length > 0 ||
    upcomingStandbyShoots.length > 0;

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
        />

        {isAdmin && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
            <StandbyManager user={user} allUsers={allUsers} />
          </div>
        )}

        {isAdmin && (
          <div className="mb-6">
            <h2 className="text-base font-semibold text-white mb-3">
              My Assigned Shoots — Current / Next
            </h2>
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

        {isAdmin && currentStandbyWindow && (
          <div className="mb-6">
            <h2 className="text-base font-semibold text-white mb-3">
              Standby Coverage — Current Standby Shoots
            </h2>
            <AdminStandbyShootList
              shoots={currentStandbyShoots}
              allUsers={allUsers}
              userEmail={user?.email}
              rigSettings={rigSettings}
              standbyDays={[currentStandbyWindow]}
              onUpdate={handleShootUpdate}
              isAdmin={isAdmin}
            />
          </div>
        )}

        {isAdmin && !currentStandbyWindow && nextStandbyWindow && (
          <div className="mb-6">
            <h2 className="text-base font-semibold text-white mb-3">
              Upcoming Standby Shoots
            </h2>
            <AdminStandbyShootList
              shoots={upcomingStandbyShoots}
              allUsers={allUsers}
              userEmail={user?.email}
              rigSettings={rigSettings}
              standbyDays={[nextStandbyWindow]}
              onUpdate={handleShootUpdate}
              isAdmin={isAdmin}
            />
          </div>
        )}

        {isAdmin && !hasAnyCurrentOrNextCoverage && (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-10 text-center">
              <Camera className="h-10 w-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500">
                No current or upcoming assigned shoots or standby coverage.
              </p>
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