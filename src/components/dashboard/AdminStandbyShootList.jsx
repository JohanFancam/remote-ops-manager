import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, List, LayoutGrid, Wrench, Check, Copy } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import CountdownCard from './CountdownCard';
import { getScheduleDateTimes } from '../utils/scheduleUtils';

function getPrimaryDateTime(shoot) {
  const phaseDates = getScheduleDateTimes(shoot);
  return phaseDates.setup || phaseDates.pre_shoot || phaseDates.game || new Date(`${shoot.date}T${shoot.game_time || '23:59'}`);
}

function isCompleted(shoot) {
  return !!shoot?.phase_status?.shoot_complete || shoot?.status === 'completed';
}

function isCancelled(shoot) {
  return shoot?.status === 'cancelled';
}

function getShootDateTime(shoot) {
  return getScheduleDateTimes(shoot).game || new Date(`${shoot.date}T${shoot.game_time || '23:59'}`);
}

function getRigTypeLabel(shoot, rig) {
  const baseType = shoot?.rig_type_override || rig?.rig_type || shoot?.rig_type || 'Data';
  const parts = [baseType];
  if (rig?.sound && !String(baseType).toLowerCase().includes('sound')) parts.push('Sound');
  return parts.filter(Boolean).join('/');
}

function getTeamName(shoot, rig) {
  return rig?.team || shoot?.client || shoot?.title || 'Unknown Team';
}

function ViewButton({ active, icon: Icon, children, onClick }) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700/70 hover:text-white'}`}>
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

