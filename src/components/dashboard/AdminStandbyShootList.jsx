import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, List, LayoutGrid } from 'lucide-react';
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
    <button onClick={onClick} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'bg-teal-700 text-white' : 'text-zinc-500 hover:bg-zinc-200/70 hover:text-zinc-900'}`}>
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

  const renderCard = (shoot) => (
    <CountdownCard
      key={shoot.id}
      shoot={shoot}
      isAdmin={isAdmin}
      rigSettings={rigSettings}
      onUpdate={onUpdate}
      userEmail={userEmail}
      allUsers={allUsers}
      showReadyMessage={false}
    />
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg bg-zinc-100 p-0.5">
          <ViewButton active={viewMode === 'day'} icon={List} onClick={() => setViewMode('day')}>Day</ViewButton>
          <ViewButton active={viewMode === 'month'} icon={CalendarDays} onClick={() => setViewMode('month')}>Calendar</ViewButton>
          <ViewButton active={viewMode === 'tile'} icon={LayoutGrid} onClick={() => setViewMode('tile')}>Tile</ViewButton>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-400">
          {viewMode === 'tile' ? 'Showing max 4' : 'Showing max 3'}
        </div>
      </div>

      {viewMode === 'month' && (
        <div>
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-zinc-50 px-3 py-2">
            <button onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="rounded p-1 hover:bg-zinc-200 transition-colors"><ChevronLeft className="h-4 w-4 text-zinc-500" /></button>
            <div className="flex-1 text-center text-sm font-semibold text-zinc-900">{format(monthDate, 'MMMM yyyy')}</div>
            <button onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="rounded p-1 hover:bg-zinc-200 transition-colors"><ChevronRight className="h-4 w-4 text-zinc-500" /></button>
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
                <button key={ds} onClick={() => setMonthSelectedDate(isSelected ? null : ds)} className={`relative flex flex-col items-center rounded-lg py-1.5 transition-colors ${isSelected ? 'bg-teal-700' : isToday ? 'bg-zinc-200' : dayShoots.length > 0 ? 'bg-zinc-100 hover:bg-zinc-200' : 'hover:bg-zinc-50'}`}>
                  <span className={`text-xs font-medium ${isSelected ? 'text-zinc-900' : isToday ? 'text-teal-700' : dayShoots.length > 0 ? 'text-zinc-900' : 'text-gray-600'}`}>{format(day, 'd')}</span>
                  {dayShoots.length > 0 && <span className={`mt-0.5 text-xs font-bold ${isSelected ? 'text-blue-200' : 'text-teal-700'}`}>{dayShoots.length}</span>}
                </button>
              );
            })}
          </div>
          {monthSelectedDate && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-400">{format(new Date(`${monthSelectedDate}T12:00:00`), 'EEEE, MMM d')} - {monthDayShootsList.length} standby shoot{monthDayShootsList.length !== 1 ? 's' : ''}</p>
              {monthDayShootsList.length === 0 ? <div className="py-4 text-center text-sm italic text-zinc-400">No upcoming standby coverage shoots on this day.</div> : <div className="space-y-2">{monthVisibleShoots.map(renderCard)}</div>}
            </div>
          )}
        </div>
      )}

      {viewMode !== 'month' && (
        <>
          {allStandbyShoots.length === 0 ? (
            <div className="py-6 text-center text-sm italic text-zinc-400">No upcoming shoots during your standby coverage.</div>
          ) : (
            <div className={viewMode === 'tile' ? 'grid grid-cols-1 gap-3 xl:grid-cols-2' : 'space-y-2'}>{visibleShoots.map(renderCard)}</div>
          )}
          {allStandbyShoots.length > pageSize && (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-3 py-2">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-md border border-zinc-200 px-2.5 py-1 text-xs text-zinc-600 hover:bg-zinc-100 disabled:opacity-30">Previous</button>
              <span className="text-[10px] font-bold text-gray-600">SHOWING {page * pageSize + 1}-{Math.min((page + 1) * pageSize, allStandbyShoots.length)} OF {allStandbyShoots.length}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="rounded-md border border-blue-800/60 bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 hover:bg-teal-50 disabled:opacity-30">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
