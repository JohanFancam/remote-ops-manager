import { base44 } from '@/api/base44Client';
import {
  AUTO_APPROVE_LIMIT, getPreApprovedCount, addEmail, removeEmail, hasEmail,
  findPairedShoot, findPairedShootForUnassign,
} from '@/utils/assignmentApproval';

const timeToMinutes = (time) => {
  if (!time || typeof time !== 'string' || !time.includes(':')) return 12 * 60;
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 12 * 60;
  return h * 60 + m;
};

async function createShootTimeEntry(shoot, email, name, notes) {
  const { setup_offset = -150 } = shoot;
  const gameMinutes = timeToMinutes(shoot.game_time || '19:00');
  const setupMinutes = gameMinutes + setup_offset - 60;
  const endMinutes = gameMinutes + 300 + 60;
  const totalHours = (endMinutes - setupMinutes) / 60;

  await base44.entities.TimeEntry.create({
    operator_email: email,
    operator_name: name,
    shoot_id: shoot.id,
    date: shoot.date,
    hours: Math.max(1, parseFloat(totalHours.toFixed(2))),
    rate: 0,
    total: 0,
    notes: notes || shoot.title,
    entry_type: 'manual',
    status: 'approved',
  });
}

// Shared self-assign / unassign logic — mirrors the original ShootCalendarEntry handler
// so every entry (month tile, day popup, quick view) behaves identically.
export async function performSelfAssign({
  shoot, user, isAdmin, isStandby, allShoots, appSettings, todayStr, queryClient, onUpdate,
}) {
  if (!user?.email) return;
  const email = user.email;
  if (shoot.date < todayStr) return;

  const isAssigned = (shoot.assigned_operators || []).includes(email);
  const isPending = (shoot.pending_operators || []).includes(email);

  const autoAssignTeams = (() => {
    const raw = appSettings?.find(s => s.key === 'auto_assign_teams')?.value;
    return raw ? JSON.parse(raw) : ['Reds', 'Red Sox', 'Rangers'];
  })();
  const autoAssignUsers = (() => {
    const raw = appSettings?.find(s => s.key === 'auto_assign_users')?.value;
    return raw ? JSON.parse(raw) : [];
  })();
  const autoAssignWindowMinutes = (() => {
    const raw = appSettings?.find(s => s.key === 'auto_assign_window_hours')?.value;
    return (raw ? Number(raw) : 2) * 60;
  })();
  const userEligibleForAutoAssign = !isAdmin && user && (
    autoAssignUsers.length === 0 || autoAssignUsers.includes(user.email)
  );

  const getPreApproved = (e) => {
    const freshShoots = queryClient?.getQueryData(['shoots']) || allShoots;
    return getPreApprovedCount(freshShoots, e, shoot.id, todayStr);
  };

  if (isPending) {
    // Cancel a pending request
    await onUpdate(shoot.id, {
      pending_operators: removeEmail(shoot.pending_operators, email),
      pre_approved_operators: removeEmail(shoot.pre_approved_operators, email),
    });
  } else if (isAssigned) {
    // Unassign + cascade to paired shoot
    await onUpdate(shoot.id, {
      assigned_operators: removeEmail(shoot.assigned_operators, email),
      pending_operators: removeEmail(shoot.pending_operators, email),
      pre_approved_operators: removeEmail(shoot.pre_approved_operators, email),
      auto_assigned_for: removeEmail(shoot.auto_assigned_for, email),
    });
    const paired = findPairedShootForUnassign(shoot, allShoots, autoAssignTeams, autoAssignWindowMinutes, email);
    if (paired) {
      await onUpdate(paired.id, {
        assigned_operators: removeEmail(paired.assigned_operators, email),
        pending_operators: removeEmail(paired.pending_operators, email),
        pre_approved_operators: removeEmail(paired.pre_approved_operators, email),
        auto_assigned_for: removeEmail(paired.auto_assigned_for, email),
      });
    }
  } else if (isAdmin) {
    await onUpdate(shoot.id, {
      assigned_operators: addEmail(shoot.assigned_operators, email),
      pending_operators: removeEmail(shoot.pending_operators, email),
    });
    await createShootTimeEntry(shoot, email, user.full_name || email, `Shoot: ${shoot.title}`);
    const partner = findPairedShoot(shoot, allShoots, autoAssignTeams, autoAssignWindowMinutes, email);
    if (partner) {
      await onUpdate(partner.id, {
        assigned_operators: addEmail(partner.assigned_operators, email),
        pending_operators: removeEmail(partner.pending_operators, email),
        auto_assigned_for: addEmail(partner.auto_assigned_for, email),
      });
    }
  } else {
    // Remote user self-assign
    const preCount = getPreApproved(email);
    const withinLimit = preCount < AUTO_APPROVE_LIMIT;

    if (withinLimit) {
      await onUpdate(shoot.id, {
        assigned_operators: addEmail(shoot.assigned_operators, email),
        pending_operators: removeEmail(shoot.pending_operators, email),
        pre_approved_operators: addEmail(shoot.pre_approved_operators, email),
      });
    } else if (!hasEmail(shoot.pending_operators, email)) {
      await onUpdate(shoot.id, {
        pending_operators: addEmail(shoot.pending_operators, email),
        assigned_operators: removeEmail(shoot.assigned_operators, email),
        pre_approved_operators: removeEmail(shoot.pre_approved_operators, email),
      });
    }

    if (userEligibleForAutoAssign) {
      const partner = findPairedShoot(shoot, allShoots, autoAssignTeams, autoAssignWindowMinutes, email);
      if (partner) {
        const countAfterMain = withinLimit ? preCount + 1 : preCount;
        const partnerWithinLimit = countAfterMain < AUTO_APPROVE_LIMIT;
        if (partnerWithinLimit) {
          await onUpdate(partner.id, {
            assigned_operators: addEmail(partner.assigned_operators, email),
            pending_operators: removeEmail(partner.pending_operators, email),
            pre_approved_operators: addEmail(partner.pre_approved_operators, email),
            auto_assigned_for: addEmail(partner.auto_assigned_for, email),
          });
        } else {
          await onUpdate(partner.id, {
            pending_operators: addEmail(partner.pending_operators, email),
            assigned_operators: removeEmail(partner.assigned_operators, email),
            pre_approved_operators: removeEmail(partner.pre_approved_operators, email),
            auto_assigned_for: removeEmail(partner.auto_assigned_for, email),
          });
        }
      }
    }
  }
}