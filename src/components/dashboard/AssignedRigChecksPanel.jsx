import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { assignmentProgress, isRigCheckAssignee } from '@/utils/rigChecks';
import RigCheckTile from '@/components/rigs/RigCheckTile';

const PAGE_SIZE = 4;

export default function AssignedRigChecksPanel({ userEmail, alwaysShow = false }) {
  const queryClient = useQueryClient();
  const [savingId, setSavingId] = useState('');
  const [expandedId, setExpandedId] = useState('');
  const [page, setPage] = useState(0);
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const { data: assignments = [] } = useQuery({
    queryKey: ['rigCheckAssignments'],
    queryFn: () => base44.entities.RigCheckAssignment.list('-created_date', 300),
    enabled: !!userEmail,
  });

  const mine = useMemo(() => {
    return assignments
      .filter((row) => isRigCheckAssignee(row, userEmail) && row.status !== 'cancelled')
      .sort((a, b) => {
        const aOpen = a.status === 'completed' ? 1 : 0;
        const bOpen = b.status === 'completed' ? 1 : 0;
        if (aOpen !== bOpen) return aOpen - bOpen;
        return String(a.due_date || a.shoot_date || '').localeCompare(String(b.due_date || b.shoot_date || ''));
      });
  }, [assignments, userEmail]);

  const persist = async (row, patch) => {
    setSavingId(row.id);
    queryClient.setQueryData(['rigCheckAssignments'], (old = []) =>
      old.map((item) => (item.id === row.id ? { ...item, ...patch } : item))
    );
    try {
      await base44.entities.RigCheckAssignment.update(row.id, patch);
    } catch {
      queryClient.invalidateQueries({ queryKey: ['rigCheckAssignments'] });
    } finally {
      setSavingId('');
    }
  };

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

  if (!userEmail || (!alwaysShow && mine.length === 0)) return null;

  const totalPages = Math.max(1, Math.ceil(mine.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages - 1);
  const visible = mine.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  return (
    <section className="mb-8">
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <h2 className="rom-section-title">Rig Check Coverage</h2>
          <p className="text-xs text-slate-500 mt-0.5">Expand a tile for the checklist and notes. Four show at a time.</p>
        </div>
        {mine.length > 0 && (
          <p className="hidden text-xs text-slate-500 sm:block">Showing max 4</p>
        )}
      </div>
      <div className="rom-panel p-4">
        {mine.length === 0 ? (
          <p className="text-sm text-slate-500 py-6 text-center">No rig tests assigned to you.</p>
        ) : (
          <>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {visible.map((row) => (
                <RigCheckTile
                  key={row.id}
                  row={row}
                  todayStr={todayStr}
                  expanded={expandedId === row.id}
                  onToggleExpand={() => setExpandedId((id) => (id === row.id ? '' : row.id))}
                  editable
                  saving={savingId === row.id}
                  onToggleItem={toggleItem}
                  onNotesBlur={(item, notes) => persist(item, { notes })}
                />
              ))}
            </div>
            {mine.length > PAGE_SIZE && (
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
                  SHOWING {safePage * PAGE_SIZE + 1}-{Math.min((safePage + 1) * PAGE_SIZE, mine.length)} OF {mine.length}
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
      </div>
    </section>
  );
}
