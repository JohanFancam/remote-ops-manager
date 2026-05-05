import React, { useEffect, useRef } from 'react';
import { Edit2, Copy, Trash2, FlaskConical } from 'lucide-react';

export default function CalendarContextMenu({ x, y, shoot, isAdmin, onEdit, onDuplicate, onDelete, onAssignRigTest, onClose }) {
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

  const menuWidth = 200;
  const menuHeight = isAdmin ? 160 : 40;
  const left = Math.min(x, window.innerWidth - menuWidth - 8);
  const top = Math.min(y, window.innerHeight - menuHeight - 8);

  const items = [
    ...(isAdmin ? [
      { label: 'Edit Shoot', icon: Edit2, action: () => { onEdit(shoot); onClose(); }, color: 'text-white' },
      { label: 'Duplicate Shoot', icon: Copy, action: () => { onDuplicate(shoot); onClose(); }, color: 'text-white' },
      { label: 'Assign Rig Test', icon: FlaskConical, action: () => { onAssignRigTest(shoot); onClose(); }, color: 'text-teal-400' },
      { label: 'Delete Shoot', icon: Trash2, action: () => { onDelete(shoot.id); onClose(); }, color: 'text-red-400' },
    ] : []),
  ];

  if (items.length === 0) return null;

  return (
    <div
      ref={menuRef}
      style={{ position: 'fixed', left, top, zIndex: 9999 }}
      className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl py-1.5 w-52"
    >
      <div className="px-3 py-1.5 border-b border-gray-800 mb-1">
        <p className="text-xs text-gray-500 truncate font-medium">{shoot.title}</p>
        {shoot.date && <p className="text-[10px] text-gray-600">{shoot.date}{shoot.game_time ? ` · ${shoot.game_time}` : ''}</p>}
      </div>
      {items.map(({ label, icon: Icon, action, color }) => (
        <button
          key={label}
          onClick={action}
          className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm ${color} hover:bg-gray-800 transition-colors`}
        >
          <Icon className="h-3.5 w-3.5 flex-shrink-0" />
          {label}
        </button>
      ))}
    </div>
  );
}