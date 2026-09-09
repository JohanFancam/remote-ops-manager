import React, { useEffect } from 'react';
import { Edit2, Copy, Trash2, UserCheck, UserX, ExternalLink, UserPlus } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { shortenTitle } from '@/components/utils/scheduleUtils';

export default function CalendarContextMenu({
  shoot, isAdmin, isStandby, userEmail,
  onEdit, onDuplicate, onDelete, onAssignOperators,
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
    { label: 'More Details', icon: ExternalLink, action: () => { onViewDetails(shoot); onClose(); }, color: 'text-blue-400' },

    isAssigned || isPending
      ? { label: isPending ? 'Cancel My Pending' : 'Unassign Me', icon: UserX, action: () => { onUnassignSelf(shoot); onClose(); }, color: 'text-amber-400' }
      : { label: 'Assign Me to Shoot', icon: UserCheck, action: () => { onAssignSelf(shoot); onClose(); }, color: 'text-emerald-400' },

    ...(isAdmin ? [
      { label: 'Edit Shoot', icon: Edit2, action: () => { onEdit(shoot); onClose(); }, color: 'text-slate-100', divider: true },
      { label: 'Duplicate Shoot', icon: Copy, action: () => { onDuplicate(shoot); onClose(); }, color: 'text-slate-100' },
      { label: 'Assign Operators', icon: UserPlus, action: () => { onAssignOperators(shoot); onClose(); }, color: 'text-purple-400' },
      { label: 'Delete Shoot', icon: Trash2, action: () => { onDelete(shoot.id); onClose(); }, color: 'text-red-400' },
    ] : []),

    ...(isStandby && !isAdmin ? [
      { label: 'Assign Operators', icon: UserPlus, action: () => { onAssignOperators(shoot); onClose(); }, color: 'text-purple-400', divider: true },
    ] : []),
  ];

  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full bg-slate-900 border-l border-slate-800 p-0 [&_button[type='button']]:text-slate-100 transition-all duration-300">
        <SheetHeader className="px-4 py-3 border-b border-slate-800">
          <SheetTitle className="text-base text-slate-100 truncate">{shortenTitle(shoot.title) || 'Untitled shoot'}</SheetTitle>
          {shoot.date && <p className="text-[10px] text-slate-500 mt-1">{shoot.date}{shoot.game_time ? ` · ${shoot.game_time}` : ''}</p>}
        </SheetHeader>

        <div className="px-4 py-3 space-y-2">
          {items.map(({ label, icon: Icon, action, color, divider }) => (
            <React.Fragment key={label}>
              {divider && <div className="border-t border-slate-800 my-1" />}
              <button
                onClick={action}
                className={`flex items-center gap-2.5 w-full px-3 py-3 text-sm ${color} hover:bg-slate-800 rounded-lg transition-colors`}
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
