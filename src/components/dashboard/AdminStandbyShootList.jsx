import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, List, LayoutGrid } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from 'date-fns';
import CountdownCard from './CountdownCard';
import { getScheduleDateTimes } from '../utils/scheduleUtils';
import { matchRig } from '../utils/rigUtils';
import { normalizeEmail } from '@/utils/assignmentApproval';

function getPrimaryDateTime(shoot, rigSettings = []) {
  const phaseDates = getScheduleDateTimes(shoot, matchRig(shoot, rigSettings));
  return phaseDates.setup || phaseDates.pre_shoot || phaseDates.game || new Date(`${shoot.date}T${shoot.game_time || '23:59'}`);
}

function isCompleted(shoot) {
  return !!shoot?.phase_status?.shoot_complete || shoot?.status === 'completed';
}

function isCancelled(shoot) {
  return shoot?.status === 'cancelled';
}

function getShootDateTime(shoot, rigSettings = []) {
  return getScheduleDateTimes(shoot, matchRig(shoot, rigSettings)).game || new Date(`${shoot.date}T${shoot.game_time || '23:59'}`);
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
    <button onClick={onClick} className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${active ? 'bg-orange-500 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'}`}>
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
  isAdmin = false,
  appSettings = [],
}) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [viewMode, setViewMode] = useState('tile');
  const [page, setPage] = useState(0);
  const [monthDate, setMonthDate] = useState(new Date());
  const [monthSelectedDate, setMonthSelectedDate] = useState(null);

  const myStandbyWindows = useMemo(() => {
    const me = normalizeEmail(userEmail);
    return standbyDays
      .map((sd) => {
        const startDate = sd.start_date || sd.date;
        const endDate = sd.end_date || startDate;
        if (!startDate) return null;
        if (!me || normalizeEmail(sd.admin_email) !== me) return null;
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
        const shootDt = getShootDateTime(shoot, rigSettings);
        const covered = myStandbyWindows.some((w) => shootDt >= w.startDt && shootDt <= w.endDt);
        if (covered && !seen.has(shoot.id)) seen.set(shoot.id, shoot);
      });

    const now = new Date();
    const relevanceWindowStart = new Date(now.getTime() - 6 * 60 * 60 * 1000);

    return Array.from(seen.values())
      .filter((shoot) => !isCompleted(shoot) && getShootDateTime(shoot, rigSettings) >= relevanceWindowStart)
      .sort((a, b) => getPrimaryDateTime(a, rigSettings) - getPrimaryDateTime(b, rigSettings));
  }, [shoots, myStandbyWindows, rigSettings]);

  const pageSize = viewMode === 'tile' ? 4 : 3;

  useEffect(() => {
    setPage(0);
  }, [viewMode, monthSelectedDate, shoots.length, standbyDays.length, userEmail]);

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

  const renderCard = (shoot) => {
    return (
      <div key={shoot.id} className="h-full">
        <CountdownCard
          shoot={shoot}
          isAdmin={isAdmin}
          rigSettings={rigSettings}
          onUpdate={onUpdate}
          userEmail={userEmail}
          allUsers={allUsers}
          showReadyMessage={false}
          appSettings={appSettings}
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
        <div className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-xs text-slate-500">
          {viewMode === 'tile' ? 'Showing max 4' : 'Showing max 3'}
        </div>
      </div>

      {viewMode === 'month' && (
        <div>
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-slate-800/40 px-3 py-2">
            <button onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="rounded p-1 hover:bg-slate-700 transition-colors"><ChevronLeft className="h-4 w-4 text-slate-400" /></button>
            <div className="flex-1 text-center text-sm font-semibold text-slate-100">{format(monthDate, 'MMMM yyyy')}</div>
            <button onClick={() => setMonthDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="rounded p-1 hover:bg-slate-700 transition-colors"><ChevronRight className="h-4 w-4 text-slate-400" /></button>
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
                <button key={ds} onClick={() => setMonthSelectedDate(isSelected ? null : ds)} className={`relative flex flex-col items-center rounded-lg py-1.5 transition-colors ${isSelected ? 'bg-orange-500' : isToday ? 'bg-slate-700' : dayShoots.length > 0 ? 'bg-slate-800 hover:bg-slate-700' : 'hover:bg-slate-800/60'}`}>
                  <span className={`text-xs font-medium ${isSelected ? 'text-slate-100' : isToday ? 'text-orange-400' : dayShoots.length > 0 ? 'text-slate-100' : 'text-gray-600'}`}>{format(day, 'd')}</span>
                  {dayShoots.length > 0 && <span className={`mt-0.5 text-xs font-bold ${isSelected ? 'text-orange-100' : 'text-orange-400'}`}>{dayShoots.length}</span>}
                </button>
              );
            })}
          </div>
          {monthSelectedDate && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-slate-500">{format(new Date(`${monthSelectedDate}T12:00:00`), 'EEEE, MMM d')} - {monthDayShootsList.length} standby shoot{monthDayShootsList.length !== 1 ? 's' : ''}</p>
              {monthDayShootsList.length === 0 ? <div className="py-4 text-center text-sm italic text-slate-500">No upcoming standby coverage shoots on this day.</div> : <div className="space-y-2">{monthVisibleShoots.map(renderCard)}</div>}
            </div>
          )}
        </div>
      )}

      {viewMode !== 'month' && (
        <>
          {allStandbyShoots.length === 0 ? (
            <div className="py-6 text-center text-sm italic text-slate-500">No upcoming shoots during standby coverage.</div>
          ) : (
            <div className={viewMode === 'tile' ? 'grid grid-cols-1 gap-3 xl:grid-cols-2 xl:items-stretch' : 'space-y-2'}>{visibleShoots.map(renderCard)}</div>
          )}
          {allStandbyShoots.length > pageSize && (
            <div className="mt-3 flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-3 py-2">
              <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="rounded-md border border-slate-800 px-2.5 py-1 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-30">Previous</button>
              <span className="text-[10px] font-bold text-gray-600">SHOWING {page * pageSize + 1}-{Math.min((page + 1) * pageSize, allStandbyShoots.length)} OF {allStandbyShoots.length}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="rounded-md border border-orange-700/60 bg-orange-950/40 px-2.5 py-1 text-xs font-semibold text-orange-400 hover:bg-orange-950/50 disabled:opacity-30">Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
