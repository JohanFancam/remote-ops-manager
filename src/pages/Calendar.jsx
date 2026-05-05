import React, { useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import ShootFormPanel, { emptyForm } from '../components/calendar/ShootFormPanel';
import ShootSidePanel from '../components/calendar/ShootSidePanel';
import ShootContextMenu from '../components/calendar/ShootContextMenu';

const STATUS_COLORS = {
  upcoming: 'bg-blue-600/80',
  confirmed: 'bg-green-600/80',
  in_progress: 'bg-yellow-500/80',
  completed: 'bg-gray-600/80',
  cancelled: 'bg-red-600/80',
};

export default function Calendar() {
  const { user, isAdmin } = useApp();
  const queryClient = useQueryClient();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedShoot, setSelectedShoot] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingShoot, setEditingShoot] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, shoot }

  const { data: shoots = [] } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list('-date', 500),
  });

  const { data: rigSettings = [] } = useQuery({
    queryKey: ['rigSettings'],
    queryFn: () => base44.entities.RigSetting.list(),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['pendingUsers'],
    queryFn: () => base44.entities.PendingUser.list(),
  });

  const { data: standbyDays = [] } = useQuery({
    queryKey: ['standbyDays'],
    queryFn: () => base44.entities.StandbyDay.list(),
  });

  const { data: appSettings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const slackMessages = Object.fromEntries(
    appSettings.filter(s => s.key?.startsWith('slack_')).map(s => [s.key, s.value])
  );

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['shoots'] });
  }, [queryClient]);

  // Calendar grid
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = [];
  let d = calStart;
  while (d <= calEnd) {
    days.push(d);
    d = addDays(d, 1);
  }

  const getShootsForDay = (day) => {
    const ds = format(day, 'yyyy-MM-dd');
    return shoots.filter(s => s.date === ds && s.status !== 'cancelled');
  };

  const handleUpdate = useCallback(async (id, data) => {
    await base44.entities.Shoot.update(id, data);
    refresh();
    if (selectedShoot?.id === id) {
      setSelectedShoot(prev => ({ ...prev, ...data }));
    }
  }, [refresh, selectedShoot]);

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
    setShowForm(true);
  };

  const handleDuplicate = async (shoot) => {
    const { id, created_date, updated_date, created_by, phase_status, ...rest } = shoot;
    await base44.entities.Shoot.create({ ...rest, status: 'upcoming' });
    setSelectedShoot(null);
    refresh();
  };

  const handleDelete = async (id) => {
    await base44.entities.Shoot.delete(id);
    setSelectedShoot(null);
    refresh();
  };

  const handleContextMenu = (e, shoot) => {
    if (!isAdmin) return;
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, shoot });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-gray-800" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold w-48 text-center">{format(currentDate, 'MMMM yyyy')}</h1>
            <Button variant="ghost" size="icon" className="text-gray-400 hover:text-white hover:bg-gray-800" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
              <ChevronRight className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white hover:bg-gray-800 text-xs ml-1" onClick={() => setCurrentDate(new Date())}>
              Today
            </Button>
          </div>
          {isAdmin && (
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => { setEditingShoot(null); setForm(emptyForm); setShowForm(true); }}>
              <Plus className="h-4 w-4 mr-1.5" /> New Shoot
            </Button>
          )}
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-xs text-gray-500 py-2 font-medium">{day}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 border-l border-t border-gray-800 rounded-lg overflow-hidden">
          {days.map((day, idx) => {
            const dayShoot = getShootsForDay(day);
            const isToday = isSameDay(day, new Date());
            const inMonth = isSameMonth(day, currentDate);
            return (
              <div
                key={idx}
                className={`min-h-[90px] md:min-h-[110px] border-r border-b border-gray-800 p-1.5 ${
                  inMonth ? 'bg-gray-900' : 'bg-gray-950/60'
                }`}
              >
                <div className={`text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full ${
                  isToday ? 'bg-blue-600 text-white' : inMonth ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-0.5">
                  {dayShoot.slice(0, 3).map(shoot => (
                    <button
                      key={shoot.id}
                      onClick={() => setSelectedShoot(shoot)}
                      onContextMenu={(e) => handleContextMenu(e, shoot)}
                      className={`w-full text-left text-xs px-1.5 py-0.5 rounded truncate text-white font-medium ${STATUS_COLORS[shoot.status] || 'bg-gray-700'} hover:opacity-80 transition-opacity`}
                      title={shoot.title}
                    >
                      {shoot.game_time ? `${shoot.game_time} ` : ''}{shoot.title}
                    </button>
                  ))}
                  {dayShoot.length > 3 && (
                    <p className="text-xs text-gray-500 px-1">+{dayShoot.length - 3} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4">
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <div key={status} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-sm ${color}`} />
              <span className="text-xs text-gray-500 capitalize">{status.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Side panels */}
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
          onUpdate={handleUpdate}
          onEdit={handleEdit}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onClose={() => setSelectedShoot(null)}
        />
      )}

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
    </div>
  );
}