import { addDays, format } from 'date-fns';
import { parseSourceDateTime } from './timezone';

export function coverageForShoot(shoot, standbyDays = []) {
  if (!shoot?.date) return null;
  const shootTime = shoot.game_time || shoot.start_time || '12:00';
  const shootDateTime = parseSourceDateTime(shoot.date, shootTime);
  if (!shootDateTime) return null;
  return (standbyDays || []).find((standby) => {
    const startDateStr = standby.start_date || standby.date;
    if (!startDateStr) return false;
    const fallbackEndDate = format(addDays(new Date(`${startDateStr}T12:00:00`), 1), 'yyyy-MM-dd');
    const endDateStr = standby.end_date || fallbackEndDate;
    const start = parseSourceDateTime(startDateStr, standby.start_time || '18:00');
    const end = parseSourceDateTime(endDateStr, standby.end_time || '06:00');
    if (!start || !end) return false;
    return shootDateTime >= start && shootDateTime <= end;
  }) || null;
}
