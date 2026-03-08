import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Camera } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday, isAfter } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';

const typeColors = {
  upcoming: 'bg-blue-600',
  confirmed: 'bg-green-600',
  in_progress: 'bg-yellow-600',
  completed: 'bg-gray-600',
  cancelled: 'bg-red-700',
};

export default function Calendar() {
  const { user, isAdmin } = useApp();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());

  const { data: shoots = [] } = useQuery({
    queryKey: ['shoots'],
    queryFn: () => base44.entities.Shoot.list('-date', 200),
  });

  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: () => base44.entities.Event.list('-date', 200),
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = monthStart.getDay();

  const getShootsForDay = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    let dayShots = shoots.filter(s => s.date === dateStr);
    if (!isAdmin) {
      dayShots = dayShots.filter(s => s.assigned_operators?.includes(user?.email));
    }
    return dayShots;
  };

  const getEventsForDay = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return events.filter(e => e.date === dateStr);
  };

  const selectedShoots = getShootsForDay(selectedDate);
  const selectedEvents = getEventsForDay(selectedDate);

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Calendar</h1>
          {isAdmin && (
            <Link to={createPageUrl('Shoots')}>
              <Button className="bg-blue-600 hover:bg-blue-700">
                <Camera className="h-4 w-4 mr-2" /> Manage Shoots
              </Button>
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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
                          ${today ? 'ring-2 ring-blue-500' : ''}
                        `}
                      >
                        <div className={`text-xs font-semibold mb-1 ${today ? 'text-blue-400' : 'text-gray-300'}`}>
                          {format(day, 'd')}
                        </div>
                        <div className="space-y-0.5">
                          {dayShoots.slice(0, 2).map(s => (
                            <div key={s.id} className={`text-xs truncate px-1 py-0.5 rounded text-white ${typeColors[s.status] || 'bg-blue-600'}`}>
                              {s.title}
                            </div>
                          ))}
                          {dayEvents.slice(0, 1).map(e => (
                            <div key={e.id} className="text-xs truncate px-1 py-0.5 rounded bg-purple-700 text-white">
                              {e.title}
                            </div>
                          ))}
                          {total > 3 && <div className="text-xs text-gray-500">+{total - 3}</div>}
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
              </CardHeader>
              <CardContent className="p-0">
                {selectedShoots.length === 0 && selectedEvents.length === 0 ? (
                  <p className="text-gray-500 text-sm p-6">Nothing scheduled for this day.</p>
                ) : (
                  <div className="divide-y divide-gray-800">
                    {selectedShoots.map(shoot => (
                      <div key={shoot.id} className="p-4">
                        <div className="flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <Camera className="h-4 w-4 text-blue-400" />
                              <p className="font-medium text-white text-sm">{shoot.title}</p>
                            </div>
                            {shoot.client && <p className="text-xs text-gray-400">{shoot.client}</p>}
                            {shoot.location && <p className="text-xs text-gray-500">{shoot.location}</p>}
                            {shoot.start_time && <p className="text-xs text-gray-500 mt-1">{shoot.start_time} {shoot.end_time && `– ${shoot.end_time}`}</p>}
                            {shoot.assigned_operators?.length > 0 && (
                              <p className="text-xs text-gray-500 mt-1">{shoot.assigned_operators.length} operator(s)</p>
                            )}
                          </div>
                          <Badge className={`text-xs ${typeColors[shoot.status]} text-white border-0`}>{shoot.status}</Badge>
                        </div>
                        {!isAdmin && (
                          <AssignButton shoot={shoot} user={user} />
                        )}
                      </div>
                    ))}
                    {selectedEvents.map(ev => (
                      <div key={ev.id} className="p-4">
                        <p className="font-medium text-white text-sm">{ev.title}</p>
                        <p className="text-xs text-purple-400 mt-0.5">{ev.type}</p>
                        {ev.description && <p className="text-xs text-gray-500 mt-1">{ev.description}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="mt-4">
              <div className="flex flex-col gap-2">
                {[{label:'Shoot', color:'bg-blue-600'},{label:'Confirmed', color:'bg-green-600'},{label:'Completed', color:'bg-gray-600'},{label:'Event', color:'bg-purple-700'}].map(l => (
                  <div key={l.label} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded ${l.color}`} />
                    <span className="text-xs text-gray-400">{l.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AssignButton({ shoot, user }) {
  const isAssigned = shoot.assigned_operators?.includes(user?.email);
  const queryClient = useQueryClient();
  
  const handleToggle = async () => {
    const current = shoot.assigned_operators || [];
    const updated = isAssigned
      ? current.filter(e => e !== user?.email)
      : [...current, user?.email];
    await base44.entities.Shoot.update(shoot.id, { assigned_operators: updated });
    queryClient.invalidateQueries({ queryKey: ['shoots'] });
  };

  return (
    <Button
      size="sm"
      variant={isAssigned ? "outline" : "default"}
      className={`mt-2 text-xs h-7 ${isAssigned ? 'border-red-700 text-red-400 hover:bg-red-900/30' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
      onClick={handleToggle}
    >
      {isAssigned ? 'Unassign Myself' : 'Assign Myself'}
    </Button>
  );
}

// Need to import useQueryClient in AssignButton
import { useQueryClient } from '@tanstack/react-query';