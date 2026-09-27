import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { CheckSquare, StickyNote } from 'lucide-react';
import { format } from 'date-fns';
import { assignmentProgress, isRigCheckAssignee } from '@/utils/rigChecks';
import { shortenTitle } from '@/components/utils/scheduleUtils';

export default function AssignedRigChecksPanel({ userEmail }) {
  const queryClient = useQueryClient();
  const [savingId, setSavingId] = useState('');

  const { data: assignments = [] } = useQuery({
    queryKey: ['rigCheckAssignments'],
    queryFn: () => base44.entities.RigCheckAssignment.list('-created_date', 300),
    enabled: !!userEmail,
  });

  const mine = assignments.filter((row) => (
    isRigCheckAssignee(row, userEmail) && row.status !== 'cancelled'
  ));
  const open = mine.filter((row) => row.status !== 'completed');
  const recentDone = mine.filter((row) => row.status === 'completed').slice(0, 4);

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

  if (!userEmail || (open.length === 0 && recentDone.length === 0)) return null;

  return (
    <section className="mb-8">
      <div className="mb-3">
        <h2 className="rom-section-title">Assigned Rig Checks</h2>
        <p className="text-xs text-slate-500 mt-0.5">Tick each item once the test is done. Notes stay on the admin/data graph.</p>
      </div>
      <div className="rom-panel space-y-3 p-4">
        {open.length === 0 && (
          <p className="text-sm text-slate-500">No open rig checks assigned to you.</p>
        )}
        {open.map((row) => {
          const progress = assignmentProgress(row);
          return (
            <div key={row.id} className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <p className="text-sm font-semibold text-slate-100">{row.team || 'Rig check'}</p>
                  <p className="text-xs text-slate-500">
                    {row.shoot_title ? shortenTitle(row.shoot_title) : 'Standalone test'}
                    {row.shoot_date ? ` · ${row.shoot_date}` : ''}
                  </p>
                </div>
                <span className="text-xs text-orange-300">
                  {progress.done}/{progress.total || (row.items || []).length || 0}
                </span>
              </div>
              <div className="space-y-1.5">
                {(row.items || []).map((item, index) => (
                  <label key={`${row.id}-${index}`} className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!item.checked}
                      disabled={savingId === row.id}
                      onChange={() => toggleItem(row, index)}
                      className="mt-0.5 accent-orange-500"
                    />
                    <span className={`text-sm ${item.checked ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
              <div className="mt-3">
                <label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                  <StickyNote className="h-3 w-3" /> Notes
                </label>
                <textarea
                  defaultValue={row.notes || ''}
                  rows={2}
                  placeholder="Anything the next person should know…"
                  onBlur={(e) => {
                    const notes = e.target.value;
                    if (notes !== (row.notes || '')) persist(row, { notes });
                  }}
                  className="w-full bg-slate-800 border border-slate-700 rounded-md px-2.5 py-2 text-sm text-slate-100 placeholder:text-slate-600"
                />
              </div>
            </div>
          );
        })}
        {recentDone.length > 0 && (
          <div className="pt-2 border-t border-slate-800">
            <p className="text-[11px] uppercase tracking-wide text-slate-500 mb-2">Recently completed</p>
            {recentDone.map((row) => (
              <p key={row.id} className="text-xs text-slate-500 flex items-center gap-1.5">
                <CheckSquare className="h-3 w-3 text-emerald-400" />
                {row.team}
                {row.completed_at ? ` · ${format(new Date(row.completed_at), 'd MMM HH:mm')}` : ''}
              </p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
