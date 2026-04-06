import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent } from "@/components/ui/card";
import { Camera, CalendarDays, Wrench, Phone, Activity, LayoutDashboard } from 'lucide-react';
import { format } from 'date-fns';
import CountdownCard from '../components/dashboard/CountdownCard';
import RemoteEarnings from '../components/dashboard/RemoteEarnings';
import AdminMonthlySummary from '../components/dashboard/AdminMonthlySummary';
import RigsCheckPanel from '../components/dashboard/RigsCheckPanel';
import ShootSummaryPanel from '../components/dashboard/ShootSummaryPanel';
import TeamActivityList from '../components/dashboard/TeamActivityList';
import StandbyManager from '../components/dashboard/StandbyManager';
import StandbyBanner from '../components/dashboard/StandbyBanner';
import WeeklyTeamPanel from '../components/dashboard/WeeklyTeamPanel';

export default function Dashboard() {
  const { user, isAdmin, isLevel1Admin } = useApp();
  const queryClient = useQueryClient();
  const [adminTab, setAdminTab] = useState('my'); // 'my' | 'team'

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
    enabled: isAdmin,
  });

  const { data: allUsersPublic = [] } = useQuery({
    queryKey: ['allUsersPublic'],
    queryFn: () => base44.entities.User.list(),
    enabled: !isAdmin,
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

  const allUsers = isAdmin ? users : allUsersPublic;
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

  // For admins: only include standby shoots if they are currently on standby for that date
  // (i.e. there's a standby entry for that date AND no other admin's standby has started after theirs)
  const nowStr = new Date().toISOString();
  const activeStandbyDates = isAdmin ? new Set(
    standbyDays
      .filter(sd => {
        if (sd.admin_email !== user?.email) return false;
        if (sd.date < todayStr) return false;
        if (sd.date > todayStr) return true; // future standby — include
        // Today: check if standby time window is still active
        // If end_time is set and current time is past it, exclude
        if (sd.end_time) {
          const [eh, em] = sd.end_time.split(':').map(Number);
          const endMins = eh * 60 + em;
          const now = new Date();
          const nowMins = now.getHours() * 60 + now.getMinutes();
          if (nowMins > endMins) return false;
        }
        return true;
      })
      .map(sd => sd.date)
  ) : new Set();

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
          <p className="text-gray-400 mt-1">{format(today, 'EEEE, MMMM d yyyy')}</p>
        </div>

        {/* Standby banner — visible to ALL users */}
        <StandbyBanner standbyDays={standbyDays} allUsers={allUsers} todayStr={todayStr} />

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

        {/* Admin: tabs */}
        {isAdmin && (
          <div className="flex gap-1 mb-6 bg-gray-900 border border-gray-800 rounded-xl p-1 w-fit flex-wrap">
            <button onClick={() => setAdminTab('my')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${adminTab === 'my' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              <LayoutDashboard className="h-4 w-4" /> My Schedule
            </button>
            <button onClick={() => setAdminTab('team')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${adminTab === 'team' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
              <Activity className="h-4 w-4" /> Team Activity
            </button>
          </div>
        )}

        {/* MY SCHEDULE tab */}
        {(!isAdmin || adminTab === 'my') && (
          <>
            {isAdmin && <StandbyManager user={user} allUsers={users} />}
            {isAdmin && <WeeklyTeamPanel shoots={shoots} allUsers={users} />}
            {isAdmin && <RigsCheckPanel shoots={shoots} rigSettings={rigSettings} appSettings={appSettings} />}
            {isAdmin && <ShootSummaryPanel shoots={shoots} appSettings={appSettings} />}

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

            <div className="mt-8">
              {(!isAdmin || isLevel1Admin) && (
                <RemoteEarnings
                  shoots={shoots.filter(s => s.assigned_operators?.includes(user?.email))}
                  user={user}
                />
              )}
            </div>

            {isAdmin && <AdminMonthlySummary shoots={shoots} user={user} />}
          </>
        )}

        {/* TEAM ACTIVITY tab */}
        {isAdmin && adminTab === 'team' && (
          <TeamActivityList shoots={shoots} allUsers={users} />
        )}

      </div>
    </div>
  );
}