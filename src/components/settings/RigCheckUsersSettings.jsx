import React, { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Save, Wrench } from 'lucide-react';

export default function RigCheckUsersSettings({ appSettings, allUsers = [] }) {
  const queryClient = useQueryClient();
  const [rigCheckUsers, setRigCheckUsers] = useState([]);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const raw = appSettings.find(s => s.key === 'rig_check_users')?.value;
    setRigCheckUsers(raw ? JSON.parse(raw) : []);
  }, [appSettings]);

  const toggle = (email) => {
    setRigCheckUsers(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const handleSave = async () => {
    const key = 'rig_check_users';
    const value = JSON.stringify(rigCheckUsers);
    const existing = appSettings.find(s => s.key === key);
    if (existing) {
      await base44.entities.AppSettings.update(existing.id, { value });
    } else {
      await base44.entities.AppSettings.create({ key, value, description: 'Users permitted to perform rig checks (empty = standby/admin only)' });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    queryClient.invalidateQueries({ queryKey: ['appSettings'] });
  };

  // All non-inactive users (admins + standby + remote)
  const eligibleUsers = allUsers.filter(u => !u.inactive);

  return (
    <Card className="bg-slate-900 border-slate-800 mb-6">
      <CardHeader className="border-b border-slate-800 pb-4">
        <CardTitle className="text-slate-100 flex items-center gap-2">
          <Wrench className="h-5 w-5 text-amber-400" /> Rig Check Permissions
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <p className="text-xs text-slate-500">
          Select which users can perform rig checks on the calendar. Admins and standby users always have access.
          Leave empty to keep it restricted to standby/admin only.
        </p>

        <div className="space-y-1 max-h-48 overflow-y-auto">
          {eligibleUsers.map(u => (
            <label key={u.email} className="flex items-center gap-2 cursor-pointer hover:bg-slate-800 px-2 py-1.5 rounded-lg">
              <input
                type="checkbox"
                checked={rigCheckUsers.includes(u.email)}
                onChange={() => toggle(u.email)}
                className="accent-yellow-500"
              />
              <span className="text-sm text-slate-400">{u.full_name || u.email}</span>
              <span className="text-xs text-gray-600">{u.email}</span>
              <span className={`text-xs ml-auto px-1.5 py-0.5 rounded-full ${
                u.role === 'admin' ? 'bg-blue-950/40 text-blue-400' :
                u.role === 'standby' ? 'bg-yellow-900/40 text-amber-400' :
                'bg-green-900/40 text-emerald-400'
              }`}>{u.role === 'admin' ? 'Admin' : u.role === 'standby' ? 'Standby' : 'Remote'}</span>
            </label>
          ))}
          {eligibleUsers.length === 0 && <p className="text-xs text-gray-600 px-2">No users found.</p>}
        </div>

        <Button onClick={handleSave} className="bg-yellow-700 hover:bg-yellow-600 gap-2">
          <Save className="h-4 w-4" /> {saved ? '✓ Saved!' : 'Save Rig Check Permissions'}
        </Button>
      </CardContent>
    </Card>
  );
}