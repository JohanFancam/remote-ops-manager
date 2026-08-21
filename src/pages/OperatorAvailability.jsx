import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { AdminAvailabilityView } from '../components/dashboard/OperatorAvailabilityPanel';
import { Users } from 'lucide-react';

export default function OperatorAvailability() {
  const { data: users = [] } = useQuery({ queryKey: ['allUsers'], queryFn: () => base44.entities.User.list() });
  const { data: presenceRecords = [] } = useQuery({ queryKey: ['userPresence'], queryFn: () => base44.entities.UserPresence.list() });
  const allUsers = useMemo(() => {
    const map = new Map();
    presenceRecords.forEach(p => { if (p.user_email) map.set(p.user_email, { email: p.user_email, full_name: p.user_name, role: p.user_role }); });
    users.forEach(u => { if (u.email) map.set(u.email, u); });
    return Array.from(map.values());
  }, [users, presenceRecords]);

  return (
    <div className="min-h-screen bg-zinc-800 text-zinc-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Users className="h-6 w-6 text-emerald-400" />
          <h1 className="text-2xl font-bold text-zinc-100">Operator Availability</h1>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <AdminAvailabilityView allUsers={allUsers} />
        </div>
      </div>
    </div>
  );
}