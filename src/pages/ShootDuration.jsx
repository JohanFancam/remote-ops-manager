import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import ShootTimingPanel from '../components/dashboard/ShootTimingPanel';
import { Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import { format, startOfYear, endOfYear, eachMonthOfInterval } from 'date-fns';

function formatDuration(ms) {
  if (!ms || ms < 0) return '—';
  const totalMins = Math.round(ms / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function ShootDuration() {
  const queryClient = useQueryClient();
  const [filterMonth, setFilterMonth] = useState(format(new Date(), 'yyyy-MM'));

  const { data: shoots = [] } = useQuery({ queryKey: ['shoots'], queryFn: () => base44.entities.Shoot.list('-date', 500) });
  const { data: users = [] } = useQuery({ queryKey: ['allUsers'], queryFn: () => base44.entities.User.list() });
  const { data: presenceRecords = [] } = useQuery({ queryKey: ['userPresence'], queryFn: () => base44.entities.UserPresence.list() });

  const allUsers = useMemo(() => {
    const map = new Map();
    presenceRecords.forEach(p => { if (p.user_email) map.set(p.user_email, { email: p.user_email, full_name: p.user_name, role: p.user_role }); });
    users.forEach(u => { if (u.email) map.set(u.email, u); });
    return Array.from(map.values());
  }, [users, presenceRecords]);

  const timedShoots = useMemo(() => {
    return shoots
      .filter(s => s.phase_status?.setup_complete && s.phase_status?.shoot_complete)
      .map(s => {
        const start = new Date(s.phase_status.setup_complete);
        const end = new Date(s.phase_status.shoot_complete);
        return { ...s, durationMs: end - start, start, end };
      });
  }, [shoots]);

  const goMonth = (delta) => {
    const [y, m] = filterMonth.split('-').map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setFilterMonth(format(d, 'yyyy-MM'));
  };

  // Yearly chart data — avg duration per month
  const yearChartData = useMemo(() => {
    const yearNum = parseInt(filterMonth.split('-')[0]);
    const months = eachMonthOfInterval({
      start: startOfYear(new Date(yearNum, 0, 1)),
      end: endOfYear(new Date(yearNum, 0, 1)),
    });
    return months.map(monthDate => {
      const monthKey = format(monthDate, 'yyyy-MM');
      const ms = timedShoots.filter(s => s.date?.startsWith(monthKey));
      const avgMs = ms.length > 0 ? ms.reduce((s, x) => s + x.durationMs, 0) / ms.length : 0;
      const avgHours = avgMs / 3600000;
      return {
        month: format(monthDate, 'MMM'),
        count: ms.length,
        avgHours: parseFloat(avgHours.toFixed(2)),
        isCurrentMonth: monthKey === filterMonth,
      };
    });
  }, [timedShoots, filterMonth]);

  // Monthly chart — shoots per day
  const monthShoots = timedShoots.filter(s => s.date?.startsWith(filterMonth));
  const monthChartData = useMemo(() => {
    const byDay = {};
    monthShoots.forEach(s => {
      const day = s.date.slice(8, 10); // DD
      if (!byDay[day]) byDay[day] = { day, count: 0, totalMs: 0 };
      byDay[day].count++;
      byDay[day].totalMs += s.durationMs;
    });
    return Object.values(byDay).sort((a, b) => a.day.localeCompare(b.day)).map(d => ({
      ...d,
      avgHours: parseFloat((d.totalMs / d.count / 3600000).toFixed(2)),
    }));
  }, [monthShoots]);

  const yearTotal = yearChartData.reduce((s, d) => s + d.count, 0);

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Clock className="h-6 w-6 text-purple-400" />
          <h1 className="text-2xl font-bold text-zinc-900">Shoot Duration Tracker</h1>
        </div>

        {/* Yearly chart */}
        <Card className="bg-white border-zinc-200">
          <CardContent className="p-5">
            <div className="mb-4">
              <p className="text-sm text-zinc-500">{filterMonth.split('-')[0]} — Total Timed Shoots</p>
              <p className="text-2xl font-bold text-zinc-900">{yearTotal} shoots</p>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={yearChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                <Tooltip
                  formatter={(v, name) => [name === 'count' ? `${v} shoots` : `${v}h avg`, name === 'count' ? 'Shoots' : 'Avg Duration']}
                  contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: '#9ca3af' }}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {yearChartData.map((entry, i) => (
                    <Cell key={i} fill={entry.isCurrentMonth ? '#a855f7' : '#374151'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Month navigator */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100" onClick={() => goMonth(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <h2 className="text-lg font-semibold">{format(new Date(filterMonth + '-01'), 'MMMM yyyy')}</h2>
          <Button variant="ghost" size="icon" className="text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100" onClick={() => goMonth(1)}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {/* Monthly chart — avg duration per day */}
        {monthChartData.length > 0 && (
          <Card className="bg-white border-zinc-200">
            <CardContent className="p-5">
              <p className="text-sm text-zinc-500 mb-3">Avg Duration by Day — {format(new Date(filterMonth + '-01'), 'MMMM yyyy')}</p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={monthChartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="25%">
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                  <XAxis dataKey="day" tick={{ fill: '#9ca3af', fontSize: 12 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} width={32} tickFormatter={v => `${v}h`} />
                  <Tooltip
                    formatter={(v) => [`${v}h`, 'Avg Duration']}
                    contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: '#9ca3af' }}
                  />
                  <Bar dataKey="avgHours" fill="#a855f7" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Existing detailed timing panel */}
        <div className="bg-white border border-zinc-200 rounded-xl p-5">
          <ShootTimingPanel
            shoots={shoots}
            allUsers={allUsers}
            onUpdate={async (id, data) => {
              await base44.entities.Shoot.update(id, data);
              queryClient.invalidateQueries({ queryKey: ['shoots'] });
            }}
          />
        </div>
      </div>
    </div>
  );
}