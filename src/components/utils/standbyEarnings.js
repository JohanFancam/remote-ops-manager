import { format, addDays } from 'date-fns';

function timeToMinutes(t) {
  if (!t) return null;
  const [h, m] = String(t).split(':').map(Number);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

// Flat per-day standby earnings for an Operator/Standby user.
// Each calendar day covered by one of the operator's StandbyDay periods
// (within the given month) earns the standby rate once.
// Returns { days: [{ date, amount, isStandby }], total, count }.
export function getOperatorStandbyEarnings(standbyDays, operatorEmail, monthStr, standbyRate) {
  const rate = Number(standbyRate) || 0;
  const safeEmail = operatorEmail?.toLowerCase()?.trim();
  if (!safeEmail || !monthStr) return { days: [], total: 0, count: 0 };

  const mine = (standbyDays || []).filter(
    s => (s.admin_email || '').toLowerCase().trim() === safeEmail
  );

  const daySet = new Set();
  const addRangeInclusive = (sd, ed) => {
    const cur = new Date(sd + 'T00:00:00');
    const end = new Date(ed + 'T00:00:00');
    while (cur <= end) {
      const ds = format(cur, 'yyyy-MM-dd');
      if (ds.startsWith(monthStr)) daySet.add(ds);
      cur.setDate(cur.getDate() + 1);
    }
  };

  mine.forEach(s => {
    const sd = s.start_date || s.date;
    const ed = s.end_date || sd;
    if (!sd) return;

    // Same-day standby period = one paid day.
    if (sd === ed) {
      if (sd.startsWith(monthStr)) daySet.add(sd);
      return;
    }

    // Overnight single shift: ends the next morning (end_date is exactly one
    // day after start_date and the shift crosses midnight, e.g. 18:00 → 06:00).
    // This is ONE paid day — the day the shift started — not two.
    const startMin = timeToMinutes(s.start_time);
    const endMin = timeToMinutes(s.end_time);
    const nextDay = format(addDays(new Date(sd + 'T00:00:00'), 1), 'yyyy-MM-dd');
    if (ed === nextDay && startMin != null && endMin != null && endMin <= startMin) {
      if (sd.startsWith(monthStr)) daySet.add(sd);
      return;
    }

    // Multi-day standby: pay each calendar day from start to end inclusive.
    addRangeInclusive(sd, ed);
  });

  const days = [...daySet].sort().map(date => ({ date, amount: rate, isStandby: true }));
  return { days, total: days.length * rate, count: days.length };
}

// Shape a standby day as a breakdown item compatible with the earnings list UI.
export function standbyBreakdownItem(day) {
  return {
    date: day.date,
    shoot: { title: 'Standby Coverage', game_time: '' },
    amount: day.amount,
    isAdditional: false,
    isCancelled: false,
    isStandby: true,
  };
}