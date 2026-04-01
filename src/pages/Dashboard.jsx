import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent } from "@/components/ui/card";
import { Camera, CalendarDays, Wrench, Phone, Activity, LayoutDashboard, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import CountdownCard from '../components/dashboard/CountdownCard';
import RemoteEarnings from '../components/dashboard/RemoteEarnings';
import AdminMonthlySummary from '../components/dashboard/AdminMonthlySummary';
import RigsCheckPanel from '../components/dashboard/RigsCheckPanel';
import TeamActivityList from '../components/dashboard/TeamActivityList';
import StandbyManager from '../components/dashboard/StandbyManager';

export default function Dashboard() {
  const { user, isAdmin, isLevel1Admin } = useApp();
  const queryClient = useQueryClient();
  const [adminTab, setAdminTab] = useState('my'); // 'my' | 'team' | 'accounts'

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

  const allUsers = isAdmin ? users : allUsersPublic;
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');

  // Standby contact for today (from StandbyDay entity)
  const todayStandby = standbyDays.find(s => s.date === todayStr);
  const todayStandbyUser = todayStandby ? allUsers.find(u => u.email === todayStandby.admin_email) : null;

  const upcomingShoots = shoots
    .filter(s => s.status !== 'cancelled' && s.status !== 'completed' && s.date >= todayStr)
    .sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      return d !== 0 ? d : (a.game_time || '').localeCompare(b.game_time || '');
    });

  const myUpcoming = upcomingShoots.filter(s =>
    s.assigned_operators?.includes(user?.email) ||
    standbyDays.some(sd => sd.date === s.date && sd.admin_email === user?.email)
  );

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

        {/* Standby contact banner — remote users */}
        {!isAdmin && todayStandbyUser && (
          <div className="mb-6 bg-yellow-950/40 border border-yellow-800/60 rounded-xl px-4 py-3 flex items-center gap-3">
            <Phone className="h-5 w-5 text-yellow-400 flex-shrink-0" />
            <div>
              <p className="text-yellow-300 text-sm font-medium">Today's Standby Contact:</p>
              <p className="text-yellow-200 text-sm">{todayStandbyUser.full_name || todayStandbyUser.email}</p>
            </div>
          </div>
        )}

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
            {isLevel1Admin && (
              <button onClick={() => setAdminTab('accounts')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${adminTab === 'accounts' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                <DollarSign className="h-4 w-4" /> Accounts
              </button>
            )}
          </div>
        )}

        {/* MY SCHEDULE tab */}
        {(!isAdmin || adminTab === 'my') && (
          <>
            {isAdmin && <StandbyManager user={user} allUsers={users} />}
            {isAdmin && <RigsCheckPanel shoots={shoots} rigSettings={rigSettings} />}

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
                  />
                ))}
              </div>
            )}

            <div className="mt-8">
              {!isAdmin && (
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

        {/* ACCOUNTS tab — level 1 admin only */}
        {isAdmin && adminTab === 'accounts' && isLevel1Admin && (
          <AccountsQuickView shoots={shoots} allUsers={users} />
        )}
      </div>
    </div>
  );
}

// Inline quick accounts view for admin tab
function AccountsQuickView({ shoots, allUsers }) {
  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'));
  const { data: paymentRecords = [] } = useQuery({
    queryKey: ['paymentRecords'],
    queryFn: () => base44.entities.PaymentRecord.list('-created_date', 2000),
  });

  const BASE_RATE = 200;
  const ADDITIONAL_RATE = 150;

  const goMonth = (delta) => {
    const [y, m] = filterMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setFilterMonth(format(d, 'yyyy-MM'));
  };

  const monthShoots = shoots.filter(s => s.date?.startsWith(filterMonth) && s.status !== 'cancelled');
  const remoteUsers = allUsers.filter(u => u.role === 'user');

  const rows = remoteUsers.map(op => {
    const opShoots = monthShoots.filter(s => s.assigned_operators?.includes(op.email));
    const opRecords = paymentRecords.filter(r => r.operator_email === op.email && r.period_month === filterMonth);
    const total = opShoots.reduce((sum, sh) => {
      const rec = opRecords.find(r => r.shoot_id === sh.id);
      const fee = rec?.override_fee != null ? rec.override_fee : (rec?.is_additional ? ADDITIONAL_RATE : BASE_RATE);
      return sum + fee;
    }, 0);
    const allPaid = opShoots.length > 0 && opShoots.every(sh => opRecords.find(r => r.shoot_id === sh.id)?.paid === true);
    return { ...op, shoots: opShoots.length, total, paid: allPaid };
  }).filter(op => op.shoots > 0);

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Accounts Overview</h2>
        <div className="flex items-center gap-2">
          <button className="text-gray-400 hover:text-white px-2" onClick={() => goMonth(-1)}>{'<'}</button>
          <span className="text-sm text-gray-300">{format(new Date(filterMonth + '-01'), 'MMM yyyy')}</span>
          <button className="text-gray-400 hover:text-white px-2" onClick={() => goMonth(1)}>{'>'}</button>
        </div>
      </div>
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="grid grid-cols-4 text-xs text-gray-500 uppercase tracking-wider px-4 py-2 border-b border-gray-800">
          <span>Operator</span><span className="text-center">Shoots</span><span className="text-center">Amount</span><span className="text-center">Status</span>
        </div>
        {rows.length === 0 ? (
          <p className="text-gray-500 text-sm text-center py-8">No activity this month.</p>
        ) : rows.map(r => (
          <div key={r.email} className="grid grid-cols-4 px-4 py-3 border-b border-gray-800/50 last:border-0 items-center">
            <div>
              <p className="text-sm text-white">{r.full_name || r.email}</p>
              <p className="text-xs text-gray-500 truncate">{r.email}</p>
            </div>
            <p className="text-center text-white">{r.shoots}</p>
            <p className="text-center font-mono text-white">${r.total.toFixed(2)}</p>
            <div className="flex justify-center">
              <span className={`text-xs px-2 py-0.5 rounded-full border ${r.paid ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'}`}>
                {r.paid ? 'Paid' : 'Unpaid'}
              </span>
            </div>
          </div>
        ))}
        {rows.length > 0 && (
          <div className="grid grid-cols-4 px-4 py-3 border-t border-gray-700 bg-gray-800/30">
            <span className="text-sm font-semibold text-white">Total</span>
            <span />
            <span className="text-center font-mono font-bold text-white">${grandTotal.toFixed(2)}</span>
            <span />
          </div>
        )}
      </div>
      <div className="mt-4 text-center">
        <a href="/Accounts" className="text-sm text-blue-400 hover:text-blue-300">Open full Accounts page →</a>
      </div>
    </div>
  );
}