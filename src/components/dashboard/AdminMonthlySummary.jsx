import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Camera, Phone, Clock, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminMonthlySummary({ shoots, user }) {
  const [expanded, setExpanded] = useState(false);
  const today = new Date();
  const monthStr = format(today, 'yyyy-MM');

  const myMonthShoots = shoots.filter(s =>
    s.date?.startsWith(monthStr) &&
    s.assigned_operators?.includes(user?.email) &&
    s.status !== 'cancelled'
  );

  const myMonthStandby = shoots.filter(s =>
    s.date?.startsWith(monthStr) &&
    s.standby_admin === user?.email &&
    s.status !== 'cancelled'
  );

  const { data: myEntries = [] } = useQuery({
    queryKey: ['myTimeEntries', user?.email],
    queryFn: () => base44.entities.TimeEntry.filter({ operator_email: user?.email }, '-date', 200),
    enabled: !!user?.email,
  });

  const monthEntries = myEntries.filter(e => e.date?.startsWith(monthStr));
  const totalHours = monthEntries.reduce((s, e) => s + (e.hours || 0), 0);

  return (
    <Card className="bg-gray-900 border-gray-800 mt-8">
      <CardHeader className="border-b border-gray-800 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-base">My {format(today, 'MMMM')} Summary</CardTitle>
          <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white gap-1.5 text-xs"
            onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Less' : 'Details'}
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        <div className="grid grid-cols-3 gap-4 mb-4">
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <Camera className="h-5 w-5 text-blue-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">{myMonthShoots.length}</p>
            <p className="text-xs text-gray-400">Shoots</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <Phone className="h-5 w-5 text-yellow-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">{myMonthStandby.length}</p>
            <p className="text-xs text-gray-400">Standby</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3 text-center">
            <Clock className="h-5 w-5 text-green-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-white">{totalHours.toFixed(1)}h</p>
            <p className="text-xs text-gray-400">Hours Logged</p>
          </div>
        </div>

        {expanded && (
          <div className="space-y-4">
            {myMonthShoots.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Shoots This Month</p>
                <div className="space-y-1">
                  {myMonthShoots.sort((a, b) => a.date.localeCompare(b.date)).map(s => (
                    <div key={s.id} className="flex items-center justify-between bg-gray-800/40 rounded px-3 py-2">
                      <div>
                        <p className="text-sm text-white font-medium">{s.title}</p>
                        <p className="text-xs text-gray-400">
                          {format(new Date(s.date + 'T12:00:00'), 'EEE, MMM d')}
                          {s.game_time && ` · ${s.game_time}`}
                        </p>
                      </div>
                      <Badge className={`text-xs ${s.status === 'completed' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-blue-500/20 text-blue-400 border-blue-500/30'}`}>
                        {s.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {myMonthStandby.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Standby This Month</p>
                <div className="space-y-1">
                  {myMonthStandby.sort((a, b) => a.date.localeCompare(b.date)).map(s => (
                    <div key={s.id} className="flex items-center justify-between bg-yellow-950/20 border border-yellow-900/30 rounded px-3 py-2">
                      <div>
                        <p className="text-sm text-white font-medium">{s.title}</p>
                        <p className="text-xs text-gray-400">{format(new Date(s.date + 'T12:00:00'), 'EEE, MMM d')}</p>
                      </div>
                      <Phone className="h-3.5 w-3.5 text-yellow-400" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {monthEntries.length > 0 && (
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Time Entries This Month</p>
                <div className="space-y-1">
                  {monthEntries.slice(0, 15).map(e => (
                    <div key={e.id} className="flex items-center justify-between bg-gray-800/40 rounded px-3 py-2">
                      <p className="text-sm text-gray-300 truncate flex-1">{e.notes || e.date}</p>
                      <span className="text-xs font-mono text-white ml-2 flex-shrink-0">{Number(e.hours).toFixed(1)}h</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {myMonthShoots.length === 0 && myMonthStandby.length === 0 && monthEntries.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">Nothing logged for this month yet.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}