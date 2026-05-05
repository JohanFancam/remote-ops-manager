import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { format } from 'date-fns';
import AdminDayShootView from '../components/dashboard/AdminDayShootView';
import ShootFormPanel, { emptyForm } from '../components/calendar/ShootFormPanel';
import ShootSidePanel from '../components/calendar/ShootSidePanel';
import ShootContextMenu from '../components/calendar/ShootContextMenu';

export default function Calendar() {
  const { user, isAdmin } = useApp();
  const queryClient = useQueryClient();

  const [showForm, setShowForm] = useState(false);
  const [editingShoot, setEditingShoot] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedShoot, setSelectedShoot] = useState(null);
  const [contextMenu, setContextMenu] = useState(null);

  const { data: shoots = [] } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list('-date', 500),
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
    presenceRecords.forEach((p) => {
      if (p.user_email) map.set(p.user_email, { email: p.user_email, full_name: p.user_name, role: p.user_role });
    });
    users.forEach((u) => { if (u.email) map.set(u.email, u); });
    return Array.from(map.values());
  }, [users, presenceRecords]);

  const slackMessages = useMemo(() => Object.fromEntries(
    appSettings.filter(s => s.key?.startsWith('slack_')).map(s => [s.key, s.value])
  ), [appSettings]);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['shoots'] });
  }, [queryClient]);

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

  // Patch AdminDayShootView's CountdownCards to support right-click
  // We pass shoots as-is; right-click is wired via a wrapper div capturing contextmenu events
  const visibleShoots = useMemo(() =>
    shoots.filter(s => s.status !== 'cancelled'),
    [shoots]
  );

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Calendar</h1>
            <p className="text-xs text-gray-500 mt-0.5">All shoots — {format(new Date(), 'MMMM yyyy')}</p>
          </div>
          {isAdmin && (
            <Button
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => { setEditingShoot(null); setForm(emptyForm); setShowForm(true); }}
            >
              <Plus className="h-4 w-4 mr-1.5" /> New Shoot
            </Button>
          )}
        </div>

        {/* Calendar view — wrapped to capture right-clicks on shoot cards */}
        <div
          className="rounded-2xl border border-gray-800 bg-gray-900/70 p-3 md:p-4"
          onContextMenu={(e) => {
            // Only intercept if admin — find closest shoot card data
            if (!isAdmin) return;
          }}
        >
          <AdminDayShootView
            shoots={visibleShoots}
            isAdmin={isAdmin}
            rigSettings={rigSettings}
            onUpdate={handleShootUpdate}
            userEmail={user?.email}
            allUsers={allUsers}
            onShootContextMenu={isAdmin ? (e, shoot) => {
              e.preventDefault();
              setContextMenu({ x: e.clientX, y: e.clientY, shoot });
            } : undefined}
            onShootClick={isAdmin ? (shoot) => setSelectedShoot(shoot) : undefined}
          />
        </div>
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
    </div>
  );
}