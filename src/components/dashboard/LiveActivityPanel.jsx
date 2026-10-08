import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Zap, Camera, AlertTriangle, Volume2, Clock, Flag, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';

const PHASES = [
  { key: 'setup_complete', label: 'Setup', icon: Zap, color: 'text-orange-400' },
  { key: 'pre_shoot_started', label: 'Pre-Shoot', icon: Camera, color: 'text-orange-400' },
  { key: 'attention_started', label: 'Attention', icon: AlertTriangle, color: 'text-amber-400' },
  { key: 'sound_started', label: 'Sound', icon: Volume2, color: 'text-emerald-400' },
  { key: 'shoot_complete', label: 'Complete', icon: CheckCircle, color: 'text-emerald-400' },
];

function getLatestPhase(phaseStatus = {}) {
  for (let i = PHASES.length - 1; i >= 0; i--) {
    if (phaseStatus[PHASES[i].key]) return PHASES[i];
  }
  return null;
}

export default function LiveActivityPanel({ shoots = [], allUsers = [] }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayShoots = shoots.filter(s =>
    s.date === todayStr &&
    s.status !== 'cancelled' &&
    s.assigned_operators?.length > 0
  );

  if (todayShoots.length === 0) return null;

  return (
    <Card className="bg-slate-900 border-slate-800 mt-6">
      <CardHeader className="border-b border-slate-800 pb-3">
        <CardTitle className="text-slate-100 text-base flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-400 animate-pulse" />
          Live Activity — Today's Shoots
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-3">
        {todayShoots.map(shoot => {
          const latestPhase = getLatestPhase(shoot.phase_status);
          const isComplete = !!shoot.phase_status?.shoot_complete;
          const PhaseIcon = latestPhase?.icon || Clock;

          return (
            <div key={shoot.id} className="bg-slate-800/40 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-slate-100 truncate">{shoot.title}</span>
                {shoot.game_time && (
                  <span className="text-xs font-mono text-slate-500 ml-2 flex-shrink-0">{shoot.game_time}</span>
                )}
              </div>

              {/* Phase indicator */}
              <div className="flex items-center gap-2 mb-2">
                {latestPhase ? (
                  <Badge className={`text-xs gap-1 border-0 ${isComplete ? 'bg-green-500/20 text-emerald-400' : 'bg-blue-600/20 text-blue-400'}`}>
                    <PhaseIcon className="h-3 w-3" />
                    {latestPhase.label}
                    {isComplete ? ' ✓' : ''}
                  </Badge>
                ) : (
                  <Badge className="text-xs bg-slate-700/50 text-slate-500 border-0">
                    Waiting for start
                  </Badge>
                )}
              </div>

              {/* Phase timeline dots */}
              <div className="flex items-center gap-1 mb-2">
                {PHASES.map((phase, i) => {
                  const done = !!shoot.phase_status?.[phase.key];
                  return (
                    <React.Fragment key={phase.key}>
                      <div className={`h-2 w-2 rounded-full flex-shrink-0 ${done ? 'bg-green-400' : 'bg-slate-700'}`} title={phase.label} />
                      {i < PHASES.length - 1 && <div className={`h-px flex-1 ${done ? 'bg-green-800' : 'bg-slate-700'}`} />}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Assigned operators */}
              <div className="flex flex-wrap gap-1.5">
                {shoot.assigned_operators.map(email => {
                  const u = allUsers.find(u2 => u2.email === email);
                  const isRemote = !u || u.role !== 'admin';
                  return (
                    <span key={email} className={`text-xs px-2 py-0.5 rounded-full border ${isRemote ? 'bg-blue-950/40 border-blue-800 text-blue-400' : 'bg-slate-800 border-slate-800 text-slate-400'}`}>
                      {u?.full_name?.split(' ')[0] || email.split('@')[0]}
                      {!isRemote && ' (admin)'}
                    </span>
                  );
                })}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}