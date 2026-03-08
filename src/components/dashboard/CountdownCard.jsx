import React, { useState, useEffect } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { getGameDateTime, getSchedule } from '../../lib/scheduleUtils';

const statusColors = {
  upcoming: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  confirmed: 'bg-green-500/20 text-green-400 border-green-500/30',
  in_progress: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  completed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

function ScheduleRow({ label, time, icon, highlight }) {
  return (
    <div className={`flex items-center justify-between py-1 ${highlight ? 'text-blue-400 font-semibold' : 'text-gray-400'}`}>
      <span className="flex items-center gap-1.5">
        <span>{icon}</span>
        <span className="text-xs">{label}</span>
      </span>
      <span className={`font-mono text-xs ${highlight ? 'text-blue-300 text-sm' : ''}`}>{time}</span>
    </div>
  );
}

export default function CountdownCard({ shoot }) {
  const [countdown, setCountdown] = useState('');
  const [isPast, setIsPast] = useState(false);

  useEffect(() => {
    const gameDate = getGameDateTime(shoot);
    if (!gameDate) { setCountdown('—'); return; }

    const update = () => {
      const diff = gameDate - new Date();
      if (diff <= 0) {
        setCountdown('🔴 LIVE / PAST');
        setIsPast(true);
        return;
      }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setCountdown(`${days > 0 ? `${days}d ` : ''}${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [shoot]);

  const schedule = getSchedule(shoot);

  return (
    <Card className="bg-gray-900 border-gray-800 h-full">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <p className="font-bold text-white truncate">{shoot.title}</p>
            {shoot.client && <p className="text-sm text-gray-400 truncate">{shoot.client}</p>}
          </div>
          <Badge className={`text-xs border ml-2 flex-shrink-0 ${statusColors[shoot.status] || statusColors.upcoming}`}>
            {shoot.status}
          </Badge>
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-500 mb-4">
          {shoot.location && (
            <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{shoot.location}</span>
          )}
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {format(new Date(shoot.date), 'EEE, MMM d yyyy')}
          </span>
        </div>

        {/* Countdown */}
        <div className={`text-center py-3 px-2 rounded-xl mb-4 ${isPast ? 'bg-red-950/40 border border-red-800' : 'bg-blue-950/40 border border-blue-800'}`}>
          <div className={`font-mono font-bold text-2xl tracking-wider ${isPast ? 'text-red-400' : 'text-blue-300'}`}>
            {countdown}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">until game time</div>
        </div>

        {/* Schedule Breakdown */}
        {schedule && (
          <div className="border-t border-gray-800 pt-3">
            <p className="text-xs text-gray-600 uppercase tracking-wider mb-2">Schedule</p>
            <ScheduleRow label="Setup" time={schedule.setup} icon="🔧" />
            <ScheduleRow label="Pre-Shoot" time={schedule.pre_shoot} icon="📸" />
            <ScheduleRow label="Attention" time={schedule.attention} icon="⚠️" />
            <ScheduleRow label="Sound Check" time={schedule.sound} icon="🔊" />
            <ScheduleRow label="Game Time" time={schedule.game} icon="🏟️" highlight />
          </div>
        )}

        {shoot.assigned_operators?.length > 0 && (
          <div className="border-t border-gray-800 pt-3 mt-2">
            <p className="text-xs text-gray-600 mb-1.5">Operators ({shoot.assigned_operators.length})</p>
            <div className="flex flex-wrap gap-1">
              {shoot.assigned_operators.map(e => (
                <span key={e} className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full truncate max-w-[140px]">{e}</span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}