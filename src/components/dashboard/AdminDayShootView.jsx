import React, { useEffect, useMemo, useState } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import { ChevronLeft, ChevronRight, CalendarDays, List, LayoutGrid } from 'lucide-react';
import CountdownCard from './CountdownCard';
import { getScheduleDateTimes } from '../utils/scheduleUtils';
import { matchRig } from '../utils/rigUtils';

function getPrimaryDateTime(shoot, rigSettings = []) {
  const phaseDates = getScheduleDateTimes(shoot, matchRig(shoot, rigSettings));
  return (
    phaseDates.setup ||
    phaseDates.pre_shoot ||
    phaseDates.game ||
    new Date(`${shoot.date}T${shoot.game_time || '23:59'}`)
  );
}

function isShootComplete(shoot) {
  return shoot?.status === 'completed';
}

function isShootCancelled(shoot) {
  return shoot?.status === 'cancelled';
}

function ViewButton({ active, icon: Icon, children, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? 'bg-blue-600 text-white ' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

export default function AdminDayShootView({
  shoots = [],
  isAdmin,
  rigSettings,
  onUpdate,
  userEmail,
  allUsers,
  allShoots = [],
  appSettings = [],
  onShootContextMenu,
  onShootClick,
}) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [viewMode, setViewMode] = useState('tile');
  const [monthDate, setMonthDate] = useState(new Date());
  const [monthSelectedDate, setMonthSelectedDate] = useState(null);
  const [page, setPage] = useState(0);

  const sortedShoots = useMemo(() => {
    return [...shoots]
      .filter((shoot) => !isShootCancelled(shoot))
      .sort((a, b) => getPrimaryDateTime(a, rigSettings) - getPrimaryDateTime(b, rigSettings));
  }, [shoots, rigSettings]);

  const pageSize = viewMode === 'tile' ? 4 : 3;

  const pastCount = useMemo(() => {
    const now = new Date();
    const relevanceWindowStart = new Date(now.getTime() - 6 * 60 * 60 * 1000);
    return sortedShoots.filter((shoot) => {
      const gameDate = getScheduleDateTimes(shoot, matchRig(shoot, rigSettings)).game || getPrimaryDateTime(shoot, rigSettings);
      return isShootComplete(shoot) || gameDate < relevanceWindowStart;
    }).length;
  }, [sortedShoots, rigSettings]);

  useEffect(() => {
    // Default to the page that starts at the first upcoming shoot, so past
    // games are reached by clicking "Previous".
    setPage(Math.floor(pastCount / pageSize));
  }, [viewMode, monthSelectedDate, shoots.length, pageSize, pastCount]);

  const totalPages = Math.max(1, Math.ceil(sortedShoots.length / pageSize));
  const visibleShoots = sortedShoots.slice(page * pageSize, page * pageSize + pageSize);

  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart);

  const shootsByDate = sortedShoots.reduce((acc, shoot) => {
    acc[shoot.date] = acc[shoot.date] || [];
    acc[shoot.date].push(shoot);
    return acc;
  }, {});

  const monthDayShootsList = monthSelectedDate
    ? (shootsByDate[monthSelectedDate] || []).filter((shoot) => !isShootCancelled(shoot))
    : [];

  const monthVisibleShoots = monthDayShootsList.slice(0, 3);

  const renderCard = (shoot) => {
    const gameDate = getScheduleDateTimes(shoot, matchRig(shoot, rigSettings)).game || getPrimaryDateTime(shoot, rigSettings);
    const isPast = isShootComplete(shoot) || gameDate < new Date();
    return (
      <div key={shoot.id} className={isPast ? 'opacity-50 grayscale-[0.3]' : ''}>
        <CountdownCard
          shoot={shoot}
          isAdmin={isAdmin}
          rigSettings={rigSettings}
          onUpdate={onUpdate}
          userEmail={userEmail}
          allUsers={allUsers}
          allShoots={allShoots}
          appSettings={appSettings}
          onContextMenu={onShootContextMenu ? (e) => onShootContextMenu(e, shoot) : undefined}
          onCardClick={onShootClick ? () => onShootClick(shoot) : undefined}
        />
      </div>
    );
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-lg bg-slate-800 p-0.5">
          <ViewButton active={viewMode === 'day'} icon={List} onClick={() => setViewMode('day')}>Day</ViewButton>
          <ViewButton active={viewMode === 'month'} icon={CalendarDays} onClick={() => setViewMode('month')}>Calendar</ViewButton>
          <ViewButton active={viewMode === 'tile'} icon={LayoutGrid} onClick={() => setViewMode('tile')}>Tile</ViewButton>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-500">
            {viewMode === 'tile' ? 'Showing max 4' : 'Showing max 3'}
          </div>
        </div>
      </div>

      {viewMode === 'month' && (
        <div>
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-slate-800/40 px-3 py-2">
            <button onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="rounded p-1 hover:bg-slate-700 transition-colors">
              <ChevronLeft className="h-4 w-4 text-slate-400" />
            </button>
            <div className="flex-1 text-center text-sm font-semibold text-slate-100">{format(monthDate, 'MMMM yyyy')}</div>
            <button onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="rounded p-1 hover:bg-slate-700 transition-colors">
              <ChevronRight className="h-4 w-4 text-slate-400" />
            </button>
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
                <button
                  key={ds}
                  onClick={() => setMonthSelectedDate(isSelected ? null : ds)}
                  className={`relative flex flex-col items-center rounded-lg py-1.5 transition-colors ${isSelected ? 'bg-blue-600' : isToday ? 'bg-slate-700' : dayShoots.length > 0 ? 'bg-slate-800 hover:bg-slate-700' : 'hover:bg-slate-800/60'}`}
                >
                  <span className={`text-xs font-medium ${isSelected ? 'text-slate-100' : isToday ? 'text-blue-400' : dayShoots.length > 0 ? 'text-slate-100' : 'text-gray-600'}`}>{format(day, 'd')}</span>
                  {dayShoots.length > 0 && <span className={`mt-0.5 text-xs font-bold ${isSelected ? 'text-blue-200' : 'text-blue-400'}`}>{dayShoots.length}</span>}
                </button>
              );
            })}
          </div>

          {monthSelectedDate && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">
                {format(new Date(`${monthSelectedDate}T12:00:00`), 'EEEE, MMM d')} - {monthDayShootsList.length} shoot{monthDayShootsList.length !== 1 ? 's' : ''}
              </p>
              {monthDayShootsList.length === 0 ? (
                <div className="py-4 text-center text-sm italic text-slate-500">No upcoming shoots on this day.</div>
              ) : (
                <div className="space-y-2">{monthVisibleShoots.map(renderCard)}</div>
              )}
            </div>
          )}
        </div>
      )}

      {viewMode !== 'month' && (
        <>
          {sortedShoots.length === 0 ? (
            <div className="py-8 text-center text-sm italic text-slate-500">No upcoming assigned shoots.</div>
          ) : (
            <div className={viewMode === 'tile' ? 'grid grid-cols-1 gap-3 xl:grid-cols-2' : 'space-y-2'}>
              {visibleShoots.map(renderCard)}
            </div>
          )}

          {sortedShoots.length > pageSize && (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-md border border-slate-800 px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-30">Previous</button>
              <span className="text-[10px] font-bold text-gray-600">SHOWING {page * pageSize + 1}-{Math.min((page + 1) * pageSize, sortedShoots.length)} OF {sortedShoots.length}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="rounded-md border border-blue-800/60 bg-blue-950/40 px-2.5 py-1 text-xs font-semibold text-blue-400 hover:bg-blue-950/40 disabled:opacity-30">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}