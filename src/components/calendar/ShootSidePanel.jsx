import React, { useState } from 'react';
import { X, Edit2, Copy, Trash2, UserPlus, UserX, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import ShootDetailPanel from './ShootDetailPanel';
import AssignOperatorModal from './AssignOperatorModal';
import { getDisplayName } from '../utils/nameUtils';

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
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  if (!shoot) return null;

  const handleAssignConfirm = async (email) => {
    if (!email) return;
    const current = shoot.assigned_operators || [];
    if (!current.includes(email)) {
      await onUpdate(shoot.id, { assigned_operators: [...current, email] });
    }
  };

  const handleRemoveOperator = async (email) => {
    await onUpdate(shoot.id, { assigned_operators: (shoot.assigned_operators || []).filter(e => e !== email) });
  };

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

        {/* Admin: Operators section */}
        {isAdmin && (
          <div className="px-4 py-3 border-b border-gray-800 flex-shrink-0">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Operators</p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs border-gray-700 text-gray-300 hover:bg-gray-800"
                onClick={() => setShowAssignModal(true)}
              >
                <UserPlus className="h-3 w-3 mr-1" /> Assign
              </Button>
            </div>

            {(shoot.assigned_operators || []).length > 0 ? (
              <div className="space-y-1">
                {shoot.assigned_operators.map(email => (
                  <div key={email} className="flex items-center justify-between bg-gray-800/60 rounded px-2.5 py-1.5">
                    <span className="text-sm text-gray-200 truncate">
                      {getDisplayName(allUsers?.find(u => u.email === email), email)}
                    </span>
                    <button
                      onClick={() => handleRemoveOperator(email)}
                      className="ml-2 flex-shrink-0 text-gray-500 hover:text-red-400 transition-colors"
                      title="Remove"
                    >
                      <UserX className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-600">No operators assigned yet.</p>
            )}

            {/* Pending approvals */}
            {(shoot.pending_operators || []).length > 0 && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-yellow-400 uppercase tracking-wider">⏳ Pending ({shoot.pending_operators.length})</p>
                {shoot.pending_operators.map(email => (
                  <div key={email} className="flex items-center justify-between">
                    <span className="text-sm text-gray-300 truncate">
                      {getDisplayName(allUsers?.find(u => u.email === email), email)}
                    </span>
                    <div className="flex gap-1 ml-2 flex-shrink-0">
                      <Button size="sm" className="h-6 text-xs bg-green-700 hover:bg-green-600 px-2"
                        onClick={() => onUpdate(shoot.id, {
                          pending_operators: (shoot.pending_operators || []).filter(e => e !== email),
                          assigned_operators: [...new Set([...(shoot.assigned_operators || []), email])],
                        })}>
                        ✓
                      </Button>
                      <Button size="sm" variant="ghost" className="h-6 text-xs text-red-400 hover:bg-gray-800 px-2"
                        onClick={() => onUpdate(shoot.id, { pending_operators: (shoot.pending_operators || []).filter(e => e !== email) })}>
                        ✕
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Admin: More Details toggle with edit/delete/duplicate */}
        {isAdmin && (
          <div className="px-4 py-2 border-b border-gray-800 flex-shrink-0">
            <button
              className="w-full flex items-center justify-between text-xs text-gray-400 hover:text-white transition-colors"
              onClick={() => setShowDetails(!showDetails)}
            >
              <span className="uppercase tracking-wider">More Details</span>
              {showDetails ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            {showDetails && (
              <div className="flex gap-1.5 mt-2">
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

      {showAssignModal && (
        <AssignOperatorModal
          shoot={shoot}
          allUsers={allUsers}
          onConfirm={handleAssignConfirm}
          onClose={() => setShowAssignModal(false)}
        />
      )}
    </>
  );
}