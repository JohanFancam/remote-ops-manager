import { addDays, format } from 'date-fns';

function timeToMinutes(time) {
  const [h, m] = String(time || '12:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export function coverageForShoot(shoot, standbyDays = []) {
  if (!shoot?.date) return null;
  const shootTime = shoot.game_time || shoot.start_time || '12:00';
  const shootDateTime = new Date(`${shoot.date}T00:00:00`);
  shootDateTime.setMinutes(timeToMinutes(shootTime));
  return (standbyDays || []).find((standby) => {
    const startDateStr = standby.start_date || standby.date;
    if (!startDateStr) return false;
    const fallbackEndDate = format(addDays(new Date(`${startDateStr}T00:00:00`), 1), 'yyyy-MM-dd');
    const endDateStr = standby.end_date || fallbackEndDate;
    const start = new Date(`${startDateStr}T${standby.start_time || '18:00'}:00`);
    const end = new Date(`${endDateStr}T${standby.end_time || '06:00'}:00`);
    return shootDateTime >= start && shootDateTime <= end;
  }) || null;
}
