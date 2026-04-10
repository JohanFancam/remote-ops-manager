import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent } from "@/components/ui/card";
import { Camera, CalendarDays, Wrench, Phone, Users, CheckSquare, Clock, CalendarRange } from 'lucide-react';
import { format } from 'date-fns';
import CountdownCard from '../components/dashboard/CountdownCard';
import RemoteEarnings from '../components/dashboard/RemoteEarnings';
import ShootChangeNotifier from '../components/dashboard/ShootChangeNotifier';
import AdminMonthlySummary from '../components/dashboard/AdminMonthlySummary';
import RigsCheckPanel from '../components/dashboard/RigsCheckPanel';

import StandbyManager from '../components/dashboard/StandbyManager';
import StandbyBanner from '../components/dashboard/StandbyBanner';
import ShootTimingPanel from '../components/dashboard/ShootTimingPanel';
import WeeklyTeamPanel from '../components/dashboard/WeeklyTeamPanel';
import { AdminAvailabilityView, OperatorAvailabilityPanel } from '../components/dashboard/OperatorAvailabilityPanel';
import AdminPanelDrawer from '../components/dashboard/AdminPanelDrawer';

export default function Dashboard() {
  const { user, isAdmin, isLevel1Admin } = useApp();
  const queryClient = useQueryClient();
  const [openDrawer, setOpenDrawer] = useState(null); // 'standby' | 'team' | 'availability' | 'rigs' | 'timing'

  const { data: shoots = [] } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list('-date', 500),
  });

  const { data: rigs = [] } = useQuery({
    queryKey: ['rigs'],
    queryFn: () => base44.entities.Rig.list(),
    enabled: isAdmin,
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

  const isFeatureOn = (key) => appSettings.find(s => s.key === `feature_${key}`)?.value !== 'false';

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

  const todayShoots = myUpcoming.filter(s => s.date === todayStr);
  const futureShoots = myUpcoming.filter(s => s.date > todayStr);
  const displayShoots = [...todayShoots, ...futureShoots].slice(0, 6);

  const availableRigs = rigs.filter(r => r.status === 'available').length;
  const thisMonthMyShoots = shoots.filter(s =>
    s.date?.startsWith(format(today, 'yyyy-MM')) &&
    s.assigned_operators?.includes(user?.email)
  );
  const myStandbyCount = standbyDays.filter(s =>
    s.admin_email === user?.email && s.date >= todayStr
  ).length;

  const handleShootUpdate = async (id, data) => {
    await base44.entities.Shoot.update(id, data);
    queryClient.invalidateQueries({ queryKey: ['shoots'] });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">
            {`Welcome, ${user?.full_name?.split(' ')[0] || (isAdmin ? 'Admin' : 'Operator')}`}
          </h1>
          <p className="text-gray-400 mt-1">{format(today, 'EEEE, MMMM d, yyyy')}</p>
        </div>

        {/* Shoot change notifications */}
        <ShootChangeNotifier userEmail={user?.email} isAdmin={isAdmin} />

        {/* Standby banner — visible to ALL users */}
        <StandbyBanner todayStr={todayStr} currentUser={user} />

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">My Upcoming</p>
                  <p className="text-3xl font-bold text-white mt-1">{myUpcoming.length}</p>
                </div>
                <Camera className="h-10 w-10 text-blue-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">This Month (Mine)</p>
                  <p className="text-3xl font-bold text-white mt-1">{thisMonthMyShoots.length}</p>
                </div>
                <CalendarDays className="h-10 w-10 text-purple-500 opacity-80" />
              </div>
            </CardContent>
          </Card>

          {isAdmin ? (
            <>
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">My Standby Days</p>
                      <p className="text-3xl font-bold text-white mt-1">{myStandbyCount}</p>
                    </div>
                    <Phone className="h-10 w-10 text-yellow-500 opacity-80" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">Rigs Available</p>
                      <p className="text-3xl font-bold text-white mt-1">{availableRigs}</p>
                    </div>
                    <Wrench className="h-10 w-10 text-green-500 opacity-80" />
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">Total Assigned</p>
                      <p className="text-3xl font-bold text-white mt-1">
                        {shoots.filter(s => s.assigned_operators?.includes(user?.email)).length}
                      </p>
                    </div>
                    <Camera className="h-10 w-10 text-blue-500 opacity-80" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gray-900 border-gray-800 border-yellow-700/40">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-yellow-400 text-sm">Pending Approval</p>
                      <p className="text-3xl font-bold text-yellow-400 mt-1">
                        {shoots.filter(s => s.pending_operators?.includes(user?.email) && s.date >= todayStr).length}
                      </p>
                    </div>
                    <CalendarDays className="h-10 w-10 text-yellow-500 opacity-80" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">Today's Shoots</p>
                      <p className="text-3xl font-bold text-white mt-1">
                        {shoots.filter(s => s.date === todayStr && s.assigned_operators?.includes(user?.email)).length}
                      </p>
                    </div>
                    <CalendarDays className="h-10 w-10 text-green-500 opacity-80" />
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Admin quick-launch panel buttons */}
        {isAdmin && (() => {
          const panels = [
            { key: 'standby', featureKey: 'standby_panel', label: 'Standby Schedule', icon: Phone, color: 'text-yellow-400', bg: 'hover:bg-yellow-950/30 hover:border-yellow-700/50' },
            { key: 'team', featureKey: 'team_panel', label: 'Team Schedule', icon: CalendarRange, color: 'text-blue-400', bg: 'hover:bg-blue-950/30 hover:border-blue-700/50' },
            { key: 'availability', featureKey: 'availability_panel', label: 'Operator Availability', icon: Users, color: 'text-green-400', bg: 'hover:bg-green-950/30 hover:border-green-700/50' },
            { key: 'rigs', featureKey: 'rigs', label: 'Rigs Check', icon: CheckSquare, color: 'text-orange-400', bg: 'hover:bg-orange-950/30 hover:border-orange-700/50' },
            { key: 'timing', featureKey: 'timing_panel', label: 'Shoot Duration Tracker', icon: Clock, color: 'text-purple-400', bg: 'hover:bg-purple-950/30 hover:border-purple-700/50' },
          ].filter(p => isFeatureOn(p.featureKey));
          if (panels.length === 0) return null;
          return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {panels.map(item => (
                <button
                  key={item.key}
                  onClick={() => setOpenDrawer(item.key)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-900 border border-gray-800 transition-all ${item.bg}`}
                >
                  <item.icon className={`h-6 w-6 ${item.color}`} />
                  <span className="text-xs font-medium text-gray-300 text-center leading-tight">{item.label}</span>
                </button>
              ))}
            </div>
          );
        })()}

        {/* Admin panel drawers */}
        <AdminPanelDrawer title="Standby Schedule" open={openDrawer === 'standby'} onClose={() => setOpenDrawer(null)}>
          <StandbyManager user={user} allUsers={allUsers} />
        </AdminPanelDrawer>
        <AdminPanelDrawer title="Team Schedule" open={openDrawer === 'team'} onClose={() => setOpenDrawer(null)} wide>
          <WeeklyTeamPanel shoots={shoots} allUsers={allUsers} rigSettings={rigSettings} />
        </AdminPanelDrawer>
        <AdminPanelDrawer title="Operator Availability" open={openDrawer === 'availability'} onClose={() => setOpenDrawer(null)} wide>
          <AdminAvailabilityView allUsers={allUsers} />
        </AdminPanelDrawer>
        <AdminPanelDrawer title="Rigs Check" open={openDrawer === 'rigs'} onClose={() => setOpenDrawer(null)}>
          <RigsCheckPanel shoots={shoots} rigSettings={rigSettings} appSettings={appSettings} />
        </AdminPanelDrawer>
        <AdminPanelDrawer title="Shoot Duration Tracker" open={openDrawer === 'timing'} onClose={() => setOpenDrawer(null)}>
          <ShootTimingPanel shoots={shoots} allUsers={allUsers} />
        </AdminPanelDrawer>


        <h2 className="text-lg font-semibold text-white mb-4 mt-6">My Upcoming Games — Live Countdown</h2>

        {displayShoots.length === 0 ? (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-12 text-center">
              <Camera className="h-12 w-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500">No upcoming shoots assigned to you.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {displayShoots.map(shoot => (
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
        )}

        <div className="mt-8" />

        {isAdmin && <AdminMonthlySummary shoots={shoots} user={user} appSettings={appSettings} />}
        {!isAdmin && <OperatorAvailabilityPanel user={user} />}
        {!isAdmin && <div className="mt-6"><RemoteEarnings user={user} /></div>}

      </div>
    </div>
  );
}