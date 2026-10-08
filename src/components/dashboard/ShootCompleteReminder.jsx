import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ShootCompleteModal from '../shoots/ShootCompleteModal';
import { matchRig, shootCompleteReminderDue } from '../utils/rigUtils';
import { shortenTitle } from '../utils/scheduleUtils';

const SNOOZE_MS = 10 * 60 * 1000;

function snoozeKey(id) {
  return `rom-complete-snooze-${id}`;
}

function isSnoozed(id) {
  try {
    const until = Number(sessionStorage.getItem(snoozeKey(id)) || 0);
    return until > Date.now();
  } catch {
    return false;
  }
}

function snooze(id) {
  try {
    sessionStorage.setItem(snoozeKey(id), String(Date.now() + SNOOZE_MS));
  } catch {
    // ignore
  }
}

export default function ShootCompleteReminder({ user }) {
  const queryClient = useQueryClient();
  const [now, setNow] = useState(() => new Date());
  const [completing, setCompleting] = useState(null);

  const { data: shoots = [] } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list('-date', 500),
    enabled: !!user?.email,
    staleTime: 60_000,
  });

  const { data: rigSettings = [] } = useQuery({
    queryKey: ['rigSettings'],
    queryFn: () => base44.entities.RigSetting.list(),
    enabled: !!user?.email,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(iv);
  }, []);

  const dueShoots = useMemo(() => {
    const email = String(user?.email || '').toLowerCase().trim();
    if (!email) return [];
    return shoots.filter((shoot) => {
      if (!shoot.assigned_operators?.some((e) => String(e || '').toLowerCase().trim() === email)) {
        return false;
      }
      const rig = matchRig(shoot, rigSettings);
      return !!shootCompleteReminderDue(shoot, rig, now);
    });
  }, [shoots, rigSettings, user?.email, now]);

  const active = dueShoots.find((shoot) => !isSnoozed(shoot.id)) || null;

  useEffect(() => {
    if (dueShoots.length === 0) return undefined;
    const handleUnload = (event) => {
      event.preventDefault();
      event.returnValue = 'You still have a shoot that needs to be marked complete.';
      return event.returnValue;
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, [dueShoots.length]);

  const handleCompleted = async (completed) => {
    const shoot = completing;
    setCompleting(null);
    if (!completed || !shoot) return;
    const phase = { ...(shoot.phase_status || {}), shoot_complete: new Date().toISOString() };
    const patch = (old = []) =>
      old.map((s) => (s.id === shoot.id ? { ...s, status: 'completed', phase_status: phase } : s));
    queryClient.setQueryData(['shoots'], patch);
    queryClient.setQueryData(['shoots-earnings'], (old) => (Array.isArray(old) ? patch(old) : old));
    try {
      await base44.entities.Shoot.update(shoot.id, { status: 'completed', phase_status: phase });
      queryClient.invalidateQueries({ queryKey: ['shoots-earnings'] });
    } catch {
      queryClient.invalidateQueries({ queryKey: ['shoots'] });
      queryClient.invalidateQueries({ queryKey: ['shoots-earnings'] });
    }
  };

  if (!active && !completing) return null;

  const rig = active ? matchRig(active, rigSettings) : null;
  const due = active ? shootCompleteReminderDue(active, rig, now) : null;

  return (
    <>
      {completing && (
        <ShootCompleteModal
          shoot={completing}
          user={user}
          onClose={handleCompleted}
        />
      )}
      {active && !completing && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 px-4"
          style={{
            paddingTop: 'calc(4.5rem + env(safe-area-inset-top))',
            paddingBottom: 'calc(5.5rem + env(safe-area-inset-bottom))',
          }}
        >
          <div className="w-full max-w-md max-h-full overflow-y-auto rounded-2xl border border-amber-700/50 bg-slate-900 p-4 shadow-2xl sm:p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-full bg-amber-500/15 p-2">
                <AlertTriangle className="h-5 w-5 text-amber-300" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Mark shoot complete</p>
                <h2 className="mt-1 text-lg font-semibold text-slate-50">
                  {shortenTitle(active.title) || 'Assigned shoot'} is ending
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Mark this shoot complete before you leave the app.
                  {due?.end ? ` Game is due to finish around ${format(due.end, 'HH:mm')}.` : ''}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-col-reverse gap-2 sm:mt-5 sm:flex-row">
              <Button
                variant="outline"
                className="min-h-11 border-slate-700 text-slate-300 hover:bg-slate-800 sm:flex-1"
                onClick={() => {
                  snooze(active.id);
                  setNow(new Date());
                }}
              >
                Remind me in 10 min
              </Button>
              <Button
                className="min-h-11 flex-1 bg-green-700 hover:bg-green-600"
                onClick={() => setCompleting(active)}
              >
                Mark Shoot Complete
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
