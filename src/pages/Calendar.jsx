import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Button } from '@/components/ui/button';
import { Plus, Upload, CalendarDays, List, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isToday, parseISO } from 'date-fns';
import ShootFormPanel, { emptyForm } from '../components/calendar/ShootFormPanel';
import ShootSidePanel from '../components/calendar/ShootSidePanel';
import ShootContextMenu from '../components/calendar/ShootContextMenu';
import CSVImportModal from '../components/shoots/CSVImportModal';

const STATUS_COLORS = {
  upcoming:    'bg-blue-600/80 border-blue-500/60 text-white',
  confirmed:   'bg-green-700/80 border-green-500/60 text-white',
  in_progress: 'bg-yellow-600/80 border-yellow-500/60 text-white',
  completed:   'bg-gray-600/60 border-gray-500/40 text-gray-300',
  cancelled:   'bg-red-900/60 border-red-700/40 text-red-300',
};

const DOT_COLORS = {
  upcoming:    'bg-blue-400',
  confirmed:   'bg-green-400',
  in_progress: 'bg-yellow-400',
  completed:   'bg-gray-500',
  cancelled:   'bg-red-500',
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ShootChip({ shoot, onClick, onContextMenu }) {
  const colorClass = STATUS_COLORS[shoot.status] || STATUS_COLORS.upcoming;
  const dotClass = DOT_COLORS[shoot.status] || DOT_COLORS.upcoming;

  return (
    <button
      onClick={(e) => { e.stopPropagation(); onClick(shoot); }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onContextMenu(e, shoot); }}
      className={`w-full text-left px-1.5 py-0.5 rounded border text-[10px] leading-tight mb-0.5 truncate ${colorClass} hover:brightness-125 transition-all`}
      title={`${shoot.game_time ? shoot.game_time + ' ' : ''}${shoot.title}`}
    >
      <span className="flex items-center gap-1 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotClass}`} />
        <span className="truncate">
          {shoot.game_time && <span className="opacity-80 mr-0.5">{shoot.game_time}</span>}
          {shoot.title}
        </span>
      </span>
      {shoot.assigned_operators?.length > 0 && (
        <span className="block text-[9px] opacity-60 truncate pl-2.5">
          {shoot.assigned_operators[0]}
        </span>
      )}
    </button>
  );
}

