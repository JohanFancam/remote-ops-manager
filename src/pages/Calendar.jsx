import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Camera, Upload, Plus, X, Edit2, ChevronDown } from 'lucide-react';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, addMonths, subMonths, isToday
} from 'date-fns';
import { getSchedule, getGameDateTime } from '../components/utils/scheduleUtils';
import CSVImportModal from '../components/shoots/CSVImportModal';

const statusColors = {
  upcoming: 'bg-blue-600',
  confirmed: 'bg-green-600',
  in_progress: 'bg-yellow-600',
  completed: 'bg-gray-600',
  cancelled: 'bg-red-700',
};

const statusBadge = {
  upcoming: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  confirmed: 'bg-green-500/20 text-green-400 border-green-500/30',
  in_progress: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  completed: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  cancelled: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const DEFAULT_OFFSETS = { setup_offset: -150, pre_shoot_offset: -120, attention_offset: -30, sound_offset: -30 };

const emptyForm = {
  title: '', client: '', location: '', date: '', game_time: '',
  status: 'upcoming', description: '',
  ...DEFAULT_OFFSETS
};

export default function Calendar() {
  const { user, isAdmin } = useApp();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showCSV, setShowCSV] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingShoot, setEditingShoot] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [expandedShoot, setExpandedShoot] = useState(null);

  const { data: shoots = [] } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list('-date', 500),
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list('-date', 200),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['shoots'] });
    queryClient.invalidateQueries({ queryKey: ['events'] });
  };

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = monthStart.getDay();

  const getShootsForDay = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    let dayShots = shoots.filter(s => s.date === dateStr);
    if (!isAdmin) dayShots = dayShots.filter(s => s.assigned_operators?.includes(user?.email));
    return dayShots.sort((a, b) => (a.game_time || a.start_time || '').localeCompare(b.game_time || b.start_time || ''));
  };

  const getEventsForDay = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return events.filter(e => e.date === dateStr);
  };

  const selectedShoots = getShootsForDay(selectedDate).sort((a, b) =>
    (a.game_time || a.start_time || '').localeCompare(b.game_time || b.start_time || '')
  );
  const selectedEvents = getEventsForDay(selectedDate);

  const handleAddShoot = async () => {
    if (!form.title || !form.date) return;
    if (editingShoot) {
      await base44.entities.Shoot.update(editingShoot.id, {
        ...form,
        setup_offset: Number(form.setup_offset),
        pre_shoot_offset: Number(form.pre_shoot_offset),
        attention_offset: Number(form.attention_offset),
        sound_offset: Number(form.sound_offset),
      });
    } else {
      await base44.entities.Shoot.create({
        ...form,
        setup_offset: Number(form.setup_offset),
        pre_shoot_offset: Number(form.pre_shoot_offset),
        attention_offset: Number(form.attention_offset),
        sound_offset: Number(form.sound_offset),
      });
    }
    setForm(emptyForm);
    setShowAddForm(false);
    setEditingShoot(null);
    refresh();
  };

  const handleDelete = async (id) => {
    await base44.entities.Shoot.delete(id);
    refresh();
  };

  const toggleAssign = async (shoot) => {
    const current = shoot.assigned_operators || [];
    const updated = current.includes(user?.email)
      ? current.filter(e => e !== user?.email)
      : [...current, user?.email];
    await base44.entities.Shoot.update(shoot.id, { assigned_operators: updated });
    refresh();
  };

  const startEdit = (shoot) => {
    setEditingShoot(shoot);
    setForm({ ...emptyForm, ...shoot });
    setShowAddForm(true);
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold">Calendar</h1>
          {isAdmin && (
            <div className="flex gap-2">
              <Button onClick={() => { setShowAddForm(true); setEditingShoot(null); setForm({ ...emptyForm, date: format(selectedDate, 'yyyy-MM-dd') }); }} className="bg-blue-600 hover:bg-blue-700" size="sm">
                <Plus className="h-4 w-4 mr-1" /> Add Shoot
              </Button>
              <Button onClick={() => setShowCSV(true)} variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800" size="sm">
                <Upload className="h-4 w-4 mr-1" /> Import CSV
              </Button>
            </div>
          )}
        </div>

        {/* Add/Edit Form */}
        {isAdmin && showAddForm && (
          <Card className="bg-gray-900 border-blue-700 mb-6">
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
                <Input placeholder="Client" value={form.client} onChange={e => setForm({ ...form, client: e.target.value })} className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
                <Input placeholder="Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
                <Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} className="bg-gray-800 border-gray-700 text-white" />
                <Input placeholder="Game Time (HH:MM)" value={form.game_time} onChange={e => setForm({ ...form, game_time: e.target.value })} className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
                <Select value={form.status} onValueChange={v => setForm({ ...form, status: v })}>
                  <SelectTrigger className="bg-gray-800 border-gray-700 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-gray-900 border-gray-700">
                    {['upcoming', 'confirmed', 'in_progress', 'completed', 'cancelled'].map(s => (
                      <SelectItem key={s} value={s} className="text-white capitalize">{s.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Custom time offsets */}
              <div className="bg-gray-800/60 rounded-lg p-3 mb-3">
                <p className="text-xs text-gray-400 mb-2 font-medium">⏱ Schedule Offsets (minutes before game time)</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { key: 'setup_offset', label: '🔧 Setup' },
                    { key: 'pre_shoot_offset', label: '📸 Pre-Shoot' },
                    { key: 'attention_offset', label: '⚠️ Attention' },
                    { key: 'sound_offset', label: '🔊 Sound' },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="text-xs text-gray-500 block mb-1">{label}</label>
                      <Input
                        type="number"
                        value={form[key]}
                        onChange={e => setForm({ ...form, [key]: Number(e.target.value) })}
                        className="bg-gray-700 border-gray-600 text-white h-8 text-sm"
                      />
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-600 mt-2">Negative = before game time. E.g. -150 = 2h30m before.</p>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleAddShoot} className="bg-blue-600 hover:bg-blue-700">
                  {editingShoot ? 'Save Changes' : 'Create Shoot'}
                </Button>
                <Button variant="outline" onClick={() => { setShowAddForm(false); setEditingShoot(null); setForm(emptyForm); }} className="border-gray-700 text-gray-300 hover:bg-gray-800">Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar Grid */}
          <div className="lg:col-span-2">
            <Card className="bg-gray-900 border-gray-800">
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
                    const dayShoots = getShootsForDay(day);
                    const dayEvents = getEventsForDay(day);
                    const total = dayShoots.length + dayEvents.length;
                    const isSelected = isSameDay(day, selectedDate);
                    const today = isToday(day);
                    return (
                      <div
                        key={day.toISOString()}
                        onClick={() => setSelectedDate(day)}
                        className={`min-h-[64px] p-1.5 rounded-lg cursor-pointer border transition-all
                          ${isSelected ? 'border-blue-500 bg-blue-950/60' : 'border-gray-800 hover:border-gray-600 hover:bg-gray-800/50'}
                          ${today ? 'ring-2 ring-blue-500' : ''}`}
                      >
                        <div className={`text-xs font-semibold mb-1 ${today ? 'text-blue-400' : 'text-gray-300'}`}>
                          {format(day, 'd')}
                        </div>
                        <div className="space-y-0.5">
                          {/* Sort shoots by time on calendar dots */}
                          {dayShoots.slice(0, 3).map(s => (
                            <div key={s.id} className={`text-xs truncate px-1 py-0.5 rounded text-white ${statusColors[s.status] || 'bg-blue-600'}`}>
                              {s.game_time || s.start_time ? `${s.game_time || s.start_time} ` : ''}{s.title}
                            </div>
                          ))}
                          {dayEvents.slice(0, 1).map(e => (
                            <div key={e.id} className="text-xs truncate px-1 py-0.5 rounded bg-purple-700 text-white">{e.title}</div>
                          ))}
                          {total > 4 && <div className="text-xs text-gray-500">+{total - 4} more</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Day Detail */}
          <div>
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="border-b border-gray-800 pb-3">
                <CardTitle className="text-white text-base">{format(selectedDate, 'EEEE, MMMM d')}</CardTitle>
                {isAdmin && (
                  <p className="text-xs text-gray-500">{selectedShoots.length} shoot(s) scheduled</p>
                )}
              </CardHeader>
              <CardContent className="p-0">
                {selectedShoots.length === 0 && selectedEvents.length === 0 ? (
                  <p className="text-gray-500 text-sm p-6">Nothing scheduled for this day.</p>
                ) : (
                  <div className="divide-y divide-gray-800">
                    {selectedShoots.map(shoot => {
                      const schedule = getSchedule(shoot);
                      const isExpanded = expandedShoot === shoot.id;
                      return (
                        <div key={shoot.id} className="p-4">
                          <div
                            className="flex items-start justify-between cursor-pointer"
                            onClick={() => setExpandedShoot(isExpanded ? null : shoot.id)}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <Camera className="h-3.5 w-3.5 text-blue-400 flex-shrink-0" />
                                <p className="font-semibold text-white text-sm truncate">{shoot.title}</p>
                              </div>
                              {(shoot.game_time || shoot.start_time) && (
                                <p className="text-xs font-mono text-blue-300 ml-5">🏟️ {shoot.game_time || shoot.start_time}</p>
                              )}
                              {shoot.client && <p className="text-xs text-gray-400 ml-5">{shoot.client}</p>}
                            </div>
                            <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                              <Badge className={`text-xs border ${statusBadge[shoot.status]}`}>{shoot.status}</Badge>
                              <ChevronDown className={`h-3.5 w-3.5 text-gray-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                          </div>

                          {isExpanded && (
                            <div className="mt-3">
                              {schedule && (
                                <div className="bg-gray-800/60 rounded-lg p-3 mb-3 space-y-1.5">
                                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Schedule</p>
                                  {[
                                    { icon: '🔧', label: 'Setup', time: schedule.setup },
                                    { icon: '📸', label: 'Pre-Shoot', time: schedule.pre_shoot },
                                    { icon: '⚠️', label: 'Attention', time: schedule.attention },
                                    { icon: '🔊', label: 'Sound', time: schedule.sound },
                                    { icon: '🏟️', label: 'Game Time', time: schedule.game, highlight: true },
                                  ].map(row => (
                                    <div key={row.label} className={`flex justify-between text-xs ${row.highlight ? 'text-blue-300 font-bold' : 'text-gray-400'}`}>
                                      <span>{row.icon} {row.label}</span>
                                      <span className="font-mono">{row.time}</span>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {shoot.assigned_operators?.length > 0 && (
                                <div className="mb-3">
                                  <p className="text-xs text-gray-500 mb-1">Assigned Operators</p>
                                  <div className="flex flex-wrap gap-1">
                                    {shoot.assigned_operators.map(email => (
                                      <span key={email} className="text-xs bg-gray-800 text-gray-300 px-2 py-0.5 rounded-full">{email}</span>
                                    ))}
                                  </div>
                                </div>
                              )}

                              <div className="flex gap-2">
                                {!isAdmin && (
                                  <Button
                                    size="sm"
                                    onClick={() => toggleAssign(shoot)}
                                    className={shoot.assigned_operators?.includes(user?.email)
                                      ? 'border border-red-700 text-red-400 bg-transparent hover:bg-red-900/30 h-7 text-xs'
                                      : 'bg-blue-600 hover:bg-blue-700 text-white h-7 text-xs'
                                    }
                                  >
                                    {shoot.assigned_operators?.includes(user?.email) ? 'Unassign' : 'Assign Me'}
                                  </Button>
                                )}
                                {isAdmin && (
                                  <>
                                    <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-400 hover:text-white hover:bg-gray-800" onClick={() => startEdit(shoot)}>
                                      <Edit2 className="h-3 w-3 mr-1" /> Edit
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-7 text-xs text-red-400 hover:bg-gray-800" onClick={() => handleDelete(shoot.id)}>
                                      Delete
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {selectedEvents.map(ev => (
                      <div key={ev.id} className="p-4">
                        <p className="font-medium text-white text-sm">{ev.title}</p>
                        <p className="text-xs text-purple-400 mt-0.5 capitalize">{ev.type}</p>
                        {ev.description && <p className="text-xs text-gray-500 mt-1">{ev.description}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Legend */}
            <div className="mt-4 bg-gray-900 border border-gray-800 rounded-xl p-3">
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Legend</p>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { label: 'Upcoming', color: 'bg-blue-600' },
                  { label: 'Confirmed', color: 'bg-green-600' },
                  { label: 'In Progress', color: 'bg-yellow-600' },
                  { label: 'Completed', color: 'bg-gray-600' },
                  { label: 'Cancelled', color: 'bg-red-700' },
                  { label: 'Event', color: 'bg-purple-700' },
                ].map(l => (
                  <div key={l.label} className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded ${l.color}`} />
                    <span className="text-xs text-gray-400">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <CSVImportModal open={showCSV} onClose={() => setShowCSV(false)} onImported={refresh} />
    </div>
  );
}