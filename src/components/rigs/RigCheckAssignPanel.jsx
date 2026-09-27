import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { UserPlus, CheckSquare } from 'lucide-react';
import { getDisplayName } from '@/components/utils/nameUtils';
import { format } from 'date-fns';
import {
  buildManualRigCheck,
  eligibleRigCheckUsers,
  upcomingShootsForRig,
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
  const [rigId, setRigId] = useState('');
  const [assignee, setAssignee] = useState(currentEmail || '');
  const [shootId, setShootId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const testers = useMemo(() => eligibleRigCheckUsers(users), [users]);
  const selectedRig = rigSettings.find((r) => r.id === rigId) || null;
  const linkedShoots = useMemo(
    () => upcomingShootsForRig(shoots, selectedRig, todayStr),
    [shoots, selectedRig, todayStr]
  );

  const { data: assignments = [] } = useQuery({
    queryKey: ['rigCheckAssignments'],
    queryFn: () => base44.entities.RigCheckAssignment.list('-created_date', 300),
  });

  const openForRig = assignments.filter((a) => (
    a.rig_setting_id === rigId && a.status !== 'completed' && a.status !== 'cancelled'
  ));

  const handleAssign = async () => {
    if (!selectedRig || !assignee) return;
    setBusy(true);
    setMessage('');
    try {
      const shoot = linkedShoots.find((s) => s.id === shootId) || null;
      await base44.entities.RigCheckAssignment.create(
        buildManualRigCheck({
          rig: selectedRig,
          assigneeEmail: assignee,
          assignedBy: currentEmail,
          shoot,
        })
      );
      await queryClient.invalidateQueries({ queryKey: ['rigCheckAssignments'] });
      setMessage(`Assigned ${selectedRig.team} checks to ${getDisplayName(testers.find((u) => u.email === assignee), assignee)}.`);
      setShootId('');
    } catch (err) {
      setMessage(err.message || 'Could not assign rig check');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 mb-6">
      <div className="flex items-center gap-2 mb-3">
        <UserPlus className="h-4 w-4 text-orange-400" />
        <div>
          <h2 className="text-sm font-semibold text-slate-100">Assign Rig Testing</h2>
          <p className="text-xs text-slate-500">
            Send this team’s default checks to an admin, operator, or standby. They tick them off on their dashboard.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <select
          value={rigId}
          onChange={(e) => { setRigId(e.target.value); setShootId(''); setMessage(''); }}
          className="bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-md px-2 py-2"
        >
          <option value="">Select rig / team</option>
          {rigSettings.map((rig) => (
            <option key={rig.id} value={rig.id}>{rig.team}</option>
          ))}
        </select>
        <select
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-md px-2 py-2"
        >
          <option value="">Assign to</option>
          {testers.map((user) => (
            <option key={user.id || user.email} value={user.email}>
              {getDisplayName(user, user.email)}{user.email === currentEmail ? ' (you)' : ''} · {user.role}
            </option>
          ))}
        </select>
        <select
          value={shootId}
          onChange={(e) => setShootId(e.target.value)}
          disabled={!selectedRig}
          className="bg-slate-800 border border-slate-700 text-slate-100 text-sm rounded-md px-2 py-2 disabled:opacity-50"
        >
          <option value="">No linked shoot</option>
          {linkedShoots.map((shoot) => (
            <option key={shoot.id} value={shoot.id}>
              {shoot.date} · {shortenTitle(shoot.title) || shoot.client}
            </option>
          ))}
        </select>
        <Button
          onClick={handleAssign}
          disabled={!selectedRig || !assignee || busy}
          className="bg-orange-600 hover:bg-orange-500"
        >
          <CheckSquare className="h-4 w-4 mr-1.5" />
          {busy ? 'Assigning…' : 'Assign checks'}
        </Button>
      </div>

      {selectedRig && (
        <p className="text-xs text-slate-500 mt-2">
          {(selectedRig.default_checks || []).filter(Boolean).length
            ? `Will copy ${(selectedRig.default_checks || []).filter(Boolean).length} default check${(selectedRig.default_checks || []).filter(Boolean).length === 1 ? '' : 's'}.`
            : 'This team has no default checks yet — a single “Rig check complete” item will be used until you add some.'}
        </p>
      )}
      {message && <p className="text-xs text-emerald-400 mt-2">{message}</p>}

      {rigId && openForRig.length > 0 && (
        <div className="mt-3 space-y-1">
          {openForRig.map((row) => (
            <p key={row.id} className="text-xs text-slate-400">
              Open: {getDisplayName(testers.find((u) => u.email === row.assignee_email), row.assignee_email)}
              {row.shoot_title ? ` · ${shortenTitle(row.shoot_title)}` : ''}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
