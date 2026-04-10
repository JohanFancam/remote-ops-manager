import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Upload, Plus, X, List, Grid3x3 } from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, addMonths, subMonths, isToday
} from 'date-fns';
import CSVImportModal from '../components/shoots/CSVImportModal';
import { getDisplayName } from '../components/utils/nameUtils';
import ShootDetailPanel from '../components/calendar/ShootDetailPanel';
import { shortenTitle } from '../components/utils/scheduleUtils';

const statusColors = {
  upcoming: 'bg-blue-600',
  confirmed: 'bg-green-600',
  in_progress: 'bg-yellow-600',
  completed: 'bg-gray-600',
  cancelled: 'bg-red-700',
};

const isFancamShoot = (shoot, rigSettings) => {
  if (shoot.rig_type_override === 'Fancam') return true;
  if (shoot.rig_type_override === 'Data') return false;
  const rs = rigSettings.find(r => r.team && (
    (shoot.client || '').toLowerCase().includes(r.team.toLowerCase()) ||
    (shoot.title || '').toLowerCase().includes(r.team.toLowerCase())
  ));
  return rs?.rig_type === 'Fancam';
};

const DEFAULT_OFFSETS = { setup_offset: -150, pre_shoot_offset: -120, attention_offset: -30, sound_offset: -30 };
const emptyForm = { title: '', client: '', location: '', date: '', game_time: '', status: 'upcoming', description: '', ...DEFAULT_OFFSETS };

