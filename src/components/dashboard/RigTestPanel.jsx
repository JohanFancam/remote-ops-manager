import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ChevronDown, ChevronUp, Plus, CheckCircle2, Circle, Clock, Trash2, X, Check
} from 'lucide-react';

const FALLBACK_CHECKLIST = [
  'Power on all rigs and confirm boot',
  'Check network / remote connectivity',
  'Verify camera feeds (HD + Wide)',
  'Test audio / sound recording',
  'Confirm rig type settings match team profile',
  'Review storage / SD cards',
  'Check battery levels',
];

function RigTestCard({ test, user, isAdmin, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [comment, setComment] = useState(test.comments || '');
  const [savingComment, setSavingComment] = useState(false);

  const checklist = test.checklist || FALLBACK_CHECKLIST.map(item => ({ item, checked: false }));
  const checkedCount = checklist.filter(c => c.checked).length;
  const allDone = checkedCount === checklist.length;
  const isAssignedToMe = test.assigned_to === user?.email;
  const canEdit = isAdmin || isAssignedToMe;

  const handleToggleItem = async (idx) => {
    if (!canEdit) return;
    const updated = checklist.map((c, i) => i === idx ? { ...c, checked: !c.checked } : c);
    await onUpdate(test.id, { checklist: updated });
  };

  const handleSaveComment = async () => {
    setSavingComment(true);
    await onUpdate(test.id, { comments: comment });
    setSavingComment(false);
  };

  const handleMarkComplete = async () => {
    if (!canEdit) return;
    const now = new Date().toISOString();
    await onUpdate(test.id, {
      status: 'completed',
      completed_at: now,
      checklist: checklist.map(c => ({ ...c, checked: true })),
    });
  };

  const handleMarkPending = async () => {
    if (!isAdmin) return;
    await onUpdate(test.id, { status: 'pending', completed_at: '' });
  };

  const statusBadge = {
    pending: <Badge className="bg-yellow-500/15 text-amber-400 border-yellow-500/30 text-xs">Pending</Badge>,
    in_progress: <Badge className="bg-blue-600/15 text-blue-400 border-blue-800 text-xs">In Progress</Badge>,
    completed: <Badge className="bg-green-500/15 text-emerald-400 border-green-500/30 text-xs">Completed</Badge>,
  }[test.status] || null;

  return (
    <div className={`rounded-xl border transition-colors ${test.status === 'completed' ? 'border-green-800/50 bg-emerald-950/40' : 'border-slate-800 bg-slate-900'}`}>
      <button className="w-full flex items-center gap-3 p-4 text-left" onClick={() => setExpanded(!expanded)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-slate-100 text-sm">{test.title}</p>
            {statusBadge}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {format(new Date(test.scheduled_date + 'T12:00:00'), 'EEE, MMM d yyyy')}
            {test.assigned_name ? ` · ${test.assigned_name}` : ''}
            {test.due_date && (
              <span className="ml-2 text-yellow-500">Due: {format(new Date(test.due_date + 'T12:00:00'), 'MMM d')}</span>
            )}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 bg-slate-800 rounded-full h-1.5 max-w-[120px]">
              <div
                className="bg-blue-600 rounded-full h-1.5 transition-all"
                style={{ width: `${(checkedCount / checklist.length) * 100}%` }}
              />
            </div>
            <span className="text-xs text-slate-500">{checkedCount}/{checklist.length}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {isAdmin && (
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(test.id); }}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-gray-600 hover:text-red-400 hover:bg-slate-800 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
          {expanded ? <ChevronUp className="h-4 w-4 text-slate-500" /> : <ChevronDown className="h-4 w-4 text-slate-500" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-800 pt-3 space-y-4">
          {/* Checklist */}
          <div className="space-y-2">
            {checklist.map((item, idx) => (
              <button
                key={idx}
                onClick={() => handleToggleItem(idx)}
                disabled={!canEdit}
                className={`flex items-start gap-2.5 w-full text-left rounded-lg px-3 py-2 transition-colors ${item.checked ? 'bg-emerald-950/40 border border-green-800/40' : 'bg-slate-50 border border-slate-800 hover:bg-slate-800'} ${!canEdit ? 'cursor-default opacity-70' : ''}`}
              >
                {item.checked
                  ? <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                  : <Circle className="h-4 w-4 text-gray-600 flex-shrink-0 mt-0.5" />
                }
                <span className={`text-sm ${item.checked ? 'line-through text-slate-500' : 'text-gray-200'}`}>
                  {item.item}
                </span>
              </button>
            ))}
          </div>

          {/* Comments */}
          <div>
            <label className="text-xs text-slate-400 font-medium mb-1.5 block">Comments / Issues</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              disabled={!canEdit}
              placeholder="Log any issues or notes here..."
              rows={3}
              className="w-full bg-slate-800 border border-slate-800 text-slate-100 text-sm rounded-lg px-3 py-2 resize-none placeholder:text-gray-600 focus:outline-none focus:border-blue-500 disabled:opacity-60"
            />
            {canEdit && (
              <Button
                size="sm"
                className="mt-1.5 h-7 text-xs bg-slate-700 hover:bg-gray-600"
                onClick={handleSaveComment}
                disabled={savingComment}
              >
                {savingComment ? 'Saving...' : 'Save Comment'}
              </Button>
            )}
          </div>

          {/* Actions */}
          {canEdit && (
            <div className="flex gap-2 pt-1">
              {test.status !== 'completed' && (
                <Button
                  size="sm"
                  className="bg-green-700 hover:bg-green-600 text-xs gap-1"
                  onClick={handleMarkComplete}
                >
                  <Check className="h-3.5 w-3.5" /> Mark Complete
                </Button>
              )}
              {test.status === 'completed' && isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-slate-800 text-slate-400 hover:bg-slate-800 text-xs gap-1"
                  onClick={handleMarkPending}
                >
                  <X className="h-3.5 w-3.5" /> Reset to Pending
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RigTestPanel({ user, isAdmin, isStandby, allUsers = [] }) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [newDueDate, setNewDueDate] = useState('');
  const [newAssigned, setNewAssigned] = useState(user?.email || '');

  const { data: rigTests = [] } = useQuery({
    queryKey: ['rigTests'],
    queryFn: () => base44.entities.RigTest.list('-scheduled_date', 200),
  });

  const { data: appSettings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const defaultChecklist = useMemo(() => {
    const val = appSettings.find(s => s.key === 'rig_test_checklist')?.value;
    if (val) { try { return JSON.parse(val); } catch { /* ignore */ } }
    return FALLBACK_CHECKLIST;
  }, [appSettings]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['rigTests'] });

  const myTests = useMemo(() => {
    if (isAdmin) return rigTests;
    return rigTests.filter(t => t.assigned_to === user?.email);
  }, [rigTests, user?.email, isAdmin]);

  const handleAdd = async () => {
    if (!newTitle || !newDate) return;
    const assignedUser = allUsers.find(u => u.email === newAssigned);
    await base44.entities.RigTest.create({
      title: newTitle,
      scheduled_date: newDate,
      due_date: newDueDate || undefined,
      assigned_to: newAssigned,
      assigned_name: assignedUser?.full_name || newAssigned,
      checklist: defaultChecklist.map(item => ({ item, checked: false })),
      status: 'pending',
    });
    setNewTitle('');
    setNewDate(format(new Date(), 'yyyy-MM-dd'));
    setNewDueDate('');
    setShowAdd(false);
    refresh();
  };

  const handleUpdate = async (id, data) => {
    await base44.entities.RigTest.update(id, data);
    refresh();
  };

  const handleDelete = async (id) => {
    await base44.entities.RigTest.delete(id);
    refresh();
  };

  // Assignable admins/standby
  const assignableUsers = allUsers.filter(u => u.role === 'admin' || u.role === 'standby');

  const upcoming = myTests.filter(t => t.status !== 'completed').sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
  const completed = myTests.filter(t => t.status === 'completed').sort((a, b) => b.scheduled_date.localeCompare(a.scheduled_date));

  return (
    <div className="space-y-3">
      {isAdmin && (
        <div className="flex justify-end">
          <Button size="sm" className="bg-blue-600 hover:bg-blue-500 gap-1.5 text-xs" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-3.5 w-3.5" /> Schedule Rig Test
          </Button>
        </div>
      )}

      {showAdd && isAdmin && (
        <div className="bg-slate-800/60 border border-blue-800 rounded-xl p-4 space-y-3">
          <p className="text-sm font-medium text-slate-100">New Rig Test</p>
          <Input placeholder="Title e.g. Weekly Rig Check" value={newTitle} onChange={e => setNewTitle(e.target.value)} className="bg-slate-700 border-slate-700 text-slate-100 placeholder:text-slate-500 h-8 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5">Scheduled Date</label>
              <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="bg-slate-700 border-slate-700 text-slate-100 h-8 text-sm" />
            </div>
            <div>
              <label className="text-[10px] text-slate-500 block mb-0.5">Due Date (optional)</label>
              <Input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} className="bg-slate-700 border-slate-700 text-slate-100 h-8 text-sm" />
            </div>
          </div>
          {assignableUsers.length > 0 && (
            <select
              value={newAssigned}
              onChange={e => setNewAssigned(e.target.value)}
              className="w-full bg-slate-700 border border-slate-700 text-slate-100 rounded-md px-3 py-2 text-sm h-8"
            >
              {assignableUsers.map(u => (
                <option key={u.email} value={u.email}>{u.full_name || u.email}</option>
              ))}
            </select>
          )}
          <div className="flex gap-2">
            <Button size="sm" className="bg-blue-600 hover:bg-blue-500 text-xs" onClick={handleAdd}>Create</Button>
            <Button size="sm" variant="ghost" className="text-slate-400 text-xs" onClick={() => setShowAdd(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {upcoming.length === 0 && completed.length === 0 && (
        <p className="text-sm text-slate-500 text-center py-4">No rig tests scheduled.</p>
      )}

      {upcoming.length > 0 && (
        <div className="space-y-2">
          {upcoming.map(test => (
            <RigTestCard key={test.id} test={test} user={user} isAdmin={isAdmin} onUpdate={handleUpdate} onDelete={handleDelete} />
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1.5 py-1 select-none list-none">
            <ChevronDown className="h-3.5 w-3.5 group-open:rotate-180 transition-transform" />
            {completed.length} completed
          </summary>
          <div className="mt-2 space-y-2">
            {completed.slice(0, 5).map(test => (
              <RigTestCard key={test.id} test={test} user={user} isAdmin={isAdmin} onUpdate={handleUpdate} onDelete={handleDelete} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}