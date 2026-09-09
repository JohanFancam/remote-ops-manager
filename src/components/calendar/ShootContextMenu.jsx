import React, { useEffect, useRef } from 'react';
import { Edit2, Copy, Trash2 } from 'lucide-react';
import { shortenTitle } from '@/components/utils/scheduleUtils';

export default function ShootContextMenu({ x, y, shoot, onEdit, onDuplicate, onDelete, onClose }) {
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

  // Clamp to viewport
  const menuWidth = 180;
  const menuHeight = 130;
  const left = Math.min(x, window.innerWidth - menuWidth - 8);
  const top = Math.min(y, window.innerHeight - menuHeight - 8);

  const items = [
    { label: 'Edit', icon: Edit2, action: () => { onEdit(shoot); onClose(); }, color: 'text-slate-100' },
    { label: 'Duplicate', icon: Copy, action: () => { onDuplicate(shoot); onClose(); }, color: 'text-slate-100' },
    { label: 'Delete', icon: Trash2, action: () => { onDelete(shoot.id); onClose(); }, color: 'text-red-400' },
  ];

  return (
    <div
      ref={menuRef}
      style={{ position: 'fixed', left, top, zIndex: 9999 }}
      className="bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1.5 w-44"
    >
      <div className="px-3 py-1.5 border-b border-slate-800 mb-1">
        <p className="text-xs text-slate-500 truncate">{shortenTitle(shoot.title) || 'Untitled'}</p>
      </div>
      {items.map(({ label, icon: Icon, action, color }) => (
        <button
          key={label}
          onClick={action}
          className={`flex items-center gap-2.5 w-full px-3 py-2 text-sm ${color} hover:bg-slate-800 transition-colors`}
        >
          <Icon className="h-3.5 w-3.5 flex-shrink-0" />
          {label}
        </button>
      ))}
    </div>
  );
}