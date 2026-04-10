import { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

const TRACKED_FIELDS = [
  { key: 'game_time', label: 'Game Time' },
  { key: 'date', label: 'Date' },
  { key: 'location', label: 'Location' },
  { key: 'rig_type_override', label: 'Rig Type' },
  { key: 'status', label: 'Status' },
  { key: 'standby_admin', label: 'Standby Contact' },
];

export default function ShootChangeNotifier({ userEmail, isAdmin = false }) {
  const shootsRef = useRef({});

  useEffect(() => {
    if (!userEmail) return;

    // Seed initial state from current shoots
    base44.entities.Shoot.list('-date', 500).then(shoots => {
      shoots.forEach(s => { shootsRef.current[s.id] = s; });
    });

    const unsubscribe = base44.entities.Shoot.subscribe((event) => {
      const shoot = event.data;
      if (!shoot) return;

      const isAssigned = shoot.assigned_operators?.includes(userEmail);
      const prev = shootsRef.current[shoot.id];

      // Admin: notify when pending operators added
      if (isAdmin && event.type === 'update' && prev) {
        const prevPending = prev.pending_operators || [];
        const newPending = shoot.pending_operators || [];
        const added = newPending.filter(e => !prevPending.includes(e));
        if (added.length > 0) {
          toast.info(`⏳ Approval needed: ${shoot.title}`, {
            description: `${added.length} operator(s) requesting assignment`,
            duration: 10000,
            action: {
              label: 'Review',
              onClick: () => { window.location.href = `/Calendar?shootId=${shoot.id}`; },
            },
          });
        }
      }

      // Update stored state
      if (isAssigned || isAdmin) {
        shootsRef.current[shoot.id] = shoot;
      } else {
        delete shootsRef.current[shoot.id];
      }
    });

    return () => unsubscribe();
  }, [userEmail]);

  return null;
}