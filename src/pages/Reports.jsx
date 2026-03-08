import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Camera, Clock, Users } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';

export default function Reports() {
  const { isAdmin } = useApp();
  const [period, setPeriod] = useState('3');

  const { data: shoots = [] } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list('-date', 500),
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ['timeEntries'],
    queryFn: () => base44.entities.TimeEntry.list('-date', 500),
  });

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500">Reports are available to admins only.</p>
      </div>
    );
  }

  const months = eachMonthOfInterval({ start: subMonths(new Date(), parseInt(period) - 1), end: new Date() });

  const monthlyData = months.map(month => {
    const label = format(month, 'MMM yy');
    const monthShoots = shoots.filter(s => s.date?.startsWith(format(month, 'yyyy-MM')));
    const monthEntries = timeEntries.filter(e => e.date?.startsWith(format(month, 'yyyy-MM')));
    const earnings = monthEntries.reduce((s, e) => s + (e.total || 0), 0);
    return { label, shoots: monthShoots.length, earnings };
  });

  const statusData = ['upcoming','confirmed','in_progress','completed','cancelled'].map(status => ({
    name: status.replace('_', ' '),
    value: shoots.filter(s => s.status === status).length,
  })).filter(d => d.value > 0);

  const COLORS = ['#3b82f6','#22c55e','#eab308','#6b7280','#ef4444'];

  const totalEarnings = timeEntries.reduce((s, e) => s + (e.total || 0), 0);
  const paidEarnings = timeEntries.filter(e => e.status === 'paid').reduce((s, e) => s + (e.total || 0), 0);
  const totalHours = timeEntries.reduce((s, e) => s + (e.hours || 0), 0);
  const operatorCount = [...new Set(timeEntries.map(e => e.operator_email).filter(Boolean))].length;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Reports & Earnings</h1>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-40 bg-gray-900 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              <SelectItem value="3" className="text-white">Last 3 months</SelectItem>
              <SelectItem value="6" className="text-white">Last 6 months</SelectItem>
              <SelectItem value="12" className="text-white">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Earnings', value: `R ${totalEarnings.toLocaleString()}`, icon: TrendingUp, color: 'text-green-400' },
            { label: 'Total Paid Out', value: `R ${paidEarnings.toLocaleString()}`, icon: TrendingUp, color: 'text-blue-400' },
            { label: 'Total Shoots', value: shoots.length, icon: Camera, color: 'text-purple-400' },
            { label: 'Total Hours', value: `${totalHours.toFixed(0)}h`, icon: Clock, color: 'text-yellow-400' },
          ].map(kpi => (
            <Card key={kpi.label} className="bg-gray-900 border-gray-800">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-400 text-sm">{kpi.label}</p>
                    <p className={`text-2xl font-bold mt-1 ${kpi.color}`}>{kpi.value}</p>
                  </div>
                  <kpi.icon className={`h-8 w-8 opacity-50 ${kpi.color}`} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Earnings Chart */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="border-b border-gray-800 pb-3">
              <CardTitle className="text-white text-base">Earnings per Month</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData}>
                  <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', color: '#fff' }} />
                  <Bar dataKey="earnings" fill="#3b82f6" radius={[4,4,0,0]} name="Earnings (R)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Shoots per Month */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="border-b border-gray-800 pb-3">
              <CardTitle className="text-white text-base">Shoots per Month</CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthlyData}>
                  <XAxis dataKey="label" tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#6b7280', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', color: '#fff' }} />
                  <Bar dataKey="shoots" fill="#8b5cf6" radius={[4,4,0,0]} name="Shoots" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Shoot Status Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="border-b border-gray-800 pb-3">
              <CardTitle className="text-white text-base">Shoot Status Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 flex items-center gap-6">
              <PieChart width={160} height={160}>
                <Pie data={statusData} cx={75} cy={75} innerRadius={45} outerRadius={75} dataKey="value">
                  {statusData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
              </PieChart>
              <div className="space-y-2">
                {statusData.map((d, i) => (
                  <div key={d.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-sm text-gray-300 capitalize">{d.name}</span>
                    <span className="text-sm font-bold text-white ml-auto">{d.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Operator Breakdown */}
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="border-b border-gray-800 pb-3">
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-400" /> Operator Earnings
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {[...new Set(timeEntries.map(e => e.operator_email).filter(Boolean))].map(email => {
                const ops = timeEntries.filter(e => e.operator_email === email);
                const total = ops.reduce((s, e) => s + (e.total || 0), 0);
                const paid = ops.filter(e => e.status === 'paid').reduce((s, e) => s + (e.total || 0), 0);
                const name = ops[0]?.operator_name || email;
                return (
                  <div key={email} className="px-5 py-3 border-b border-gray-800 last:border-0 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-white">{name}</p>
                      <p className="text-xs text-gray-500">{email} · {ops.reduce((s,e) => s+(e.hours||0),0).toFixed(1)}h</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-white">R {total.toLocaleString()}</p>
                      <p className="text-xs text-green-400">R {paid.toLocaleString()} paid</p>
                    </div>
                  </div>
                );
              })}
              {operatorCount === 0 && <p className="text-gray-500 text-sm p-6">No data yet.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}