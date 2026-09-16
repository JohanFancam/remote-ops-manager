import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { Phone, Trash2 } from 'lucide-react';

const ROLE_LABEL = {
  admin: 'Admin',
  standby: 'Standby',
  operator_standby: 'Operator/Standby',
};

// Admin-only dialog to assign (or reassign / remove) a standby slot to any
// standby-capable person — including Operator/Standby users.
export default function StandbyAssignDialog({ open, day, allUsers = [], currentUser, existing, onClose }) {
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (open) setEmail(existing?.admin_email || currentUser?.email || '');
  }, [open, existing, currentUser]);

  const candidates = allUsers.filter(u =>
    ['admin', 'standby', 'operator_standby'].includes(u.role)
  );

  const endDateStr = day
    ? format(new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1), 'yyyy-MM-dd')
    : '';

  const handleAssign = async () => {
    if (!email || !day) return;
    setSaving(true);
    try {
      const u = allUsers.find(x => x.email === email) || { email, full_name: email };
      const dateStr = format(day, 'yyyy-MM-dd');
      if (existing) {
        await base44.entities.StandbyDay.update(existing.id, {
          admin_email: u.email,
          admin_name: u.full_name || u.email,
        });
      } else {
        await base44.entities.StandbyDay.create({
          date: dateStr,
          start_date: dateStr,
          start_time: '18:00',
          end_date: endDateStr,
          end_time: '06:00',
          admin_email: u.email,
          admin_name: u.full_name || u.email,
          notes: 'Calendar standby assignment',
        });
      }
      await queryClient.invalidateQueries({ queryKey: ['standbyDays'] });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!existing) { onClose(); return; }
    setSaving(true);
    try {
      await base44.entities.StandbyDay.delete(existing.id);
      await queryClient.invalidateQueries({ queryKey: ['standbyDays'] });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-gray-900 border-gray-700 max-w-sm text-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Phone className="h-4 w-4 text-yellow-400" />
            Assign Standby {day ? `— ${format(day, 'd MMM yyyy')}` : ''}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <label className="text-xs text-gray-400 block">Standby person</label>
          <select
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-950 border border-gray-700 text-white rounded-md px-3 py-2 text-sm"
          >
            {candidates.map(u => (
              <option key={u.email} value={u.email}>
                {u.full_name || u.email} ({ROLE_LABEL[u.role] || u.role})
              </option>
            ))}
          </select>
          {existing && (
            <p className="text-xs text-gray-500">
              Currently: <span className="text-gray-300">{existing.admin_name || existing.admin_email}</span>
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 pt-2">
          {existing ? (
            <Button variant="ghost" size="sm" className="text-red-400 hover:bg-red-900/30" onClick={handleRemove} disabled={saving}>
              <Trash2 className="h-4 w-4 mr-1" /> Remove
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button size="sm" onClick={handleAssign} disabled={saving || !email}>
              {saving ? 'Saving…' : existing ? 'Reassign' : 'Assign Standby'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}