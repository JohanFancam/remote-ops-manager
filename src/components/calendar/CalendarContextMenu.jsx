import React, { useEffect, useRef, useState } from 'react';
import { Edit2, Copy, Trash2, FlaskConical, UserCheck, UserX, ExternalLink, UserPlus, X } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';

export default function CalendarContextMenu({
  x, y, shoot, isAdmin, userEmail,
  onEdit, onDuplicate, onDelete, onAssignRigTest, onAssignOperators,
  onAssignSelf, onUnassignSelf, onViewDetails,
  onClose
}) {
  const menuRef = useRef(null);
  const [isMobile] = useState(typeof window !== 'undefined' && window.innerWidth < 768);

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
    { label: 'More Details', icon: ExternalLink, action: () => { onViewDetails(shoot); onClose(); }, color: 'text-blue-400' },

    // Self-assign/unassign (available to everyone)
    isAssigned || isPending
      ? { label: isPending ? 'Cancel My Pending' : 'Unassign Me', icon: UserX, action: () => { onUnassignSelf(shoot); onClose(); }, color: 'text-yellow-400' }
      : { label: 'Assign Me to Shoot', icon: UserCheck, action: () => { onAssignSelf(shoot); onClose(); }, color: 'text-green-400' },

    // Admin-only actions
    ...(isAdmin ? [
      { label: 'Edit Shoot', icon: Edit2, action: () => { onEdit(shoot); onClose(); }, color: 'text-white', divider: true },
      { label: 'Duplicate Shoot', icon: Copy, action: () => { onDuplicate(shoot); onClose(); }, color: 'text-white' },
      { label: 'Assign Operators', icon: UserPlus, action: () => { onAssignOperators(shoot); onClose(); }, color: 'text-purple-400' },
      { label: 'Assign Rig Test', icon: FlaskConical, action: () => { onAssignRigTest(shoot); onClose(); }, color: 'text-teal-400' },
      { label: 'Delete Shoot', icon: Trash2, action: () => { onDelete(shoot.id); onClose(); }, color: 'text-red-400' },
    ] : []),
  ];

  // Mobile: use sheet drawer on the right
  if (isMobile) {
    return (
      <Sheet open={true} onOpenChange={onClose}>
        <SheetContent side="right" className="w-full bg-gray-900 border-l border-gray-800 p-0 [&_button[type='button']]:text-white">

          <div className="px-4 py-3 space-y-2">
            {items.map(({ label, icon: Icon, action, color, divider }) => (
              <React.Fragment key={label}>
                {divider && <div className="border-t border-gray-800 my-1" />}
                <button
                  onClick={action}
                  className={`flex items-center gap-2.5 w-full px-3 py-3 text-sm ${color} hover:bg-gray-800 rounded-lg transition-colors`}
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

  // Desktop: use same sheet drawer
  return (
    <Sheet open={true} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full bg-gray-900 border-l border-gray-800 p-0 [&_button[type='button']]:text-white">
        <SheetHeader className="px-4 py-3 border-b border-gray-800">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <SheetTitle className="text-base text-white truncate">{shoot.title}</SheetTitle>
              {shoot.date && <p className="text-[10px] text-gray-500 mt-1">{shoot.date}{shoot.game_time ? ` · ${shoot.game_time}` : ''}</p>}
            </div>
          </div>
        </SheetHeader>

        <div className="px-4 py-3 space-y-2">
          {items.map(({ label, icon: Icon, action, color, divider }) => (
            <React.Fragment key={label}>
              {divider && <div className="border-t border-gray-800 my-1" />}
              <button
                onClick={action}
                className={`flex items-center gap-2.5 w-full px-3 py-3 text-sm ${color} hover:bg-gray-800 rounded-lg transition-colors`}
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