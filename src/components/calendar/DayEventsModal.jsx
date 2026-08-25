import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import MonthEntry from './MonthEntry';

// Popup that lists ALL shoots for a day (the ones hidden behind the "X more" link).
export default function DayEventsModal({ day, shoots = [], onClose, ...entryProps }) {
  return (
    <Dialog open={!!day} onOpenChange={(o) => { if (!o) onClose?.(); }}>
      <DialogContent className="bg-gray-900 border-gray-700 max-w-md text-white">
        <DialogHeader>
          <DialogTitle className="text-center flex flex-col items-center">
            <span className="text-xs text-gray-400 uppercase tracking-wider">{day ? format(day, 'EEEE') : ''}</span>
            <span className="text-2xl font-bold text-white">{day ? format(day, 'd') : ''}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-1 max-h-[60vh] overflow-y-auto pr-1 -mr-1">
          {shoots.map(s => (
            <MonthEntry key={s.id} shoot={s} {...entryProps} />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}