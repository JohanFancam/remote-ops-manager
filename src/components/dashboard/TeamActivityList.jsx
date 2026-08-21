import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Zap, Camera, AlertTriangle, Volume2, CheckCircle, Clock, Calendar, MapPin } from 'lucide-react';
import { getDisplayName } from '../utils/nameUtils';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

const PHASES = [
  { key: 'setup_complete', label: 'Setup', icon: Zap },
  { key: 'pre_shoot_started', label: 'Pre-Shoot', icon: Camera },
  { key: 'attention_started', label: 'Attention', icon: AlertTriangle },
  { key: 'sound_started', label: 'Sound', icon: Volume2 },
  { key: 'shoot_complete', label: 'Complete', icon: CheckCircle },
];

function getLatestPhase(phaseStatus) {
  phaseStatus = phaseStatus || {};
  for (let i = PHASES.length - 1; i >= 0; i--) {
    if (phaseStatus[PHASES[i].key]) return PHASES[i];
  }
  return null;
}

export default function TeamActivityList({ shoots = [], allUsers = [] }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Subscribe to live shoot updates
  const { data: liveShoots = shoots } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list('-date', 500),
    refetchInterval: 10000,
  });

  const todayShoots = liveShoots
    .filter(s => s.date === todayStr && s.status !== 'cancelled')
    .sort((a, b) => (a.game_time || '').localeCompare(b.game_time || ''));

  const upcomingShoots = liveShoots
    .filter(s => s.date > todayStr && s.status !== 'cancelled' && s.assigned_operators?.length > 0)
    .sort((a, b) => a.date.localeCompare(b.date) || (a.game_time || '').localeCompare(b.game_time || ''))
    .slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Today's Activity */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader className="border-b border-zinc-800 pb-3">
          <CardTitle className="text-zinc-100 text-base flex items-center gap-2">
            <Activity className="h-4 w-4 text-emerald-400 animate-pulse" />
            Today's Team Activity
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {todayShoots.length === 0 ? (
            <p className="text-zinc-500 text-sm p-6 text-center">No shoots scheduled for today.</p>
          ) : (
            <div className="divide-y divide-gray-800">
              {todayShoots.map(shoot => {
                const latestPhase = getLatestPhase(shoot.phase_status);
                const isComplete = !!shoot.phase_status?.shoot_complete;
                const PhaseIcon = latestPhase?.icon || Clock;

                return (
                  <div key={shoot.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <span className="font-medium text-zinc-100 text-sm">{shoot.title}</span>
                        {shoot.location && (
                          <span className="text-xs text-zinc-500 ml-2 flex items-center gap-1 inline-flex">
                            <MapPin className="h-3 w-3" />{shoot.location}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {shoot.game_time && <span className="text-xs font-mono text-zinc-500">{shoot.game_time}</span>}
                        {latestPhase ? (
                          <Badge className={`text-xs gap-1 border-0 ${isComplete ? 'bg-green-500/20 text-emerald-400' : 'bg-teal-600/20 text-teal-400'}`}>
                            <PhaseIcon className="h-3 w-3" />
                            {latestPhase.label}
                          </Badge>
                        ) : (
                          <Badge className="text-xs bg-zinc-700/50 text-zinc-500 border-0">Not started</Badge>
                        )}
                      </div>
                    </div>

                    {/* Phase timeline */}
                    <div className="flex items-center gap-1 mb-2">
                      {PHASES.map((phase, i) => {
                        const done = !!shoot.phase_status?.[phase.key];
                        return (
                          <React.Fragment key={phase.key}>
                            <div
                              title={phase.label}
                              className={`h-1.5 w-1.5 rounded-full flex-shrink-0 ${done ? 'bg-green-400' : 'bg-zinc-700'}`}
                            />
                            {i < PHASES.length - 1 && <div className={`h-px flex-1 ${done ? 'bg-green-800' : 'bg-zinc-700'}`} />}
                          </React.Fragment>
                        );
                      })}
                    </div>

                    {/* Operators */}
                    <div className="flex flex-wrap gap-1.5">
                      {(shoot.assigned_operators || []).map(email => {
                        const u = allUsers.find(u2 => u2.email === email);
                        const isRemote = !u || u.role !== 'admin';
                        return (
                          <span key={email} className={`text-xs px-2 py-0.5 rounded-full border ${
                            isRemote ? 'bg-teal-950/40 border-teal-800 text-teal-400' : 'bg-zinc-800 border-zinc-800 text-zinc-400'
                          }`}>
                            {getDisplayName(u, email)}
                            {!isRemote && ' (admin)'}
                          </span>
                        );
                      })}
                      {shoot.standby_admin && (
                        <span className="text-xs px-2 py-0.5 rounded-full border bg-yellow-950/40 border-yellow-800/50 text-amber-400">
                          {getDisplayName(allUsers.find(u => u.email === shoot.standby_admin), shoot.standby_admin)} (standby)
                        </span>
                      )}
                      {(shoot.assigned_operators || []).length === 0 && !shoot.standby_admin && (
                        <span className="text-xs text-gray-600 italic">No operators assigned</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Upcoming assignments */}
      {upcomingShoots.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="border-b border-zinc-800 pb-3">
            <CardTitle className="text-zinc-100 text-base flex items-center gap-2">
              <Calendar className="h-4 w-4 text-teal-400" />
              Upcoming Assignments
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-gray-800">
              {upcomingShoots.map(shoot => (
                <div key={shoot.id} className="px-4 py-3 flex items-center justify-between">
                  <div>
                    <span className="text-sm font-medium text-zinc-100">{shoot.title}</span>
                    <span className="text-xs text-zinc-500 ml-2">{format(new Date(shoot.date), 'EEE MMM d')}</span>
                    {shoot.game_time && <span className="text-xs font-mono text-gray-600 ml-1">{shoot.game_time}</span>}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {(shoot.assigned_operators || []).map(email => {
                      const u = allUsers.find(u2 => u2.email === email);
                      return (
                        <span key={email} className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded-full">
                          {getDisplayName(u, email)}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}