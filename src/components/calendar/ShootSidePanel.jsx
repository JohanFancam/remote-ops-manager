import React, { useState } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';
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
  const [showDetails, setShowDetails] = useState(false);

  if (!shoot) return null;

  return (
    <>
      {/* Backdrop for mobile */}
      <div className="fixed inset-0 z-40 bg-black/40 md:hidden" onClick={onClose} />

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



        {/* More Details toggle */}
        <div className="px-4 py-2 border-b border-gray-800 flex-shrink-0">
          <button
            className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-white transition-colors"
            onClick={() => setShowDetails(!showDetails)}
          >
            <span className="uppercase tracking-wider">More Details</span>
            {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </div>

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