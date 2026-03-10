import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, CalendarDays, Wrench, Users, Save, Phone } from 'lucide-react';
import { format } from 'date-fns';
import CountdownCard from '../components/dashboard/CountdownCard';
import EarningsSummary from '../components/dashboard/EarningsSummary';
import RemoteEarnings from '../components/dashboard/RemoteEarnings';
import AdminMonthlySummary from '../components/dashboard/AdminMonthlySummary';

const DISPLAY_COUNT_KEY = 'dashboard_display_count';

export default function Dashboard() {
  const { user, isAdmin, isLevel1Admin } = useApp();
  const queryClient = useQueryClient();

  // Persist display count in localStorage
  const [displayCount, setDisplayCount] = useState(() => {
    const saved = localStorage.getItem(DISPLAY_COUNT_KEY);
    return saved ? Number(saved) : 6;
  });
  const [pendingCount, setPendingCount] = useState(displayCount);

  const saveDisplayCount = () => {
    setDisplayCount(pendingCount);
    localStorage.setItem(DISPLAY_COUNT_KEY, String(pendingCount));
  };

  const { data: shoots = [] } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list('-date', 500),
  });

  const { data: rigs = [] } = useQuery({
    queryKey: ['rigs'],
    queryFn: () => base44.entities.Rig.list(),
    enabled: isAdmin,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    enabled: isAdmin,
  });

  // Standby admin for remote users
  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsersPublic'],
    queryFn: () => base44.entities.User.list(),
    enabled: !isAdmin,
  });

  const standbyAdmins = (isAdmin ? users : allUsers).filter(u => u.standby === true && u.role === 'admin');

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  const upcomingShoots = shoots
    .filter(s => s.status !== 'cancelled' && s.status !== 'completed' && s.date >= todayStr)
    .sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      return d !== 0 ? d : (a.game_time || '').localeCompare(b.game_time || '');
    });

  const myUpcoming = upcomingShoots.filter(s =>
    s.assigned_operators?.includes(user?.email) || s.standby_admin === user?.email
  );
  // Admins see only their own assigned/standby shoots (like remote users)
  const displayShoots = myUpcoming.slice(0, isAdmin ? displayCount : undefined);

  const availableRigs = rigs.filter(r => r.status === 'available').length;
  const thisMonthShoots = shoots.filter(s => s.date?.startsWith(format(today, 'yyyy-MM')));

  const myStandbyCount = upcomingShoots.filter(s => s.standby_admin === user?.email).length;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">
            {`Welcome, ${user?.full_name?.split(' ')[0] || (isAdmin ? 'Admin' : 'Operator')}`}
          </h1>
          <p className="text-gray-400 mt-1">{format(today, 'EEEE, MMMM d yyyy')}</p>
        </div>

        {/* Standby contact banner — remote users */}
        {!isAdmin && standbyAdmins.length > 0 && (
          <div className="mb-6 bg-yellow-950/40 border border-yellow-800/60 rounded-xl px-4 py-3 flex items-center gap-3">
            <span className="text-yellow-400 text-lg">📞</span>
            <div>
              <p className="text-yellow-300 text-sm font-medium">Standby Contact{standbyAdmins.length > 1 ? 's' : ''}:</p>
              <p className="text-yellow-200 text-sm">{standbyAdmins.map(a => a.full_name || a.email).join(', ')}</p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
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
                  <p className="text-gray-400 text-sm">This Month</p>
                  <p className="text-3xl font-bold text-white mt-1">{thisMonthShoots.length}</p>
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
                      <p className="text-gray-400 text-sm">My Standby</p>
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

        <h2 className="text-lg font-semibold text-white mb-4">My Upcoming Games — Live Countdown</h2>

        {/* Countdown Grid */}
        {displayShoots.length === 0 ? (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-12 text-center">
              <Camera className="h-12 w-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500">
                {isAdmin ? 'No upcoming shoots scheduled.' : 'You have no upcoming shoots assigned.'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {displayShoots.map(shoot => (
              <CountdownCard key={shoot.id} shoot={shoot} standbyAdmins={standbyAdmins} />
            ))}
          </div>
        )}

        {/* Earnings */}
        <div className="mt-8">
          {isLevel1Admin ? (
            <EarningsSummary shoots={shoots} users={users} />
          ) : !isAdmin ? (
            <RemoteEarnings
              shoots={shoots.filter(s => s.assigned_operators?.includes(user?.email))}
              user={user}
            />
          ) : null}
        </div>

        {/* Admin monthly summary */}
        {isAdmin && <AdminMonthlySummary shoots={shoots} user={user} />}
      </div>
    </div>
  );
}