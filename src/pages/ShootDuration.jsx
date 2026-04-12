import React, { useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import ShootTimingPanel from '../components/dashboard/ShootTimingPanel';
import { Clock } from 'lucide-react';

export default function ShootDuration() {
  const queryClient = useQueryClient();
  const { data: shoots = [] } = useQuery({ queryKey: ['shoots'], queryFn: () => base44.entities.Shoot.list('-date', 500) });
  const { data: users = [] } = useQuery({ queryKey: ['allUsers'], queryFn: () => base44.entities.User.list() });
  const { data: presenceRecords = [] } = useQuery({ queryKey: ['userPresence'], queryFn: () => base44.entities.UserPresence.list() });
  const allUsers = useMemo(() => {
    const map = new Map();
    presenceRecords.forEach(p => { if (p.user_email) map.set(p.user_email, { email: p.user_email, full_name: p.user_name, role: p.user_role }); });
    users.forEach(u => { if (u.email) map.set(u.email, u); });
    return Array.from(map.values());
  }, [users, presenceRecords]);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Clock className="h-6 w-6 text-purple-400" />
          <h1 className="text-2xl font-bold text-white">Shoot Duration Tracker</h1>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
          <ShootTimingPanel
            shoots={shoots}
            allUsers={allUsers}
            onUpdate={async (id, data) => {
              await base44.entities.Shoot.update(id, data);
              queryClient.invalidateQueries({ queryKey: ['shoots'] });
            }}
          />
        </div>
      </div>
    </div>
  );
}