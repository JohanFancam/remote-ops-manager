import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera, CalendarDays, Wrench, Users } from 'lucide-react';
import { format, isAfter } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';
import CountdownCard from '../components/dashboard/CountdownCard';
import EarningsSummary from '../components/dashboard/EarningsSummary';
import RemoteEarnings from '../components/dashboard/RemoteEarnings';

export default function Dashboard() {
  const { user, isAdmin } = useApp();
  const [displayCount, setDisplayCount] = useState(5);

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

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  const upcomingShoots = shoots
    .filter(s =>
      s.status !== 'cancelled' &&
      s.status !== 'completed' &&
      (s.date > todayStr || s.date === todayStr)
    )
    .sort((a, b) => {
      const dateComp = a.date.localeCompare(b.date);
      if (dateComp !== 0) return dateComp;
      return (a.game_time || a.start_time || '').localeCompare(b.game_time || b.start_time || '');
    })
    .slice(0, isAdmin ? displayCount : 999);

  const myUpcoming = upcomingShoots.filter(s => s.assigned_operators?.includes(user?.email));

  const displayShoots = isAdmin ? upcomingShoots : myUpcoming;

  const availableRigs = rigs.filter(r => r.status === 'available').length;
  const thisMonthShoots = shoots.filter(s => s.date?.startsWith(format(today, 'yyyy-MM')));

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">
            {isAdmin ? 'Operations Dashboard' : `Welcome, ${user?.full_name?.split(' ')[0] || 'Operator'}`}
          </h1>
          <p className="text-gray-400 mt-1">{format(today, 'EEEE, MMMM d yyyy')}</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-gray-400 text-sm">Upcoming</p>
                  <p className="text-3xl font-bold text-white mt-1">
                    {isAdmin ? upcomingShoots.length : myUpcoming.length}
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
                      <p className="text-gray-400 text-sm">Rigs Available</p>
                      <p className="text-3xl font-bold text-white mt-1">{availableRigs}</p>
                    </div>
                    <Wrench className="h-10 w-10 text-green-500 opacity-80" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">Operators</p>
                      <p className="text-3xl font-bold text-white mt-1">{users.filter(u => u.role !== 'admin').length}</p>
                    </div>
                    <Users className="h-10 w-10 text-yellow-500 opacity-80" />
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

        {/* Admin: display count selector */}
        {isAdmin && (
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              Upcoming Games — Live Countdown
            </h2>
            <div className="flex items-center gap-2">
              <span className="text-gray-400 text-sm">Show:</span>
              <Select value={String(displayCount)} onValueChange={v => setDisplayCount(Number(v))}>
                <SelectTrigger className="w-20 bg-gray-900 border-gray-700 text-white h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  {[5, 6, 7, 8, 9, 10].map(n => (
                    <SelectItem key={n} value={String(n)} className="text-white">{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {!isAdmin && (
          <h2 className="text-lg font-semibold text-white mb-4">My Upcoming Games — Live Countdown</h2>
        )}

        {/* Countdown Grid */}
        {displayShoots.length === 0 ? (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-12 text-center">
              <Camera className="h-12 w-12 text-gray-700 mx-auto mb-3" />
              <p className="text-gray-500">
                {isAdmin ? 'No upcoming shoots scheduled.' : 'You have no upcoming shoots assigned.'}
              </p>
              {!isAdmin && (
                <Link to={createPageUrl('Shoots')} className="text-blue-400 text-sm hover:underline mt-2 block">
                  Browse available shoots →
                </Link>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {displayShoots.map(shoot => (
              <CountdownCard key={shoot.id} shoot={shoot} />
            ))}
          </div>
        )}

        {/* Earnings section */}
        <div className="mt-8">
          {isAdmin ? (
            <EarningsSummary shoots={shoots} users={users} />
          ) : (
            <RemoteEarnings
              shoots={shoots.filter(s => s.assigned_operators?.includes(user?.email))}
              user={user}
            />
          )}
        </div>
      </div>
    </div>
  );
}