export default function AdminStandbyShootList({
  shoots = [],
  allUsers = [],
  userEmail,
  rigSettings = [],
  standbyDays = [],
  onUpdate,
  isAdmin = false
}) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [viewMode, setViewMode] = useState('tile');
  const [page, setPage] = useState(0);
  const [monthDate, setMonthDate] = useState(new Date());
  const [monthSelectedDate, setMonthSelectedDate] = useState(null);
  const [rigMessageCopied, setRigMessageCopied] = useState(false);

  const myStandbyWindows = useMemo(() => {
    return standbyDays
      .filter((sd) => !userEmail || sd.admin_email === userEmail)
      .map((sd) => {
        const startDate = sd.start_date || sd.date;
        const endDate = sd.end_date || startDate;
        if (!startDate) return null;
        return {
          ...sd,
          startDt: new Date(`${startDate}T${sd.start_time || '18:00'}`),
          endDt: new Date(`${endDate}T${sd.end_time || '06:00'}`),
        };
      })
      .filter(Boolean)
      .sort((a, b) => a.startDt - b.startDt);
  }, [standbyDays, userEmail]);

  const allStandbyShoots = useMemo(() => {
    const seen = new Map();
    shoots
      .filter((shoot) => !isCancelled(shoot))
      .forEach((shoot) => {
        const shootDt = getShootDateTime(shoot);
        const covered = myStandbyWindows.some((w) => shootDt >= w.startDt && shootDt <= w.endDt);
        if (covered && !seen.has(shoot.id)) seen.set(shoot.id, shoot);
      });

    const now = new Date();
    const relevanceWindowStart = new Date(now.getTime() - 6 * 60 * 60 * 1000);

    return Array.from(seen.values())
      .filter((shoot) => !isCompleted(shoot) && getShootDateTime(shoot) >= relevanceWindowStart)
      .sort((a, b) => getPrimaryDateTime(a) - getPrimaryDateTime(b));
  }, [shoots, myStandbyWindows]);

  const pageSize = viewMode === 'tile' ? 4 : 3;

  useEffect(() => {
    setPage(0);
  }, [viewMode, monthSelectedDate, shoots.length, standbyDays.length]);

  const totalPages = Math.max(1, Math.ceil(allStandbyShoots.length / pageSize));
  const visibleShoots = allStandbyShoots.slice(page * pageSize, page * pageSize + pageSize);

  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart);
  const shootsByDate = allStandbyShoots.reduce((acc, shoot) => {
    acc[shoot.date] = acc[shoot.date] || [];
    acc[shoot.date].push(shoot);
    return acc;
  }, {});
  const monthDayShootsList = monthSelectedDate ? (shootsByDate[monthSelectedDate] || []) : [];
  const monthVisibleShoots = monthDayShootsList.slice(0, 3);

  const checkedRigShoots = useMemo(() => {
    return allStandbyShoots
      .filter((shoot) => shoot.rig_check_completed && !shoot.rig_check_archived)
      .sort((a, b) => ((a.date || '') + ' ' + (a.game_time || '')).localeCompare((b.date || '') + ' ' + (b.game_time || '')));
  }, [allStandbyShoots]);

  const buildRigCheckMessage = () => {
    if (checkedRigShoots.length === 0) return '';
    const items = checkedRigShoots.map((shoot) => {
      const rig = rigSettings.find((r) => r.team?.toLowerCase().trim() === shoot.client?.toLowerCase().trim());
      return `• ${getTeamName(shoot, rig)} - ${getRigTypeLabel(shoot, rig)}`;
    });
    return `Shoots ready for today :\n\n${items.join('\n')}`;
  };

  const handleCopyRigMessage = async () => {
    const message = buildRigCheckMessage();
    if (!message) return;
    await navigator.clipboard.writeText(message);
    setRigMessageCopied(true);
    setTimeout(() => setRigMessageCopied(false), 2000);
  };

  const handleToggleRigCheck = async (shoot) => {
    if (!onUpdate || !isAdmin) return;
    const nextChecked = !shoot.rig_check_completed;
    await onUpdate(shoot.id, {
      rig_check_completed: nextChecked,
      rig_check_checked_from_dashboard: nextChecked,
      rig_check_checked_by: nextChecked ? (userEmail || '') : '',
      rig_check_checked_at: nextChecked ? new Date().toISOString() : '',
      rig_check_archived: false,
      rig_check_archived_at: '',
      rig_check_archived_by: '',
      rig_check_archived_by_name: '',
    });
  };

  const renderCard = (shoot) => {
    const rigChecked = !!shoot.rig_check_completed;
    return (
      <div key={shoot.id} className="relative">
        {isAdmin && (
          <button
            type="button"
            onClick={() => handleToggleRigCheck(shoot)}
            className={`absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border transition-colors ${rigChecked ? 'border-green-500/50 bg-green-500/15 text-green-300 hover:bg-green-500/25' : 'border-yellow-500/45 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20'}`}
            title={rigChecked ? 'Rig checked - click to remove from rig message' : 'Mark rig checked'}
          >
            {rigChecked ? <Check className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
          </button>
        )}
        <CountdownCard
          shoot={shoot}
          isAdmin={isAdmin}
          rigSettings={rigSettings}
          onUpdate={onUpdate}
          userEmail={userEmail}
          allUsers={allUsers}
        />
      </div>
    );
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg bg-gray-800 p-0.5">
          <ViewButton active={viewMode === 'day'} icon={List} onClick={() => setViewMode('day')}>Day</ViewButton>
          <ViewButton active={viewMode === 'month'} icon={CalendarDays} onClick={() => setViewMode('month')}>Calendar</ViewButton>
          <ViewButton active={viewMode === 'tile'} icon={LayoutGrid} onClick={() => setViewMode('tile')}>Tile</ViewButton>
        </div>
        <div className="rounded-lg border border-gray-800 bg-gray-900 px-2 py-1 text-xs text-gray-500">
          {viewMode === 'tile' ? 'Showing max 4' : 'Showing max 3'}
        </div>
      </div>

      {isAdmin && checkedRigShoots.length > 0 && (
        <div className="mb-4 rounded-xl border border-green-800/40 bg-green-950/15 p-3">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-green-300">Rig check message</p>
              <p className="text-[11px] text-gray-500">Only checked rigs are included. Untick a rig to remove it from this message.</p>
            </div>
            <button
              type="button"
              onClick={handleCopyRigMessage}
              className="inline-flex h-8 items-center justify-center rounded-md border border-green-700 bg-green-950/45 px-3 text-xs font-medium text-green-300 transition-colors hover:bg-green-900/50 hover:text-green-100"
            >
              {rigMessageCopied ? <><Check className="mr-1 h-3.5 w-3.5" />Copied</> : <><Copy className="mr-1 h-3.5 w-3.5" />Copy to Slack</>}
            </button>
          </div>
          <pre className="whitespace-pre-wrap rounded-lg border border-gray-800 bg-gray-950 p-3 text-xs leading-relaxed text-gray-200">{buildRigCheckMessage()}</pre>
        </div>
      )}

      {viewMode === 'month' && (
        <div>
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-gray-800/50 px-3 py-2">
            <button onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="rounded p-1 hover:bg-gray-700 transition-colors"><ChevronLeft className="h-4 w-4 text-gray-400" /></button>
            <div className="flex-1 text-center text-sm font-semibold text-white">{format(monthDate, 'MMMM yyyy')}</div>
            <button onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="rounded p-1 hover:bg-gray-700 transition-colors"><ChevronRight className="h-4 w-4 text-gray-400" /></button>
          </div>
          <div className="mb-1 grid grid-cols-7 gap-1">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => <div key={d} className="py-1 text-center text-xs font-medium text-gray-600">{d}</div>)}
          </div>
          <div className="mb-4 grid grid-cols-7 gap-1">
            {Array.from({ length: startPadding }).map((_, i) => <div key={`pad-${i}`} />)}
            {monthDays.map((day) => {
              const ds = format(day, 'yyyy-MM-dd');
              const dayShoots = shootsByDate[ds] || [];
              const isToday = ds === todayStr;
              const isSelected = ds === monthSelectedDate;
              return (
                <button key={ds} onClick={() => setMonthSelectedDate(isSelected ? null : ds)} className={`relative flex flex-col items-center rounded-lg py-1.5 transition-colors ${isSelected ? 'bg-blue-600' : isToday ? 'bg-gray-700' : dayShoots.length > 0 ? 'bg-gray-800 hover:bg-gray-700' : 'hover:bg-gray-800/50'}`}>
                  <span className={`text-xs font-medium ${isSelected ? 'text-white' : isToday ? 'text-blue-400' : dayShoots.length > 0 ? 'text-white' : 'text-gray-600'}`}>{format(day, 'd')}</span>
                  {dayShoots.length > 0 && <span className={`mt-0.5 text-xs font-bold ${isSelected ? 'text-blue-200' : 'text-blue-400'}`}>{dayShoots.length}</span>}
                </button>
              );
            })}
          </div>
          {monthSelectedDate && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-gray-500">{format(new Date(`${monthSelectedDate}T12:00:00`), 'EEEE, MMM d')} - {monthDayShootsList.length} standby shoot{monthDayShootsList.length !== 1 ? 's' : ''}</p>
              {monthDayShootsList.length === 0 ? <div className="py-4 text-center text-sm italic text-gray-500">No upcoming standby coverage shoots on this day.</div> : <div className="space-y-2">{monthVisibleShoots.map(renderCard)}</div>}
            </div>
          )}
        </div>
      )}

      {viewMode !== 'month' && (
        <>
          {allStandbyShoots.length === 0 ? (
            <div className="py-6 text-center text-sm italic text-gray-500">No upcoming shoots during your standby coverage.</div>
          ) : (
            <div className={viewMode === 'tile' ? 'grid grid-cols-1 gap-3 xl:grid-cols-2' : 'space-y-2'}>{visibleShoots.map(renderCard)}</div>
          )}
          {allStandbyShoots.length > pageSize && (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-gray-800 bg-gray-900/50 px-3 py-2">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-md border border-gray-700 px-2.5 py-1 text-xs text-gray-300 hover:bg-gray-800 disabled:opacity-30">Previous</button>
              <span className="text-[10px] font-bold text-gray-600">SHOWING {page * pageSize + 1}-{Math.min((page + 1) * pageSize, allStandbyShoots.length)} OF {allStandbyShoots.length}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="rounded-md border border-blue-800/60 bg-blue-950/25 px-2.5 py-1 text-xs font-semibold text-blue-300 hover:bg-blue-900/30 disabled:opacity-30">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
} 
