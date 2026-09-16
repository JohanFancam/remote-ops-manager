import { format } from 'date-fns';

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
  mine.forEach(s => {
    const sd = s.start_date || s.date;
    const ed = s.end_date || sd;
    if (!sd || !ed) return;
    const cur = new Date(sd + 'T00:00:00');
    const end = new Date(ed + 'T00:00:00');
    while (cur <= end) {
      const ds = format(cur, 'yyyy-MM-dd');
      if (ds.startsWith(monthStr)) daySet.add(ds);
      cur.setDate(cur.getDate() + 1);
    }
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