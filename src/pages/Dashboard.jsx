import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';

import DashboardBanner from '../components/dashboard/DashboardBanner';
import AssignedShootsSection from '../components/dashboard/AssignedShootsSection';
import StandbyCoverageSection from '../components/dashboard/StandbyCoverageSection';

export default function Dashboard() {
  const { user, isAdmin } = useApp();

  const { data: shoots = [] } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list(),
  });

  const { data: standbyDays = [] } = useQuery({
    queryKey: ['standbyDays'],
    queryFn: () => base44.entities.StandbyDay.list(),
  });

  const assignedShoots = shoots.filter(s =>
    s.assigned_operators?.includes(user?.email)
  );

  const standbyCoverageShoots = shoots.filter(s => {
    // keep your existing standby logic here if already implemented
    return true;
  });

  const handleUpdate = async (id, data) => {
    await base44.entities.Shoot.update(id, data);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4">

      {/* Dashboard Banner */}
      <DashboardBanner
        user={user}
        shoots={shoots}
        standbyDays={standbyDays}
      />

      {/* My Assigned Shoots */}
      <AssignedShootsSection
        shoots={assignedShoots}
        onUpdate={handleUpdate}
      />

      {/* Standby Coverage (Admins only) */}
      {isAdmin && (
        <StandbyCoverageSection
          shoots={standbyCoverageShoots}
        />
      )}

    </div>
  );
} 