import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { CheckSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { matchRig } from '@/components/utils/rigUtils';
import {
  assignmentProgress,
  groupRigChecksByDay,
  isRigCheckAssignee,
  itemsFromDefaultChecks,
  mergeChecklistFromRig,
  RIG_CHECK_DAYS_PER_PAGE,
} from '@/utils/rigChecks';
import RigCheckDayPanel, { RigCheckDayListItem, formatRigCheckDay } from '@/components/rigs/RigCheckDayPanel';
import DashboardSection from '@/components/dashboard/DashboardSection';

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
}) {
  const queryClient = useQueryClient();
  const [savingId, setSavingId] = useState('');
  const [expandedId, setExpandedId] = useState('');
  const [page, setPage] = useState(0);
  const [selectedDay, setSelectedDay] = useState(null);
  const hydratedRef = useRef(new Set());
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const { data: assignments = [] } = useQuery({
    queryKey: ['rigCheckAssignments'],
    queryFn: () => base44.entities.RigCheckAssignment.list('-created_date', 300),
    enabled: !!userEmail,
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
    if (!row?.id) return null;
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

  const mine = useMemo(
    () => assignments.filter((row) => row.status !== 'cancelled' && isRigCheckAssignee(row, userEmail)),
    [assignments, userEmail]
  );

  const rows = useMemo(() => (
    mine.map((row) => mergeChecklistFromRig(row, resolveRig(row, { shoots, rigSettings })))
  ), [mine, shoots, rigSettings]);

  const days = useMemo(() => groupRigChecksByDay(rows, todayStr), [rows, todayStr]);

  useEffect(() => {
    mine.forEach((row) => {
      if (row.status === 'completed') return;
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
  }, [mine, shoots, rigSettings]);

  const toggleItem = async (row, index) => {
    const items = (row.items || []).map((item, i) => (
      i === index ? { ...item, checked: !item.checked, checked_at: !item.checked ? new Date().toISOString() : null } : item
    ));
    const { complete } = assignmentProgress({ ...row, items });
    await persist(row, {
      items,
      status: complete ? 'completed' : 'pending',
      completed_at: complete ? new Date().toISOString() : null,
    });
  };

  const confirmChecked = async (row) => {
    const now = new Date().toISOString();
    const items = (row.items || []).map((item) => ({
      ...item,
      checked: true,
      checked_at: item.checked_at || now,
    }));
    await persist(row, {
      items,
      status: 'completed',
      completed_at: now,
    });
    queryClient.invalidateQueries({ queryKey: ['rigCheckAssignments'] });
  };

  if (!userEmail || (!alwaysShow && rows.length === 0)) return null;

  const totalPages = Math.max(1, Math.ceil(days.length / RIG_CHECK_DAYS_PER_PAGE));
  const safePage = Math.min(page, totalPages - 1);
  const visibleDays = days.slice(
    safePage * RIG_CHECK_DAYS_PER_PAGE,
    safePage * RIG_CHECK_DAYS_PER_PAGE + RIG_CHECK_DAYS_PER_PAGE
  );
  const selectedGroup = days.find((group) => group.day === selectedDay);

  return (
    <DashboardSection
      title="Rig Check Coverage"
      icon={CheckSquare}
      extra={days.length > 0 ? <span className="text-xs text-slate-500">Assigned to you · 4 days at a time</span> : null}
    >
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500 py-6 text-center">
          No rig checks assigned to you.
        </p>
      ) : (
        <>
          {days.length > RIG_CHECK_DAYS_PER_PAGE && (
            <div className="mb-3 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
              <button
                type="button"
                onClick={() => { setPage((p) => Math.max(0, p - 1)); setSelectedDay(null); }}
                disabled={safePage === 0}
                className="inline-flex items-center gap-1 rounded-md border border-slate-800 px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-30"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>
              <span className="text-[10px] font-bold text-gray-600">
                {safePage + 1} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => { setPage((p) => Math.min(totalPages - 1, p + 1)); setSelectedDay(null); }}
                disabled={safePage >= totalPages - 1}
                className="inline-flex items-center gap-1 rounded-md border border-orange-700/60 bg-orange-950/40 px-2.5 py-1 text-xs font-semibold text-orange-400 hover:bg-orange-950/50 disabled:opacity-30"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="space-y-5">
            {visibleDays.map(({ day, rows: dayRows, openCount, doneCount }) => (
              <div key={day || 'unscheduled'}>
                <button
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className="w-full flex items-baseline justify-between gap-2 mb-2 text-left rounded-lg px-1 py-0.5 hover:bg-slate-800/60"
                >
                  <p className="text-sm font-semibold text-slate-100">{formatRigCheckDay(day)}</p>
                  <p className="text-[11px] text-slate-500">
                    {openCount > 0 && <span className="text-orange-300">{openCount} open</span>}
                    {openCount > 0 && doneCount > 0 && <span className="text-slate-600"> · </span>}
                    {doneCount > 0 && <span className="text-emerald-400">{doneCount} done</span>}
                  </p>
                </button>
                <div className="space-y-2">
                  {dayRows.map((row) => (
                    <RigCheckDayListItem
                      key={row.id}
                      row={row}
                      onClick={() => setSelectedDay(day)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {selectedGroup && (
        <RigCheckDayPanel
          day={selectedGroup.day}
          rows={selectedGroup.rows}
          todayStr={todayStr}
          onClose={() => setSelectedDay(null)}
          expandedId={expandedId}
          onToggleExpand={(id) => setExpandedId((current) => (current === id ? '' : id))}
          tileProps={(row) => ({
            editable: isRigCheckAssignee(row, userEmail),
            saving: savingId === row.id,
            onToggleItem: toggleItem,
            onConfirmChecked: confirmChecked,
            onNotesBlur: (item, notes) => persist(item, { notes }),
          })}
        />
      )}
    </DashboardSection>
  );
}
