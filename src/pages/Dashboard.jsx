import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Camera, CalendarDays, Clock, TrendingUp, Users, Wrench, CheckCircle2, AlertCircle } from 'lucide-react';
import { format, isAfter, isBefore, addDays } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';

const statusColors = {
  upcoming: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  confirmed: 'bg-green-500/20 text-green-400 border-green-500/30',
  in_progress: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  completed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export default function Dashboard() {
  const { user, isAdmin } = useApp();

  const { data: shoots = [] } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list('-date', 100),
  });

  const { data: rigs = [] } = useQuery({
    queryKey: ['rigs'],
    queryFn: () => base44.entities.Rig.list(),
    enabled: isAdmin,
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ['timeEntries'],
    queryFn: () => base44.entities.TimeEntry.list('-date', 50),
    enabled: isAdmin,
  });

  const today = new Date();
  const upcoming = shoots
    .filter(s => isAfter(new Date(s.date), today) || format(new Date(s.date), 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd'))
    .filter(s => s.status !== 'cancelled')
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(0, 5);

  const myShootsUpcoming = shoots
    .filter(s => s.assigned_operators?.includes(user?.email))
    .filter(s => isAfter(new Date(s.date), today) || format(new Date(s.date), 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd'))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const availableRigs = rigs.filter(r => r.status === 'available').length;
  const pendingEarnings = timeEntries.filter(t => t.status === 'pending').reduce((s, t) => s + (t.total || 0), 0);
  const thisMonthShoots = shoots.filter(s => {
    const d = new Date(s.date);
    return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  });

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
                  <p className="text-gray-400 text-sm">Upcoming Shoots</p>
                  <p className="text-3xl font-bold text-white mt-1">{upcoming.length}</p>
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
                      <p className="text-gray-400 text-sm">Pending Payouts</p>
                      <p className="text-3xl font-bold text-white mt-1">R {pendingEarnings.toLocaleString()}</p>
                    </div>
                    <TrendingUp className="h-10 w-10 text-yellow-500 opacity-80" />
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
                      <p className="text-gray-400 text-sm">My Shoots</p>
                      <p className="text-3xl font-bold text-white mt-1">{myShootsUpcoming.length}</p>
                    </div>
                    <CheckCircle2 className="h-10 w-10 text-green-500 opacity-80" />
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gray-900 border-gray-800">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-400 text-sm">Total Shoots</p>
                      <p className="text-3xl font-bold text-white mt-1">{shoots.filter(s => s.assigned_operators?.includes(user?.email)).length}</p>
                    </div>
                    <Camera className="h-10 w-10 text-blue-500 opacity-80" />
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming Shoots */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="border-b border-gray-800 pb-4">
              <CardTitle className="text-white flex items-center gap-2">
                <Camera className="h-5 w-5 text-blue-400" />
                {isAdmin ? 'Upcoming Shoots' : 'My Upcoming Shoots'}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {(isAdmin ? upcoming : myShootsUpcoming.slice(0, 5)).length === 0 ? (
                <p className="text-gray-500 text-sm p-6">No upcoming shoots scheduled.</p>
              ) : (
                <div className="divide-y divide-gray-800">
                  {(isAdmin ? upcoming : myShootsUpcoming.slice(0, 5)).map(shoot => (
                    <div key={shoot.id} className="p-4 hover:bg-gray-800/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-white">{shoot.title}</p>
                          <p className="text-sm text-gray-400 mt-0.5">{shoot.client} · {shoot.location}</p>
                          <p className="text-xs text-gray-500 mt-1">{format(new Date(shoot.date), 'EEE, MMM d')} {shoot.start_time && `· ${shoot.start_time}`}</p>
                        </div>
                        <Badge className={`text-xs border ${statusColors[shoot.status] || statusColors.upcoming}`}>
                          {shoot.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="p-4 border-t border-gray-800">
                <Link to={createPageUrl('Calendar')} className="text-blue-400 text-sm hover:underline">View Calendar →</Link>
              </div>
            </CardContent>
          </Card>

          {/* Admin: Recent time entries / Operator: Available shoots */}
          {isAdmin ? (
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="border-b border-gray-800 pb-4">
                <CardTitle className="text-white flex items-center gap-2">
                  <Clock className="h-5 w-5 text-purple-400" />
                  Recent Time Entries
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {timeEntries.length === 0 ? (
                  <p className="text-gray-500 text-sm p-6">No time entries yet.</p>
                ) : (
                  <div className="divide-y divide-gray-800">
                    {timeEntries.slice(0, 5).map(entry => (
                      <div key={entry.id} className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-white text-sm">{entry.operator_name || entry.operator_email}</p>
                          <p className="text-xs text-gray-400">{format(new Date(entry.date), 'MMM d')} · {entry.hours}h</p>
                        </div>
                        <div className="text-right">
                          <p className="text-white font-medium">R {(entry.total || 0).toLocaleString()}</p>
                          <Badge className={entry.status === 'paid' ? 'bg-green-500/20 text-green-400 text-xs' : entry.status === 'approved' ? 'bg-blue-500/20 text-blue-400 text-xs' : 'bg-yellow-500/20 text-yellow-400 text-xs'}>
                            {entry.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="p-4 border-t border-gray-800">
                  <Link to={createPageUrl('Timesheets')} className="text-blue-400 text-sm hover:underline">View All →</Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="border-b border-gray-800 pb-4">
                <CardTitle className="text-white flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-yellow-400" />
                  Open Shoots — Assign Yourself
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {shoots.filter(s => s.status === 'upcoming' && isAfter(new Date(s.date), today)).length === 0 ? (
                  <p className="text-gray-500 text-sm p-6">No open shoots available.</p>
                ) : (
                  <div className="divide-y divide-gray-800">
                    {shoots.filter(s => s.status === 'upcoming' && isAfter(new Date(s.date), today) && !s.assigned_operators?.includes(user?.email)).slice(0, 5).map(shoot => (
                      <div key={shoot.id} className="p-4">
                        <p className="font-medium text-white">{shoot.title}</p>
                        <p className="text-sm text-gray-400">{shoot.location} · {format(new Date(shoot.date), 'EEE, MMM d')}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="p-4 border-t border-gray-800">
                  <Link to={createPageUrl('Shoots')} className="text-blue-400 text-sm hover:underline">View All Shoots →</Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}