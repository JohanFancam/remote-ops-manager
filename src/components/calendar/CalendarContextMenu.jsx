import React, { useEffect, useRef } from 'react';
import { Edit2, Copy, Trash2, FlaskConical, UserCheck, UserX, ExternalLink } from 'lucide-react';

export default function CalendarContextMenu({
  x, y, shoot, isAdmin, userEmail,
  onEdit, onDuplicate, onDelete, onAssignRigTest,
  onAssignSelf, onUnassignSelf, onViewDetails,
  onClose
}) {
  const menuRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) onClose();
    };
    const handleKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  const isAssigned = shoot?.assigned_operators?.includes(userEmail);
  const isPending = shoot?.pending_operators?.includes(userEmail);

  const menuWidth = 220;
  const estimatedHeight = isAdmin ? 280 : 160;
  const left = Math.min(x, window.innerWidth - menuWidth - 8);
  const top = Math.min(y, window.innerHeight - estimatedHeight - 8);

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
      { label: 'Assign Rig Test', icon: FlaskConical, action: () => { onAssignRigTest(shoot); onClose(); }, color: 'text-teal-400' },
      { label: 'Delete Shoot', icon: Trash2, action: () => { onDelete(shoot.id); onClose(); }, color: 'text-red-400' },
    ] : []),
  ];

  return (
    <div
      ref={menuRef}
      style={{ position: 'fixed', left, top, zIndex: 9999 }}
      className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl py-1.5 w-56"
    >
      <div className="px-3 py-1.5 border-b border-gray-800 mb-1">
        <p className="text-xs text-gray-500 truncate font-medium">{shoot.title}</p>
        {shoot.date && <p className="text-[10px] text-gray-600">{shoot.date}{shoot.game_time ? ` · ${shoot.game_time}` : ''}</p>}
      </div>
      {items.map(({ label, icon: Icon, action, color, divider }) => (
        <React.Fragment key={label}>
          {divider && <div className="border-t border-gray-800 my-1" />}
          <button
            onClick={action}
            className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm ${color} hover:bg-gray-800 transition-colors`}
          >
            <Icon className="h-3.5 w-3.5 flex-shrink-0" />
            {label}
          </button>
        </React.Fragment>
      ))}
    </div>
  );
}