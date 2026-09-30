import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CheckSquare, UserMinus, UserPlus } from 'lucide-react';
import { getDisplayName } from '@/components/utils/nameUtils';
import { matchRig } from '@/components/utils/rigUtils';
import {
  buildManualRigCheck,
  canAssignRigTests,
  eligibleRigCheckUsers,
  isRigCheckAssignee,
  openAssignmentsForShoot,
} from '@/utils/rigChecks';

export default function CalendarRigTestActions({
  shoot,
  user,
  isAdmin = false,
  allUsers = [],
  rigSettings = [],
}) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [assignEmail, setAssignEmail] = useState('');
  const [message, setMessage] = useState('');

  const { data: assignments = [] } = useQuery({
    queryKey: ['rigCheckAssignments'],
    queryFn: () => base44.entities.RigCheckAssignment.list('-created_date', 300),
    enabled: !!shoot?.id,
  });

  const testers = useMemo(() => eligibleRigCheckUsers(allUsers), [allUsers]);
  const open = openAssignmentsForShoot(assignments, shoot?.id);
  const mine = open.find((row) => isRigCheckAssignee(row, user?.email));
  const matchedRig = shoot ? matchRig(shoot, rigSettings) : null;
  const canSelf = canAssignRigTests(user);
  const cancelled = String(shoot?.status || '').toLowerCase() === 'cancelled';

  if (!shoot || (!canSelf && !isAdmin)) return null;

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['rigCheckAssignments'] });

  const assignTo = async (email) => {
    if (!shoot?.id || !email || !matchedRig || cancelled) return;
    const already = open.some((row) => isRigCheckAssignee(row, email));
    if (already) {
      setMessage('Already assigned to that person.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await base44.entities.RigCheckAssignment.create(
        buildManualRigCheck({
          rig: matchedRig,
          assigneeEmail: email,
          assignedBy: user?.email,
          shoot,
          dueDate: shoot.date,
        })
      );
      await refresh();
      setAssignEmail('');
      const name = getDisplayName(testers.find((u) => u.email === email), email);
      setMessage(`Assigned ${matchedRig.team} testing to ${name}.`);
    } catch (err) {
      setMessage(err.message || 'Could not assign rig test');
    } finally {
      setBusy(false);
    }
  };

  const unassignMine = async () => {
    if (!mine?.id) return;
    setBusy(true);
    setMessage('');
    try {
      await base44.entities.RigCheckAssignment.update(mine.id, { status: 'cancelled' });
      await refresh();
      setMessage('Unassigned your rig test.');
    } catch (err) {
      setMessage(err.message || 'Could not unassign');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">Rig test</p>
      {open.length > 0 ? (
        <div className="space-y-1 mb-2">
          {open.map((row) => (
            <p key={row.id} className="text-sm text-slate-200">
              {getDisplayName(testers.find((u) => u.email === row.assignee_email), row.assignee_email)}
              {row.due_date ? ` · due ${row.due_date}` : ''}
              <span className="text-slate-500"> · {row.status === 'completed' ? 'checked' : 'open'}</span>
            </p>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-400 mb-2">Not assigned for testing.</p>
      )}

      {!matchedRig && (
        <p className="text-xs text-amber-300 mb-2">Add a matching team under Rig Settings to copy the default checklist.</p>
      )}

      <div className="flex flex-wrap gap-2">
        {canSelf && !mine && (
          <button
            type="button"
            disabled={busy || !matchedRig || cancelled}
            onClick={() => assignTo(user.email)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-orange-500/40 bg-orange-500 px-3 text-sm font-medium text-slate-950 disabled:opacity-40"
          >
            <UserPlus className="h-3.5 w-3.5" />
            Assign me
          </button>
        )}
        {canSelf && mine && (
          <button
            type="button"
            disabled={busy}
            onClick={unassignMine}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-amber-600/50 bg-amber-950/40 px-3 text-sm font-medium text-amber-200 hover:bg-amber-900/40 disabled:opacity-40"
          >
            <UserMinus className="h-3.5 w-3.5" />
            Unassign me
          </button>
        )}
      </div>

      {isAdmin && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <select
            value={assignEmail}
            onChange={(e) => setAssignEmail(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-md px-2 py-1.5 min-w-[10rem]"
          >
            <option value="">Assign to user…</option>
            {testers.map((tester) => (
              <option key={tester.email} value={tester.email}>
                {getDisplayName(tester, tester.email)}
                {tester.role === 'standby' ? ' · Operator / Standby' : ' · Admin'}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !assignEmail || !matchedRig || cancelled}
            onClick={() => assignTo(assignEmail)}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-slate-600 bg-slate-800/80 px-3 text-sm font-medium text-slate-100 hover:bg-slate-700 disabled:opacity-40"
          >
            <CheckSquare className="h-3.5 w-3.5" />
            Assign
          </button>
        </div>
      )}
      {message && <p className="text-xs text-emerald-400 mt-2">{message}</p>}
    </div>
  );
}
