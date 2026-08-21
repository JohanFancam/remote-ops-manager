import React, { useEffect } from 'react';
import { Edit2, Copy, Trash2, FlaskConical, UserCheck, UserX, ExternalLink, UserPlus } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';

export default function CalendarContextMenu({
  shoot, isAdmin, isStandby, userEmail,
  onEdit, onDuplicate, onDelete, onAssignRigTest, onAssignOperators,
  onAssignSelf, onUnassignSelf, onViewDetails,
  onClose
}) {

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const isAssigned = shoot?.assigned_operators?.includes(userEmail);
  const isPending = shoot?.pending_operators?.includes(userEmail);

  const items = [
    // View details (everyone)
    { label: 'More Details', icon: ExternalLink, action: () => { onViewDetails(shoot); onClose(); }, color: 'text-teal-700' },

    // Self-assign/unassign (available to everyone)
    isAssigned || isPending
      ? { label: isPending ? 'Cancel My Pending' : 'Unassign Me', icon: UserX, action: () => { onUnassignSelf(shoot); onClose(); }, color: 'text-amber-700' }
      : { label: 'Assign Me to Shoot', icon: UserCheck, action: () => { onAssignSelf(shoot); onClose(); }, color: 'text-emerald-700' },

    // Admin-only actions
    ...(isAdmin ? [
      { label: 'Edit Shoot', icon: Edit2, action: () => { onEdit(shoot); onClose(); }, color: 'text-zinc-900', divider: true },
      { label: 'Duplicate Shoot', icon: Copy, action: () => { onDuplicate(shoot); onClose(); }, color: 'text-zinc-900' },
      { label: 'Assign Operators', icon: UserPlus, action: () => { onAssignOperators(shoot); onClose(); }, color: 'text-purple-400' },
      { label: 'Assign Rig Test', icon: FlaskConical, action: () => { onAssignRigTest(shoot); onClose(); }, color: 'text-teal-400' },
      { label: 'Delete Shoot', icon: Trash2, action: () => { onDelete(shoot.id); onClose(); }, color: 'text-red-600' },
    ] : []),

    // Standby-only actions (non-admin standby users)
    ...(isStandby && !isAdmin ? [
      { label: 'Assign Rig Test', icon: FlaskConical, action: () => { onAssignRigTest(shoot); onClose(); }, color: 'text-teal-400', divider: true },
      { label: 'Assign Operators', icon: UserPlus, action: () => { onAssignOperators(shoot); onClose(); }, color: 'text-purple-400' },
    ] : []),
  ];

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full bg-white border-l border-zinc-200 p-0 [&_button[type='button']]:text-zinc-900 transition-all duration-300">
        <SheetHeader className="px-4 py-3 border-b border-zinc-200">
          <SheetTitle className="text-base text-zinc-900 truncate">{shoot.title}</SheetTitle>
          {shoot.date && <p className="text-[10px] text-zinc-400 mt-1">{shoot.date}{shoot.game_time ? ` · ${shoot.game_time}` : ''}</p>}
        </SheetHeader>

        <div className="px-4 py-3 space-y-2">
          {items.map(({ label, icon: Icon, action, color, divider }) => (
            <React.Fragment key={label}>
              {divider && <div className="border-t border-zinc-200 my-1" />}
              <button
                onClick={action}
                className={`flex items-center gap-2.5 w-full px-3 py-3 text-sm ${color} hover:bg-zinc-100 rounded-lg transition-colors`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {label}
              </button>
            </React.Fragment>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}