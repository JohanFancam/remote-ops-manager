import React, { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent } from "@/components/ui/card";
import { Camera } from 'lucide-react';
import { format } from 'date-fns';
import CountdownCard from '../components/dashboard/CountdownCard';
import RemoteEarnings from '../components/dashboard/RemoteEarnings';
import ShootChangeNotifier from '../components/dashboard/ShootChangeNotifier';
import AdminMonthlySummary from '../components/dashboard/AdminMonthlySummary';
import StandbyManager from '../components/dashboard/StandbyManager';
import DashboardBanner from '../components/dashboard/DashboardBanner';
import AdminStandbyShootList from '../components/dashboard/AdminStandbyShootList';
import RemoteShootCard from '../components/dashboard/RemoteShootCard';
import { OperatorAvailabilityPanel } from '../components/dashboard/OperatorAvailabilityPanel';

export default function Dashboard() {
  const { user, isAdmin, isLevel1Admin } = useApp();
  const queryClient = useQueryClient();

  const { data: shoots = [] } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list('-date', 500),
  });



  const { data: rigSettings = [] } = useQuery({
    queryKey: ['rigSettings'],
    queryFn: () => base44.entities.RigSetting.list(),
    enabled: isAdmin,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
  });

  // UserPresence is written by every user themselves — readable by all.
  // Use it to fill in names when User.list() doesn't return all users.
  const { data: presenceRecords = [] } = useQuery({
    queryKey: ['userPresence'],
    queryFn: () => base44.entities.UserPresence.list(),
  });

  const { data: standbyDays = [] } = useQuery({
    queryKey: ['standbyDays'],
    queryFn: () => base44.entities.StandbyDay.list('-date', 500),
  });

  const { data: appSettings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
    enabled: isAdmin,
  });


  // Merge User records with UserPresence so name lookups work for all admins
  const allUsers = useMemo(() => {
    const map = new Map();
    // Seed from presence (lower priority)
    presenceRecords.forEach(p => {
      if (p.user_email) map.set(p.user_email, { email: p.user_email, full_name: p.user_name, role: p.user_role });
    });
    // Override with real User records (higher priority)
    users.forEach(u => { if (u.email) map.set(u.email, u); });
    return Array.from(map.values());
  }, [users, presenceRecords]);

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  const notifyHours = 5; // read from appSettings on layout level

  const upcomingShoots = shoots
    .filter(s => {
      if (s.status === 'cancelled') return false;
      // Keep today's shoots visible until shoot_complete is marked, even if status=completed
      if (s.date === todayStr) return !s.phase_status?.shoot_complete;
      // Future shoots: hide only if explicitly completed
      return s.date > todayStr && !s.phase_status?.shoot_complete;
    })
    .sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      return d !== 0 ? d : (a.game_time || '').localeCompare(b.game_time || '');
    });

  // For admins: collect all dates covered by their active/future standby entries.
  // A multi-day standby (e.g. 6th→7th) means the admin is responsible for shoots on ALL those dates.
  const now = new Date();
  const activeStandbyDates = isAdmin ? (() => {
    const dates = new Set();
    standbyDays
      .filter(sd => sd.admin_email === user?.email)
      .forEach(sd => {
        const startDate = sd.start_date || sd.date;
        const endDate = sd.end_date || startDate;
        if (!startDate) return;

        // Build start/end datetimes
        const startDt = new Date(`${startDate}T${sd.start_time || '00:00'}`);
        const endDt = new Date(`${endDate}T${sd.end_time || '23:59:59'}`);

        // Skip entries that are fully in the past
        if (endDt < now) return;

        // Walk every date in the standby range and add it if >= today
        const cur = new Date(startDate + 'T12:00:00');
        const last = new Date(endDate + 'T12:00:00');
        while (cur <= last) {
          const ds = format(cur, 'yyyy-MM-dd');
          if (ds >= todayStr) dates.add(ds);
          cur.setDate(cur.getDate() + 1);
        }
      });
    return dates;
  })() : new Set();

  const myUpcoming = upcomingShoots.filter(s => {
    if (s.assigned_operators?.includes(user?.email)) return true;
    if (isAdmin && activeStandbyDates.has(s.date)) return true;
    return false;
  });




  // Standby shoots: shoots on dates the admin is covering (for the compact list)
  const myStandbyCount = standbyDays.filter(sd => {
    const startDate = sd.start_date || sd.date;
    return sd.admin_email === user?.email && startDate >= todayStr;
  }).length;

  const handleShootUpdate = async (id, data) => {
    await base44.entities.Shoot.update(id, data);
    queryClient.invalidateQueries({ queryKey: ['shoots'] });
  };

  // For self-assigned admin shoots, use CountdownCard; standby-only uses compact list
  const selfAssignedUpcoming = isAdmin
    ? myUpcoming.filter(s => s.assigned_operators?.includes(user?.email))
    : [];

  const standbyOnlyUpcoming = isAdmin
    ? myUpcoming.filter(s => !s.assigned_operators?.includes(user?.email))
    : [];

  const remoteUpcoming = !isAdmin
    ? myUpcoming.slice(0, 10)
    : [];

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-5">
          <h1 className="text-2xl font-bold text-white">
            {`Welcome, ${user?.full_name?.split(' ')[0] || (isAdmin ? 'Admin' : 'Operator')}`}
          </h1>
        </div>

        <ShootChangeNotifier userEmail={user?.email} isAdmin={isAdmin} />

        {/* Unified banner: clock + standby + stats */}
        <DashboardBanner
          user={user}
          isAdmin={isAdmin}
          shoots={shoots}
          standbyDays={standbyDays}
          allUsers={allUsers}
          todayStr={todayStr}
        />

        {/* ADMIN: Standby calendar always open */}
        {isAdmin && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 mb-6">
            <StandbyManager user={user} allUsers={allUsers} />
          </div>
        )}

        {/* ADMIN: Self-assigned shoots — compact expandable list */}
        {isAdmin && selfAssignedUpcoming.length > 0 && (
          <div className="mb-6">
            <h2 className="text-base font-semibold text-white mb-3">My Assigned Shoots — Live Countdown</h2>
            <div className="space-y-2">
              {selfAssignedUpcoming.map(shoot => (
                <CountdownCard
                  key={shoot.id}
                  shoot={shoot}
                  isAdmin={isAdmin}
                  rigSettings={rigSettings}
                  onUpdate={handleShootUpdate}
                  userEmail={user?.email}
                  allUsers={allUsers}
                />
              ))}
            </div>
          </div>
        )}

        {/* ADMIN: Standby coverage shoots — compact list */}
        {isAdmin && (
          <div className="mb-6">
            <h2 className="text-base font-semibold text-white mb-3">Standby Coverage — Upcoming Shoots</h2>
            <AdminStandbyShootList
              shoots={standbyOnlyUpcoming}
              allUsers={allUsers}
              userEmail={user?.email}
              rigSettings={rigSettings}
              standbyDays={standbyDays.filter(sd => sd.admin_email === user?.email)}
            />
          </div>
        )}

        {/* ADMIN: empty state */}
        {isAdmin && myUpcoming.length === 0 && (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-10 text-center">
              <Camera className="h-10 w-10 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500">No upcoming shoots on your schedule or standby shifts.</p>
            </CardContent>
          </Card>
        )}

        {/* REMOTE: collapsible shoot banners */}
        {!isAdmin && (
          <div>
            <h2 className="text-base font-semibold text-white mb-3">My Upcoming Shoots</h2>
            {remoteUpcoming.length === 0 ? (
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-10 text-center">
                  <Camera className="h-10 w-10 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500">No upcoming shoots assigned to you.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {remoteUpcoming.map(shoot => (
                  <RemoteShootCard
                    key={shoot.id}
                    shoot={shoot}
                    rigSettings={rigSettings}
                    onUpdate={handleShootUpdate}
                    userEmail={user?.email}
                    allUsers={allUsers}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="mt-8" />
        {isAdmin && <AdminMonthlySummary shoots={shoots} user={user} appSettings={appSettings} />}
        {!isAdmin && <OperatorAvailabilityPanel user={user} />}
        {!isAdmin && <div className="mt-6"><RemoteEarnings user={user} /></div>}
      </div>
    </div>
  );
}