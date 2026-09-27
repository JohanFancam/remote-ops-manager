import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { UserPlus, CheckSquare } from 'lucide-react';
import { getDisplayName } from '@/components/utils/nameUtils';
import { matchRig } from '@/components/utils/rigUtils';
import { format } from 'date-fns';
import {
  buildManualRigCheck,
  eligibleRigCheckUsers,
  upcomingShootsForTesting,
  normalizeDefaultChecks,
} from '@/utils/rigChecks';
import { shortenTitle } from '@/components/utils/scheduleUtils';

export default function RigCheckAssignPanel({
  rigSettings = [],
  users = [],
  shoots = [],
  currentEmail,
}) {
  const queryClient = useQueryClient();
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [shootId, setShootId] = useState('');
  const [assignee, setAssignee] = useState(currentEmail || '');
  const [dueDate, setDueDate] = useState(todayStr);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const testers = useMemo(() => eligibleRigCheckUsers(users), [users]);
  const upcoming = useMemo(() => upcomingShootsForTesting(shoots, todayStr), [shoots, todayStr]);
  const selectedShoot = upcoming.find((s) => s.id === shootId) || null;
  const matchedRig = selectedShoot ? matchRig(selectedShoot, rigSettings) : null;
  const checks = normalizeDefaultChecks(matchedRig);

  const { data: assignments = [] } = useQuery({
    queryKey: ['rigCheckAssignments'],
    queryFn: () => base44.entities.RigCheckAssignment.list('-created_date', 300),
  });

  const openForShoot = assignments.filter((row) => (
    row.shoot_id === shootId && row.status !== 'completed' && row.status !== 'cancelled'
  ));

  const handleShootChange = (id) => {
    setShootId(id);
    setMessage('');
    const shoot = upcoming.find((s) => s.id === id);
    setDueDate(shoot?.date || todayStr);
  };

  const handleAssign = async () => {
    if (!selectedShoot || !assignee || !matchedRig) return;
    setBusy(true);
    setMessage('');
    try {
      await base44.entities.RigCheckAssignment.create(
        buildManualRigCheck({
          rig: matchedRig,
          assigneeEmail: assignee,
          assignedBy: currentEmail,
          shoot: selectedShoot,
          dueDate,
        })
      );
      await queryClient.invalidateQueries({ queryKey: ['rigCheckAssignments'] });
      const name = getDisplayName(testers.find((u) => u.email === assignee), assignee);
      const team = matchedRig?.team || selectedShoot.client || 'this shoot';
      setMessage(`Assigned ${team} rig testing for ${shortenTitle(selectedShoot.title) || selectedShoot.title} to ${name}.`);
    } catch (err) {
      setMessage(err.message || 'Could not assign rig test');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rom-panel p-4 mb-8">
      <div className="flex items-center gap-2 mb-3">
        <UserPlus className="h-4 w-4 text-orange-400" />
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Assign rig testing</h2>
          <p className="text-xs text-slate-500">
            Pick a shoot (Jets, Twins, Bruins vs Rangers). The checklist comes from that team’s rig settings. Only admins and operator/standby can be assigned.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <label className="flex flex-col gap-1 min-w-0">
          <span className="text-[11px] uppercase tracking-wide text-slate-500">Shoot</span>
          <select
            value={shootId}
            onChange={(e) => handleShootChange(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-md px-2 py-2"
          >
            <option value="">Select shoot</option>
            {upcoming.map((shoot) => (
              <option key={shoot.id} value={shoot.id}>
                {shoot.date}{shoot.game_time ? ` ${shoot.game_time}` : ''} · {shortenTitle(shoot.title) || shoot.client || 'Untitled'}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 min-w-0">
          <span className="text-[11px] uppercase tracking-wide text-slate-500">Assign to</span>
          <select
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-md px-2 py-2"
          >
            <option value="">Admin or operator/standby</option>
            {testers.map((user) => (
              <option key={user.id || user.email} value={user.email}>
                {getDisplayName(user, user.email)}{user.email === currentEmail ? ' (you)' : ''} · {user.role === 'standby' ? 'Operator / Standby' : 'Admin'}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 min-w-0">
          <span className="text-[11px] uppercase tracking-wide text-slate-500">Due date</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-md px-2 py-2"
          />
        </label>
        <div className="flex items-end">
          <Button
            onClick={handleAssign}
            disabled={!selectedShoot || !assignee || !matchedRig || busy}
            className="bg-orange-600 hover:bg-orange-500 w-full"
          >
            <CheckSquare className="h-4 w-4 mr-1.5" />
            {busy ? 'Assigning…' : 'Assign rig test'}
          </Button>
        </div>
      </div>

      {selectedShoot && (
        <p className="text-xs text-slate-500 mt-2">
          {matchedRig
            ? `Checklist from ${matchedRig.team}${checks.length ? ` · ${checks.length} default check${checks.length === 1 ? '' : 's'}` : ' · no default checks yet, a single “Rig check complete” item will be used'}.`
            : 'No matching rig setting for this shoot — add one under Rig Settings so the default list can be copied.'}
          {dueDate ? ` Due ${dueDate}.` : ''}
        </p>
      )}
      {message && <p className="text-xs text-emerald-400 mt-2">{message}</p>}

      {shootId && openForShoot.length > 0 && (
        <div className="mt-3 space-y-1">
          {openForShoot.map((row) => (
            <p key={row.id} className="text-xs text-slate-400">
              Already open: {getDisplayName(testers.find((u) => u.email === row.assignee_email), row.assignee_email)}
              {row.due_date ? ` · due ${row.due_date}` : ''}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