function WeekListView({ shoots, standbyByDate, isAdmin, onShootClick, onContextMenu, monthDate }) {
  // Show all days in the current month
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const shootsByDate = useMemo(() => {
    const map = {};
    shoots.forEach(s => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }, [shoots]);

  return (
    <div className="space-y-1">
      {days.map(day => {
        const ds = format(day, 'yyyy-MM-dd');
        const dayShoots = shootsByDate[ds] || [];
        const standby = standbyByDate[ds];
        const today = isToday(day);

        return (
          <div key={ds} className={`flex gap-3 rounded-lg px-3 py-2 ${today ? 'bg-blue-950/30 border border-blue-800/40' : 'border border-transparent hover:bg-gray-800/40'}`}>
            <div className="w-20 flex-shrink-0 pt-0.5">
              <span className={`text-xs font-semibold ${today ? 'text-blue-400' : 'text-gray-500'}`}>{format(day, 'EEE d')}</span>
            </div>
            <div className="flex-1 min-w-0">
              {standby && (
                <div className="text-[10px] text-teal-400 mb-1">Standby: {standby.admin_name || standby.admin_email}</div>
              )}
              {dayShoots.length === 0 && !standby && (
                <span className="text-[11px] text-gray-700 italic">—</span>
              )}
              {dayShoots.map(shoot => (
                <div
                  key={shoot.id}
                  className="flex items-center gap-2 cursor-pointer hover:bg-gray-700/40 rounded px-1 py-0.5"
                  onClick={() => onShootClick(shoot)}
                  onContextMenu={(e) => { e.preventDefault(); onContextMenu(e, shoot); }}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${DOT_COLORS[shoot.status] || DOT_COLORS.upcoming}`} />
                  <span className="text-xs text-gray-300 font-medium">
                    {shoot.game_time && <span className="text-gray-500 mr-1.5">{shoot.game_time}</span>}
                    {shoot.title}
                  </span>
                  {shoot.assigned_operators?.[0] && (
                    <span className="text-[10px] text-gray-600 truncate">{shoot.assigned_operators[0]}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Calendar() {
  const { user, isAdmin } = useApp();
  const queryClient = useQueryClient();

  const [viewMode, setViewMode] = useState('calendar');
  const [monthDate, setMonthDate] = useState(new Date());
  const [showForm, setShowForm] = useState(false);
  const [editingShoot, setEditingShoot] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedShoot, setSelectedShoot] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);
  const [showCSV, setShowCSV] = useState(false);

  const { data: shoots = [] } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list('-date', 1000),
  });

  const { data: rigSettings = [] } = useQuery({
    queryKey: ['rigSettings'],
    queryFn: () => base44.entities.RigSetting.list(),
  });

  const { data: presenceRecords = [] } = useQuery({
    queryKey: ['userPresence'],
    queryFn: () => base44.entities.UserPresence.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: standbyDays = [] } = useQuery({
    queryKey: ['standbyDays'],
    queryFn: () => base44.entities.StandbyDay.list(),
  });

  const { data: appSettings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const allUsers = useMemo(() => {
    const map = new Map();
    presenceRecords.forEach(p => {
      if (p.user_email) map.set(p.user_email, { email: p.user_email, full_name: p.user_name, role: p.user_role });
    });
    users.forEach(u => { if (u.email) map.set(u.email, u); });
    return Array.from(map.values());
  }, [users, presenceRecords]);

  const slackMessages = useMemo(() => Object.fromEntries(
    appSettings.filter(s => s.key?.startsWith('slack_')).map(s => [s.key, s.value])
  ), [appSettings]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['shoots'] });
  }, [queryClient]);

  // Build a map of date -> standby info
  const standbyByDate = useMemo(() => {
    const map = {};
    standbyDays.forEach(sd => {
      // Support both multi-day and legacy single-day
      const start = sd.start_date || sd.date;
      const end = sd.end_date || sd.date || start;
      if (!start) return;
      const startD = parseISO(start);
      const endD = parseISO(end);
      const days = eachDayOfInterval({ start: startD, end: endD });
      days.forEach(d => {
        const ds = format(d, 'yyyy-MM-dd');
        map[ds] = sd;
      });
    });
    return map;
  }, [standbyDays]);

  const shootsByDate = useMemo(() => {
    const map = {};
    shoots.forEach(s => {
      if (!map[s.date]) map[s.date] = [];
      map[s.date].push(s);
    });
    return map;
  }, [shoots]);

  // Month grid
  const monthStart = startOfMonth(monthDate);
  const monthEnd = endOfMonth(monthDate);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = getDay(monthStart);

  const handleShootUpdate = useCallback(async (id, data) => {
    await base44.entities.Shoot.update(id, data);
    refresh();
    setSelectedShoot(prev => prev?.id === id ? { ...prev, ...data } : prev);
  }, [refresh]);

  const handleSave = async () => {
    if (!form.title || !form.date) return;
    if (editingShoot) {
      await base44.entities.Shoot.update(editingShoot.id, form);
    } else {
      await base44.entities.Shoot.create(form);
    }
    setShowForm(false);
    setEditingShoot(null);
    setForm(emptyForm);
    refresh();
  };

  const handleEdit = (shoot) => {
    setEditingShoot(shoot);
    setForm({ ...emptyForm, ...shoot });
    setSelectedShoot(null);
    setContextMenu(null);
    setShowForm(true);
  };

  const handleDuplicate = async (shoot) => {
    const { id, created_date, updated_date, created_by, phase_status, ...rest } = shoot;
    await base44.entities.Shoot.create({ ...rest, status: 'upcoming' });
    setSelectedShoot(null);
    setContextMenu(null);
    refresh();
  };

  const handleDelete = async (id) => {
    await base44.entities.Shoot.delete(id);
    setSelectedShoot(null);
    setContextMenu(null);
    refresh();
  };

  const handleShootClick = (shoot) => {
    setSelectedShoot(shoot);
    setContextMenu(null);
  };

  const handleContextMenu = (e, shoot) => {
    if (!isAdmin) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, shoot });
  };

  const monthShootsForView = useMemo(() => {
    const start = format(monthStart, 'yyyy-MM-dd');
    const end = format(monthEnd, 'yyyy-MM-dd');
    return shoots.filter(s => s.date >= start && s.date <= end);
  }, [shoots, monthStart, monthEnd]);

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 md:px-6 pt-5 pb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Calendar</h1>
          <p className="text-xs text-gray-500 mt-0.5">Calendar is the main view. Operators can mark full-day unavailability here; admins see those indicators.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex rounded-lg bg-gray-800 p-0.5">
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'calendar' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <CalendarDays className="h-3.5 w-3.5" /> Calendar
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}
            >
              <List className="h-3.5 w-3.5" /> Week List
            </button>
          </div>

          {isAdmin && (
            <>
              <Button
                className="bg-blue-600 hover:bg-blue-700 h-8 text-xs gap-1.5"
                onClick={() => { setEditingShoot(null); setForm(emptyForm); setShowForm(true); }}
              >
                <Plus className="h-3.5 w-3.5" /> Add Shoot
              </Button>
              <Button
                variant="outline"
                className="border-gray-700 text-gray-300 hover:bg-gray-800 h-8 text-xs gap-1.5"
                onClick={() => setShowCSV(true)}
              >
                <Upload className="h-3.5 w-3.5" /> Import CSV
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-center gap-4 pb-4">
        <button onClick={() => setMonthDate(d => subMonths(d, 1))} className="rounded-lg p-1.5 hover:bg-gray-800 transition-colors">
          <ChevronLeft className="h-4 w-4 text-gray-400" />
        </button>
        <div className="text-center">
          <p className="text-base font-semibold text-white">{format(monthDate, 'MMMM yyyy')}</p>
          <button
            onClick={() => setMonthDate(new Date())}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Jump to today
          </button>
        </div>
        <button onClick={() => setMonthDate(d => addMonths(d, 1))} className="rounded-lg p-1.5 hover:bg-gray-800 transition-colors">
          <ChevronRight className="h-4 w-4 text-gray-400" />
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 px-2 md:px-4 pb-4">
        {viewMode === 'calendar' ? (
          <>
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAYS.map(d => (
                <div key={d} className="py-1.5 text-center text-xs font-medium text-gray-500">{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-px bg-gray-800 border border-gray-800 rounded-xl overflow-hidden">
              {/* Padding cells */}
              {Array.from({ length: startPadding }).map((_, i) => (
                <div key={`pad-${i}`} className="bg-gray-950 min-h-[100px] md:min-h-[120px]" />
              ))}

              {monthDays.map(day => {
                const ds = format(day, 'yyyy-MM-dd');
                const dayShoots = (shootsByDate[ds] || []).sort((a, b) => (a.game_time || '').localeCompare(b.game_time || ''));
                const standby = standbyByDate[ds];
                const today = isToday(day);

                return (
                  <div
                    key={ds}
                    className={`bg-gray-950 min-h-[100px] md:min-h-[120px] p-1.5 flex flex-col ${today ? 'ring-1 ring-inset ring-blue-600' : ''}`}
                  >
                    {/* Day number */}
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-semibold w-5 h-5 flex items-center justify-center rounded-full ${today ? 'bg-blue-600 text-white' : 'text-gray-400'}`}>
                        {format(day, 'd')}
                      </span>
                      {standby && (
                        <span className="text-[9px] text-teal-400 leading-tight text-right max-w-[70%] truncate" title={`Standby: ${standby.admin_name || standby.admin_email}`}>
                          Standby: {standby.admin_name || standby.admin_email}
                        </span>
                      )}
                    </div>

                    {/* Shoot chips */}
                    <div className="flex-1 min-h-0 overflow-hidden">
                      {dayShoots.slice(0, 4).map(shoot => (
                        <ShootChip
                          key={shoot.id}
                          shoot={shoot}
                          onClick={handleShootClick}
                          onContextMenu={handleContextMenu}
                        />
                      ))}
                      {dayShoots.length > 4 && (
                        <span className="text-[9px] text-gray-500 pl-1">+{dayShoots.length - 4} more</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="max-w-3xl mx-auto">
            <WeekListView
              shoots={monthShootsForView}
              standbyByDate={standbyByDate}
              isAdmin={isAdmin}
              onShootClick={handleShootClick}
              onContextMenu={handleContextMenu}
              monthDate={monthDate}
            />
          </div>
        )}
      </div>

      {/* Shoot detail side panel */}
      {selectedShoot && !showForm && (
        <ShootSidePanel
          shoot={selectedShoot}
          user={user}
          isAdmin={isAdmin}
          rigSettings={rigSettings}
          allShoots={shoots}
          allUsers={allUsers}
          standbyAdmins={standbyDays}
          slackMessages={slackMessages}
          onUpdate={handleShootUpdate}
          onEdit={handleEdit}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onClose={() => setSelectedShoot(null)}
        />
      )}

      {/* New/Edit shoot form */}
      {showForm && (
        <ShootFormPanel
          form={form}
          setForm={setForm}
          editingShoot={editingShoot}
          onSave={handleSave}
          onClose={() => { setShowForm(false); setEditingShoot(null); setForm(emptyForm); }}
        />
      )}

      {/* Right-click context menu */}
      {contextMenu && (
        <ShootContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          shoot={contextMenu.shoot}
          onEdit={handleEdit}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* CSV Import */}
      <CSVImportModal
        open={showCSV}
        onClose={() => setShowCSV(false)}
        onImported={() => { refresh(); setShowCSV(false); }}
      />
    </div>
  );
}