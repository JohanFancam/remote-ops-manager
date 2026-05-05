import React from 'react';
import { X, Edit2, Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import ShootDetailPanel from './ShootDetailPanel';

export default function ShootSidePanel({
  shoot,
  user,
  isAdmin,
  rigSettings,
  allShoots,
  allUsers,
  standbyAdmins,
  slackMessages,
  onUpdate,
  onEdit,
  onDuplicate,
  onDelete,
  onClose,
}) {
  if (!shoot) return null;

  return (
    <>
      {/* Backdrop for mobile */}
      <div
        className="fixed inset-0 z-40 bg-black/40 md:hidden"
        onClick={onClose}
      />
      <div className="fixed top-0 right-0 h-full z-50 flex flex-col bg-gray-900 border-l border-gray-800 shadow-2xl w-full md:w-[480px] lg:w-[540px]">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-800 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-white truncate">{shoot.title}</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {format(new Date(shoot.date + 'T12:00:00'), 'EEE, MMM d yyyy')}
              {shoot.game_time ? ` · ${shoot.game_time}` : ''}
            </p>
          </div>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-white flex-shrink-0" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Admin actions */}
        {isAdmin && (
          <div className="flex gap-1.5 px-4 py-2.5 border-b border-gray-800 flex-shrink-0">
            <Button size="sm" variant="outline" className="h-7 text-xs border-gray-700 text-gray-300 hover:bg-gray-800" onClick={() => onEdit(shoot)}>
              <Edit2 className="h-3 w-3 mr-1" /> Edit
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs border-gray-700 text-gray-300 hover:bg-gray-800" onClick={() => onDuplicate(shoot)}>
              <Copy className="h-3 w-3 mr-1" /> Duplicate
            </Button>
            <Button size="sm" variant="outline" className="h-7 text-xs border-red-800/60 text-red-400 hover:bg-red-950/30" onClick={() => onDelete(shoot.id)}>
              <Trash2 className="h-3 w-3 mr-1" /> Delete
            </Button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <ShootDetailPanel
            shoot={shoot}
            user={user}
            isAdmin={isAdmin}
            rigSettings={rigSettings}
            allShoots={allShoots}
            allUsers={allUsers}
            standbyAdmins={standbyAdmins}
            slackMessages={slackMessages}
            onUpdate={onUpdate}
          />
        </div>
      </div>
    </>
  );
}