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

export default function ShootChangeNotifier({ userEmail }) {
  const shootsRef = useRef({});

  useEffect(() => {
    if (!userEmail) return;

    // Seed initial state from current shoots
    base44.entities.Shoot.list('-date', 500).then(shoots => {
      shoots.forEach(s => {
        if (s.assigned_operators?.includes(userEmail)) {
          shootsRef.current[s.id] = s;
        }
      });
    });

    const unsubscribe = base44.entities.Shoot.subscribe((event) => {
      const shoot = event.data;
      if (!shoot) return;

      const isAssigned = shoot.assigned_operators?.includes(userEmail);
      const prev = shootsRef.current[shoot.id];

      if (event.type === 'update' && isAssigned && prev) {
        const changes = TRACKED_FIELDS.filter(f => {
          const a = prev[f.key];
          const b = shoot[f.key];
          return String(a ?? '') !== String(b ?? '');
        });

        if (changes.length > 0) {
          const changeText = changes.map(f => {
            const oldVal = prev[f.key] || '—';
            const newVal = shoot[f.key] || '—';
            return `${f.label}: ${oldVal} → ${newVal}`;
          }).join('\n');

          toast.info(`📋 ${shoot.title} updated`, {
            description: changeText,
            duration: 10000,
            action: {
              label: 'View',
              onClick: () => { window.location.href = `/Calendar?shootId=${shoot.id}`; },
            },
          });
        }
      }

      if (event.type === 'update' && !isAssigned && prev) {
        // Was assigned before, now removed
        toast.warning(`You were removed from ${shoot.title || 'a shoot'}`, { duration: 8000 });
      }

      if (event.type === 'update' && isAssigned && !prev) {
        // Newly assigned
        toast.success(`You've been assigned to ${shoot.title}`, {
          duration: 8000,
          action: {
            label: 'View',
            onClick: () => { window.location.href = `/Calendar?shootId=${shoot.id}`; },
          },
        });
      }

      // Update stored state
      if (isAssigned) {
        shootsRef.current[shoot.id] = shoot;
      } else {
        delete shootsRef.current[shoot.id];
      }
    });

    return () => unsubscribe();
  }, [userEmail]);

  return null;
}