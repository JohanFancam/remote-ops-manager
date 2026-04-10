import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Clock, ChevronDown, ChevronUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { format, addMonths, subMonths, startOfMonth } from 'date-fns';
import { shortenTitle } from '../utils/scheduleUtils';

function formatDuration(ms) {
  if (!ms || ms < 0) return '—';
  const totalMins = Math.round(ms / 60000);
  const h = Math.floor(totalMins / 60);
  const m = totalMins % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function ShootTimingPanel({ shoots = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const monthStr = format(currentMonth, 'yyyy-MM');

  const timedShoots = useMemo(() => {
    return shoots
      .filter(s =>
        s.date?.startsWith(monthStr) &&
        s.phase_status?.setup_complete &&
        s.phase_status?.shoot_complete
      )
      .map(s => {
        const start = new Date(s.phase_status.setup_complete);
        const end = new Date(s.phase_status.shoot_complete);
        const durationMs = end - start;
        return { ...s, durationMs, start, end };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [shoots, monthStr]);

  const avgMs = timedShoots.length > 0
    ? timedShoots.reduce((sum, s) => sum + s.durationMs, 0) / timedShoots.length
    : 0;

  const maxShoot = timedShoots.length > 0
    ? timedShoots.reduce((max, s) => s.durationMs > max.durationMs ? s : max, timedShoots[0])
    : null;

  return (
    <Card className="bg-gray-900 border-gray-800 mt-6">
      <CardHeader className="border-b border-gray-800 pb-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-white font-semibold text-base hover:text-blue-400 transition-colors"
          >
            <Clock className="h-4 w-4 text-purple-400" />
            Shoot Duration Tracker
            {expanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
            {timedShoots.length > 0 && !expanded && (
              <span className="text-xs bg-purple-600/30 text-purple-400 border border-purple-700/50 px-2 py-0.5 rounded-full ml-1">
                {timedShoots.length} tracked
              </span>
            )}
          </button>
          {expanded && (
            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-white" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-gray-400 w-20 text-center">{format(currentMonth, 'MMM yyyy')}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-white" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-4">
          {timedShoots.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-6">
              No completed shoots with full timing data for {format(currentMonth, 'MMMM yyyy')}.<br />
              <span className="text-xs text-gray-600 mt-1 block">Timing is captured between "Setup Complete" → "Shoot Complete".</span>
            </p>
          ) : (
            <>
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-purple-400">{timedShoots.length}</p>
                  <p className="text-xs text-gray-400">Tracked</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-blue-400">{formatDuration(avgMs)}</p>
                  <p className="text-xs text-gray-400">Avg Duration</p>
                </div>
                <div className="bg-gray-800/50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-yellow-400">{maxShoot ? formatDuration(maxShoot.durationMs) : '—'}</p>
                  <p className="text-xs text-gray-400">Longest</p>
                </div>
              </div>

              {/* Shoot list */}
              <div className="space-y-2">
                {timedShoots.map(s => (
                  <div key={s.id} className="bg-gray-800/40 rounded-lg px-4 py-3 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-white truncate">{shortenTitle(s.title)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {format(new Date(s.date + 'T12:00:00'), 'EEE, MMM d')}
                        {s.game_time && ` · ${s.game_time}`}
                      </p>
                      <p className="text-xs text-gray-600 mt-0.5 font-mono">
                        {format(s.start, 'HH:mm')} → {format(s.end, 'HH:mm')}
                      </p>
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      <p className="text-base font-bold text-purple-300">{formatDuration(s.durationMs)}</p>
                      {s.assigned_operators?.length > 0 && (
                        <p className="text-xs text-gray-500">{s.assigned_operators.length} op{s.assigned_operators.length > 1 ? 's' : ''}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}