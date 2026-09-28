import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { CheckSquare } from 'lucide-react';
import { matchRig } from '@/components/utils/rigUtils';
import {
  assignmentProgress,
  buildManualRigCheck,
  isRigCheckAssignee,
  itemsFromDefaultChecks,
  mergeChecklistFromRig,
  upcomingShootsForTesting,
} from '@/utils/rigChecks';
import { getDisplayName } from '@/components/utils/nameUtils';
import RigCheckTile from '@/components/rigs/RigCheckTile';
import DashboardSection from '@/components/dashboard/DashboardSection';

const PAGE_SIZE = 4;

function resolveRig(row, { shoots = [], rigSettings = [] } = {}) {
  if (row?.rig_setting_id) {
    const byId = rigSettings.find((rig) => rig.id === row.rig_setting_id);
    if (byId) return byId;
  }
  const shoot = shoots.find((item) => item.id === row?.shoot_id);
  if (shoot) return matchRig(shoot, rigSettings);
  return matchRig({ title: row?.shoot_title, client: row?.team }, rigSettings);
}

export default function AssignedRigChecksPanel({
  userEmail,
  alwaysShow = false,
  showAll = false,
}) {
  const queryClient = useQueryClient();
  const [savingId, setSavingId] = useState('');
  const [expandedId, setExpandedId] = useState('');
  const [page, setPage] = useState(0);
  const hydratedRef = useRef(new Set());
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const { data: assignments = [] } = useQuery({
    queryKey: ['rigCheckAssignments'],
    queryFn: () => base44.entities.RigCheckAssignment.list('-created_date', 300),
    enabled: !!userEmail,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!showAll,
  });

  const { data: shoots = [] } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list('-date', 500),
    enabled: !!userEmail,
  });

  const { data: rigSettings = [] } = useQuery({
    queryKey: ['rigSettings'],
    queryFn: () => base44.entities.RigSetting.list(),
    enabled: !!userEmail,
  });

  const persist = async (row, patch) => {
    if (!row?.id || String(row.id).startsWith('preview:')) return null;
    setSavingId(row.id);
    queryClient.setQueryData(['rigCheckAssignments'], (old = []) =>
      old.map((item) => (item.id === row.id ? { ...item, ...patch } : item))
    );
    try {
      return await base44.entities.RigCheckAssignment.update(row.id, patch);
    } catch {
      queryClient.invalidateQueries({ queryKey: ['rigCheckAssignments'] });
      return null;
    } finally {
      setSavingId('');
    }
  };

  const rows = useMemo(() => {
    const live = assignments
      .filter((row) => {
        if (row.status === 'cancelled') return false;
        if (showAll) return true;
        return isRigCheckAssignee(row, userEmail);
      })
      .map((row) => mergeChecklistFromRig(row, resolveRig(row, { shoots, rigSettings })));

    const taken = new Set(assignments.filter((row) => row.status !== 'cancelled').map((row) => row.shoot_id).filter(Boolean));
    const previews = [];
    if (alwaysShow || showAll) {
      upcomingShootsForTesting(shoots, todayStr).forEach((shoot) => {
        if (taken.has(shoot.id)) return;
        const rig = matchRig(shoot, rigSettings);
        const items = itemsFromDefaultChecks(rig);
        if (!rig || !items.length) return;
        previews.push({
          id: `preview:${shoot.id}`,
          preview: true,
          team: rig.team,
          shoot_id: shoot.id,
          shoot_title: shoot.title || shoot.client || rig.team,
          shoot_date: shoot.date,
          due_date: shoot.date,
          items,
          notes: '',
          status: 'pending',
          rig_setting_id: rig.id,
          assignee_email: '',
        });
      });
      const covered = new Set([
        ...live.map((row) => row.rig_setting_id || row.team),
        ...previews.map((row) => row.rig_setting_id || row.team),
      ]);
      rigSettings.forEach((rig) => {
        const items = itemsFromDefaultChecks(rig);
        if (!items.length) return;
        if (covered.has(rig.id) || covered.has(rig.team)) return;
        previews.push({
          id: `rig:${rig.id}`,
          preview: true,
          team: rig.team,
          shoot_id: '',
          shoot_title: 'Default checklist',
          shoot_date: '',
          due_date: '',
          items,
          notes: '',
          status: 'pending',
          rig_setting_id: rig.id,
          assignee_email: '',
        });
      });
    }

    return [...live, ...previews].sort((a, b) => {
      const aOpen = a.status === 'completed' ? 1 : 0;
      const bOpen = b.status === 'completed' ? 1 : 0;
      if (aOpen !== bOpen) return aOpen - bOpen;
      return String(a.due_date || a.shoot_date || '').localeCompare(String(b.due_date || b.shoot_date || ''));
    });
  }, [assignments, userEmail, showAll, alwaysShow, shoots, rigSettings, todayStr]);

  useEffect(() => {
    assignments.forEach((row) => {
      if (row.status === 'completed' || row.status === 'cancelled') return;
      const rig = resolveRig(row, { shoots, rigSettings });
      const defaults = itemsFromDefaultChecks(rig);
      if (!defaults.length) return;
      const merged = mergeChecklistFromRig(row, rig);
      const key = `${row.id}:${defaults.map((item) => item.label).join('|')}`;
      if (hydratedRef.current.has(key)) return;
      if (JSON.stringify(merged.items) === JSON.stringify(row.items || [])) return;
      hydratedRef.current.add(key);
      persist(row, {
        items: merged.items,
        team: merged.team,
        rig_setting_id: merged.rig_setting_id,
      });
    });
  }, [assignments, shoots, rigSettings]);

  const materialize = async (row) => {
    if (!row?.preview) return row;
    if (!row.shoot_id) return row;
    const shoot = shoots.find((item) => item.id === row.shoot_id);
    const rig = resolveRig(row, { shoots, rigSettings });
    if (!shoot || !rig) return row;
    setSavingId(row.id);
    try {
      const created = await base44.entities.RigCheckAssignment.create(
        buildManualRigCheck({
          rig,
          assigneeEmail: userEmail,
          assignedBy: userEmail,
          shoot,
          dueDate: shoot.date,
        })
      );
      await queryClient.invalidateQueries({ queryKey: ['rigCheckAssignments'] });
      return created;
    } catch {
      return row;
    } finally {
      setSavingId('');
    }
  };

  const toggleItem = async (row, index) => {
    const live = await materialize(row);
    const items = (live.items || row.items || []).map((item, i) => (
      i === index ? { ...item, checked: !item.checked, checked_at: !item.checked ? new Date().toISOString() : null } : item
    ));
    const { complete } = assignmentProgress({ ...live, items });
    await persist(live, {
      items,
      status: complete ? 'completed' : 'pending',
      completed_at: complete ? new Date().toISOString() : null,
    });
  };

  if (!userEmail || (!alwaysShow && rows.length === 0)) return null;

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visible = rows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <DashboardSection
      title="Rig Check Coverage"
      icon={CheckSquare}
      extra={rows.length > 0 ? <span className="text-xs text-slate-500">Showing max 4</span> : null}
    >
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">
          No upcoming team checklist yet. Add default checks on Rig Settings for a team that has a shoot.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
            {visible.map((row) => (
              <RigCheckTile
                key={row.id}
                row={row}
                assigneeName={row.preview
                  ? 'From Rig Settings'
                  : (showAll ? getDisplayName(users.find((u) => u.email === row.assignee_email), row.assignee_email) : '')}
                todayStr={todayStr}
                expanded={expandedId === row.id}
                onToggleExpand={() => setExpandedId((id) => (id === row.id ? '' : row.id))}
                editable={Boolean((row.preview && row.shoot_id) || isRigCheckAssignee(row, userEmail))}
                saving={savingId === row.id}
                onToggleItem={toggleItem}
                onNotesBlur={async (item, notes) => {
                  const live = await materialize(item);
                  persist(live, { notes });
                }}
              />
            ))}
          </div>
          {rows.length > PAGE_SIZE && (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={safePage === 0}
                className="rounded-md border border-slate-800 px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-30"
              >
                Previous
              </button>
              <span className="text-[10px] font-bold text-gray-600">
                SHOWING {safePage * PAGE_SIZE + 1}-{Math.min((safePage + 1) * PAGE_SIZE, rows.length)} OF {rows.length}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={safePage >= totalPages - 1}
                className="rounded-md border border-blue-800/60 bg-blue-950/40 px-2.5 py-1 text-xs font-semibold text-blue-400 hover:bg-blue-950/40 disabled:opacity-30"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </DashboardSection>
  );
}
