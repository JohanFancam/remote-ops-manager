import { format, differenceInMinutes } from 'date-fns';

export default function DashboardBanner({ user, shoots, standbyDays }) {
  const now = new Date();

  const assignedShoots = shoots
    .filter(s => s.assigned_operators?.includes(user?.email))
    .sort((a, b) => new Date(a.date + ' ' + a.game_time) - new Date(b.date + ' ' + b.game_time));

  const currentShoot = assignedShoots.find(s => s.status !== 'completed');
  const nextShoot = currentShoot || assignedShoots[0];

  const getSetupCountdown = () => {
    if (!nextShoot) return null;

    const shootTime = new Date(`${nextShoot.date}T${nextShoot.game_time || '19:00'}`);
    const setupTime = new Date(shootTime.getTime() - (150 * 60000));

    const mins = differenceInMinutes(setupTime, now);

    if (mins <= 0 && nextShoot.status !== 'completed') return 'In Progress';
    if (mins <= 0) return 'Completed';

    return `${mins} min to setup`;
  };

  const currentStandby = standbyDays.find(s => {
    const start = new Date(s.start_date + 'T18:00');
    const end = new Date(s.end_date + 'T06:00');
    return now >= start && now <= end;
  });

  const nextStandby = standbyDays
    .filter(s => new Date(s.start_date) > now)
    .sort((a, b) => new Date(a.start_date) - new Date(b.start_date))[0];

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-4 flex flex-col md:flex-row justify-between gap-4">

      <div className="text-gray-500 text-xs">
        {format(now, 'EEEE, MMMM d yyyy HH:mm')}
      </div>

      <div className="flex gap-8 flex-wrap">

        <div>
          <p className="text-xs text-gray-400">On Standby Now</p>
          <p className="text-xl font-semibold text-white">
            {currentStandby?.admin_name || '-'}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-400">Next Standby</p>
          <p className="text-xl font-semibold text-white">
            {nextStandby ? `${nextStandby.admin_name}` : '-'}
          </p>
          <p className="text-xs text-gray-500">
            {nextStandby?.start_date}
          </p>
        </div>

        <div>
          <p className="text-xs text-gray-400">Next Shoot</p>
          <p className="text-xl font-semibold text-white">
            {nextShoot ? `${nextShoot.title}` : '-'}
          </p>
          <p className="text-xs text-gray-500">
            {nextShoot?.date}
          </p>
          <p className="text-xs text-blue-400">
            {getSetupCountdown()}
          </p>
        </div>

      </div>
    </div>
  );
}