export default function Calendar() {
  const { user, isAdmin, isLevel1Admin } = useApp();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCSV, setShowCSV] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingShoot, setEditingShoot] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [selectedShoot, setSelectedShoot] = useState(null);
  const [mobileView, setMobileView] = useState('calendar');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shootId = params.get('shootId');
    if (shootId) setSelectedShoot({ id: shootId, _pending: true });
  }, []);

  const { data: shoots = [] } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list('-date', 500),
  });

  const { data: rigSettings = [] } = useQuery({
    queryKey: ['rigSettings'],
    queryFn: () => base44.entities.RigSetting.list(),
  });

  const { data: rawUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
  });

  const { data: presenceRecords = [] } = useQuery({
    queryKey: ['userPresence'],
    queryFn: () => base44.entities.UserPresence.list(),
  });

  // Merge User records with UserPresence so name lookups work for all admins
  const allUsers = useMemo(() => {
    const map = new Map();
    presenceRecords.forEach(p => {
      if (p.user_email) map.set(p.user_email, { email: p.user_email, full_name: p.user_name, role: p.user_role });
    });
    rawUsers.forEach(u => { if (u.email) map.set(u.email, u); });
    return Array.from(map.values());
  }, [rawUsers, presenceRecords]);

  const { data: appSettings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
  });

  const slackMessages = useMemo(() => {
    const msgs = {};
    appSettings.forEach(s => {
      if (s.key?.startsWith('slack_')) msgs[s.key.replace('slack_', '')] = s.value;
    });
    return msgs;
  }, [appSettings]);

  const standbyAdmins = allUsers.filter(u => u.standby === true && u.role === 'admin');

  const { data: standbyDays = [] } = useQuery({
    queryKey: ['standbyDays'],
    queryFn: () => base44.entities.StandbyDay.list('-date', 500),
  });

  useEffect(() => {
    if (selectedShoot?._pending && shoots.length > 0) {
      const found = shoots.find(s => s.id === selectedShoot.id);
      if (found) {
        setSelectedShoot(found);
        setSelectedDate(new Date(found.date + 'T12:00:00'));
      }
    }
  }, [shoots]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['shoots'] });

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = monthStart.getDay();

  const getShootsForDay = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return shoots
      .filter(s => s.date === dateStr)
      .sort((a, b) => (a.game_time || a.start_time || '').localeCompare(b.game_time || b.start_time || ''));
  };

  const selectedShoots = getShootsForDay(selectedDate);
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const isSelectedPast = selectedDateStr < todayStr;

  const handleAddShoot = async () => {
    if (!form.title || !form.date) return;
    const payload = {
      ...form,
      setup_offset: Number(form.setup_offset),
      pre_shoot_offset: Number(form.pre_shoot_offset),
      attention_offset: Number(form.attention_offset),
      sound_offset: Number(form.sound_offset),
    };
    if (editingShoot) {
      await base44.entities.Shoot.update(editingShoot.id, payload);
    } else {
      await base44.entities.Shoot.create(payload);
    }
    setForm(emptyForm);
    setShowAddForm(false);
    setEditingShoot(null);
    refresh();
  };

  const handleShootUpdate = async (id, data) => {
    await base44.entities.Shoot.update(id, data);
    refresh();
    setSelectedShoot(prev => prev && prev.id === id ? { ...prev, ...data } : prev);
  };

  const startEdit = (shoot) => {
    setEditingShoot(shoot);
    setForm({ ...emptyForm, ...shoot });
    setShowAddForm(true);
    // Don't close the selected shoot, just show edit form below
    setTimeout(() => {
      document.getElementById('edit-form-anchor')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleDeleteShoot = async (id) => {
    await base44.entities.Shoot.delete(id);
    setSelectedShoot(null);
    refresh();
  };

  const liveSelectedShoot = selectedShoot
    ? (shoots.find(s => s.id === selectedShoot.id) || selectedShoot)
    : null;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-3xl font-bold">Calendar</h1>
          <div className="flex gap-2 flex-wrap">
            <div className="flex md:hidden gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1">
              <button onClick={() => setMobileView('calendar')} className={`p-1.5 rounded ${mobileView === 'calendar' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}><Grid3x3 className="h-4 w-4" /></button>
              <button onClick={() => setMobileView('list')} className={`p-1.5 rounded ${mobileView === 'list' ? 'bg-blue-600 text-white' : 'text-gray-400'}`}><List className="h-4 w-4" /></button>
            </div>
            {isAdmin && (
              <>
                <Button onClick={() => { setShowAddForm(true); setEditingShoot(null); setForm({ ...emptyForm, date: format(selectedDate, 'yyyy-MM-dd') }); }} className="bg-blue-600 hover:bg-blue-700" size="sm">
                  <Plus className="h-4 w-4 mr-1" /> Add Shoot
                </Button>
                <Button onClick={() => setShowCSV(true)} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800" size="sm">
                  <Upload className="h-4 w-4 mr-1" /> Import CSV
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Mobile List View */}
        {mobileView === 'list' && (
          <div className="md:hidden mb-6">
            <div className="flex items-center justify-between mb-4">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="text-gray-400 hover:text-white hover:bg-gray-800">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <span className="text-white font-semibold">{format(currentMonth, 'MMMM yyyy')}</span>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="text-gray-400 hover:text-white hover:bg-gray-800">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
            <div className="space-y-2">
              {calendarDays.map(day => {
                const dayShoots = getShootsForDay(day);
                if (dayShoots.length === 0) return null;
                const dateStr = format(day, 'yyyy-MM-dd');
                const isPast = dateStr < todayStr;
                return (
                  <div key={day.toISOString()}>
                    <p className={`text-xs font-semibold uppercase tracking-wider mb-1 px-1 ${isToday(day) ? 'text-blue-400' : isPast ? 'text-gray-600' : 'text-gray-400'}`}>
                      {format(day, 'EEE, MMM d')}
                    </p>
                    {dayShoots.map(s => {
                      const isMyAssigned = s.assigned_operators?.includes(user?.email);
                      return (
                        <button key={s.id} onClick={() => { setSelectedShoot(s); setSelectedDate(day); setMobileView('calendar'); }}
                          className={`w-full text-left px-3 py-2.5 rounded-lg mb-1 flex items-center justify-between ${isPast ? 'bg-gray-800/40 opacity-60' : isMyAssigned ? 'bg-purple-900/40 border border-purple-700/50' : 'bg-gray-800'} hover:opacity-90 transition-opacity`}>
                          <div>
                            <p className="text-white text-sm font-medium">{shortenTitle(s.title)}</p>
                            {s.client && <p className="text-xs text-gray-400">{s.client}</p>}
                          </div>
                          {s.game_time && <span className="text-xs font-mono text-blue-300 flex-shrink-0 ml-2">{s.game_time}</span>}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Desktop: Full Width Calendar + Panel Below */}
        <div className={mobileView === 'list' ? 'hidden md:block' : ''}>
          {/* Full Width Calendar */}
          <Card className="bg-gray-900 border-gray-800 mb-4">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-gray-800">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="text-gray-400 hover:text-white hover:bg-gray-800">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <CardTitle className="text-white text-xl">{format(currentMonth, 'MMMM yyyy')}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="text-gray-400 hover:text-white hover:bg-gray-800">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-7 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array(startPadding).fill(null).map((_, i) => <div key={`p${i}`} />)}
                {calendarDays.map(day => {
                  const dateStr = format(day, 'yyyy-MM-dd');
                  const isPast = dateStr < todayStr;
                  const dayShoots = getShootsForDay(day);
                  const isSelected = isSameDay(day, selectedDate);
                  const today = isToday(day);
                  return (
                    <div
                      key={day.toISOString()}
                      onClick={() => { setSelectedDate(day); setSelectedShoot(null); }}
                      className={`min-h-[88px] p-1.5 rounded-lg cursor-pointer border transition-all
                        ${isSelected ? 'border-blue-500 bg-blue-950/60' : 'border-gray-800 hover:border-gray-600 hover:bg-gray-800/50'}
                        ${today ? 'ring-2 ring-blue-500' : ''}
                        ${isPast ? 'opacity-50' : ''}
                      `}
                    >
                      <div className={`text-xs font-semibold mb-1 ${today ? 'text-blue-400' : isPast ? 'text-gray-600' : 'text-gray-300'}`}>
                        {format(day, 'd')}
                      </div>
                      <div className="space-y-0.5">
                        {dayShoots.slice(0, 3).map(s => {
                          const isMyAssigned = s.assigned_operators?.includes(user?.email);
                          const fancam = isFancamShoot(s, rigSettings);
                          const cellColor = isPast ? 'bg-gray-700 opacity-60' : isMyAssigned ? 'bg-purple-600' : fancam ? 'bg-orange-500' : (statusColors[s.status] || 'bg-blue-600');
                          return (
                            <div key={s.id} className={`text-xs truncate px-1 py-0.5 rounded text-white ${cellColor}`}>
                              {s.game_time ? `${s.game_time} ` : ''}{shortenTitle(s.title)}
                            </div>
                          );
                        })}
                        {dayShoots.length > 3 && <div className="text-xs text-gray-500">+{dayShoots.length - 3}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Legend */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 mb-4">
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Legend</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1.5">
              {[
                { label: 'Upcoming', color: 'bg-blue-600' },
                { label: 'Confirmed', color: 'bg-green-600' },
                { label: 'In Progress', color: 'bg-yellow-600' },
                { label: 'Completed', color: 'bg-gray-600' },
                { label: 'My Assigned', color: 'bg-purple-600' },
                { label: 'Fancam', color: 'bg-orange-500' },
                { label: 'Past', color: 'bg-gray-700 opacity-50' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded ${l.color}`} />
                  <span className="text-xs text-gray-400">{l.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Panel below calendar */}
          {liveSelectedShoot ? (
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="border-b border-gray-800 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-white text-base truncate">{liveSelectedShoot.title}</CardTitle>
                    <p className="text-xs text-gray-400 mt-0.5">{format(selectedDate, 'EEE, MMM d yyyy')}</p>
                  </div>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-white ml-2" onClick={() => setSelectedShoot(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                {isAdmin && (
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-400 hover:text-white hover:bg-gray-800" onClick={() => startEdit(liveSelectedShoot)}>Edit</Button>
                    <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400 hover:bg-gray-800" onClick={() => handleDeleteShoot(liveSelectedShoot.id)}>Delete</Button>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-4">
                <ShootDetailPanel
                  shoot={liveSelectedShoot}
                  user={user}
                  isAdmin={isAdmin}
                  rigSettings={rigSettings}
                  allShoots={shoots}
                  allUsers={allUsers}
                  standbyAdmins={standbyAdmins}
                  slackMessages={slackMessages}
                  onUpdate={handleShootUpdate}
                />
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="border-b border-gray-800 pb-3">
                <CardTitle className="text-white text-base">
                  {format(selectedDate, 'EEEE, MMMM d')}
                  {isSelectedPast && <span className="text-xs text-gray-500 ml-2 font-normal">(past)</span>}
                </CardTitle>
                <p className="text-xs text-gray-500">{selectedShoots.length} shoot(s) — click to view details</p>
                {/* Standby for this day — show all entries */}
                {(() => {
                  const dayStandbys = standbyDays.filter(s => {
                    const sd = s.start_date || s.date;
                    const ed = s.end_date || sd;
                    return sd && sd <= selectedDateStr && selectedDateStr <= ed;
                  });
                  if (dayStandbys.length === 0) return null;
                  return (
                    <div className="mt-2 bg-yellow-950/30 border border-yellow-800/40 rounded-lg px-3 py-2 space-y-1">
                      <span className="text-yellow-500 text-xs font-medium">📞 Standby</span>
                      {dayStandbys.map((sd, i) => {
                        const sdUser = allUsers.find(u => u.email === sd.admin_email);
                        return (
                          <div key={sd.id || i} className="flex items-center gap-2 flex-wrap">
                            <span className="text-yellow-200 text-xs font-medium">{getDisplayName(sdUser, sd.admin_email, sd.admin_name)}</span>
                            {(sd.start_time || sd.end_time) && (
                              <span className="text-yellow-600 text-xs">
                                {sd.start_time && `from ${sd.start_time}`}{sd.start_time && sd.end_time && ' → '}{sd.end_time && `until ${sd.end_time}`}
                              </span>
                            )}
                            {dayStandbys.length > 1 && i < dayStandbys.length - 1 && (
                              <span className="text-yellow-800 text-xs">then →</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </CardHeader>
              <CardContent className="p-0">
                {selectedShoots.length === 0 ? (
                  <p className="text-gray-500 text-sm p-6">Nothing scheduled for this day.</p>
                ) : (
                  <div className="divide-y divide-gray-800">
                    {selectedShoots.map(shoot => {
                      const isPast = shoot.date < todayStr;
                      const isAssigned = shoot.assigned_operators?.includes(user?.email);
                      const isPending = shoot.pending_operators?.includes(user?.email);
                      // Shoot is "taken" when a non-admin operator is already assigned and current user is not assigned
                      const nonAdminAssigned = (shoot.assigned_operators || []).filter(e => {
                        const u = allUsers.find(u2 => u2.email === e);
                        return !u || u.role !== 'admin';
                      });
                      const isTaken = !isAdmin && nonAdminAssigned.length > 0 && !isAssigned;

                      if (isTaken && !isAdmin) {
                        // Grayed out — show info but not clickable for remote users
                        return (
                          <div key={shoot.id} className="p-4 opacity-40 cursor-not-allowed">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-400 text-sm truncate">{shortenTitle(shoot.title)}</p>
                                {shoot.game_time && <p className="text-xs font-mono text-gray-500 mt-0.5">{shoot.game_time}</p>}
                                {shoot.location && <p className="text-xs text-gray-600 mt-0.5">{shoot.location}</p>}
                              </div>
                              <span className="text-xs px-2 py-0.5 rounded-full border bg-gray-700/50 text-gray-500 border-gray-700 flex-shrink-0 ml-2">Taken</span>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <button
                          key={shoot.id}
                          onClick={() => setSelectedShoot(shoot)}
                          className={`w-full text-left p-4 hover:bg-gray-800/60 transition-colors ${isPast ? 'opacity-60' : ''}`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-white text-sm truncate">{shortenTitle(shoot.title)}</p>
                              {shoot.game_time && <p className="text-xs font-mono text-blue-300 mt-0.5">{shoot.game_time}</p>}
                              {shoot.location && <p className="text-xs text-gray-500 mt-0.5">{shoot.location}</p>}
                            </div>
                            <div className="flex flex-col items-end gap-1 ml-2">
                              <span className={`text-xs px-2 py-0.5 rounded-full border ${
                                isPast ? 'bg-gray-700/50 text-gray-500 border-gray-700' :
                                shoot.status === 'confirmed' ? 'bg-green-500/20 text-green-400 border-green-500/30' :
                                'bg-blue-500/20 text-blue-400 border-blue-500/30'
                              }`}>{shoot.status}</span>
                              {isAssigned && <span className="text-xs text-green-400">✓ Assigned</span>}
                              {isPending && <span className="text-xs text-yellow-400">Pending</span>}
                                      {shoot.assigned_operators?.length > 0 && (
                                <div className="flex flex-col items-end gap-0.5">
                                  {shoot.assigned_operators.map(email => {
                                    const u = allUsers.find(u2 => u2.email === email);
                                    return (
                                      <span key={email} className="text-xs text-gray-400">
                                        {getDisplayName(u, email)}
                                        {u?.role === 'admin' ? ' (admin)' : ''}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Edit form — anchored below panel */}
          {isAdmin && showAddForm && (
            <div id="edit-form-anchor" className="mt-4">
              <Card className="bg-gray-900 border-blue-700">
                <CardHeader className="border-b border-gray-800 py-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-white text-base">{editingShoot ? 'Edit Shoot' : 'New Shoot'}</CardTitle>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-white" onClick={() => { setShowAddForm(false); setEditingShoot(null); setForm(emptyForm); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <Input placeholder="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
                    <Input placeholder="Client / Team" value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
                    <Input placeholder="Venue / Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
                    <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="bg-gray-800 border-gray-700 text-white" />
                    <input type="time" value={form.game_time} onChange={e => setForm({ ...form, game_time: e.target.value })} className="bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2 h-9 text-sm w-full" />
                    <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                      <SelectTrigger className="bg-gray-800 border-gray-700 text-white"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-gray-900 border-gray-700">
                        {['upcoming', 'confirmed', 'in_progress', 'completed', 'cancelled'].map(s => (
                          <SelectItem key={s} value={s} className="text-white capitalize">{s.replace('_', ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input placeholder="Notes / Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 md:col-span-3" />
                  </div>
                  <div className="bg-gray-800/60 rounded-lg p-3 mb-3">
                    <p className="text-xs text-gray-400 mb-2 font-medium">Schedule Offsets (minutes before game time)</p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { key: 'setup_offset', label: 'Setup' },
                        { key: 'pre_shoot_offset', label: 'Pre-Shoot' },
                        { key: 'attention_offset', label: 'Attention' },
                        { key: 'sound_offset', label: 'Sound' },
                      ].map(({ key, label }) => (
                        <div key={key}>
                          <label className="text-xs text-gray-500 block mb-1">{label}</label>
                          <Input type="number" value={form[key]} onChange={e => setForm({ ...form, [key]: Number(e.target.value) })} className="bg-gray-700 border-gray-600 text-white h-8 text-sm" />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={handleAddShoot} className="bg-blue-600 hover:bg-blue-700">{editingShoot ? 'Save Changes' : 'Create Shoot'}</Button>
                    <Button variant="outline" onClick={() => { setShowAddForm(false); setEditingShoot(null); setForm(emptyForm); }} className="border-gray-700 text-gray-300 hover:bg-gray-800">Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>

      <CSVImportModal open={showCSV} onClose={() => setShowCSV(false)} onImported={refresh} />
    </div>
  );
}