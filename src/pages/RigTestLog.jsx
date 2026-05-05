import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Clock, MessageSquare } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function RigTestLog() {
  const { isAdmin, isStandby } = useApp();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  const { data: rigTests = [] } = useQuery({
    queryKey: ['rigTests'],
    queryFn: () => base44.entities.RigTest.list('-scheduled_date', 500),
  });

  if (!isAdmin && !isStandby) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-500">Access restricted.</p>
      </div>
    );
  }

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = monthStart.getDay();

  const testsForDay = (day) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return rigTests.filter(t => t.scheduled_date === dateStr);
  };

  const selectedDayTests = selectedDay ? testsForDay(selectedDay) : [];

  const monthTests = rigTests.filter(t => t.scheduled_date >= format(monthStart, 'yyyy-MM-dd') && t.scheduled_date <= format(monthEnd, 'yyyy-MM-dd'));
  const completedCount = monthTests.filter(t => t.status === 'completed').length;
  const pendingCount = monthTests.filter(t => t.status !== 'completed').length;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Rig Test Log</h1>
          <p className="text-gray-400 text-sm mt-1">Calendar view of all scheduled and completed rig tests.</p>
        </div>

        {/* Month stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <p className="text-gray-400 text-xs">This Month</p>
              <p className="text-2xl font-bold text-white mt-1">{monthTests.length}</p>
              <p className="text-xs text-gray-500">tests scheduled</p>
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-4">
              <p className="text-gray-400 text-xs">Completed</p>
              <p className="text-2xl font-bold text-green-400 mt-1">{completedCount}</p>
            </CardContent>
          </Card>
          <Card className={`border-gray-800 ${pendingCount > 0 ? 'bg-yellow-950/15 border-yellow-800/40' : 'bg-gray-900'}`}>
            <CardContent className="p-4">
              <p className={`text-xs ${pendingCount > 0 ? 'text-yellow-400' : 'text-gray-400'}`}>Pending</p>
              <p className={`text-2xl font-bold mt-1 ${pendingCount > 0 ? 'text-yellow-400' : 'text-white'}`}>{pendingCount}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <Card className="bg-gray-900 border-gray-800">
              <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-gray-800">
                <Button variant="ghost" size="icon" onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="text-gray-400 hover:text-white hover:bg-gray-800">
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <CardTitle className="text-white text-lg">{format(currentDate, 'MMMM yyyy')}</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="text-gray-400 hover:text-white hover:bg-gray-800">
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
                    const dayTests = testsForDay(day);
                    const hasCompleted = dayTests.some(t => t.status === 'completed');
                    const hasPending = dayTests.some(t => t.status !== 'completed');
                    const isSelected = selectedDay && isSameDay(day, selectedDay);
                    const today = isToday(day);

                    return (
                      <div
                        key={day.toISOString()}
                        onClick={() => setSelectedDay(isSameDay(day, selectedDay) ? null : day)}
                        className={`min-h-[70px] p-1.5 rounded-lg cursor-pointer border transition-all
                          ${isSelected ? 'border-blue-500 bg-blue-950/40' : 'border-gray-800 hover:border-gray-600 hover:bg-gray-800/40'}
                          ${today ? 'ring-2 ring-blue-500' : ''}
                        `}
                      >
                        <div className={`text-xs font-semibold mb-1 ${today ? 'text-blue-400' : 'text-gray-400'}`}>
                          {format(day, 'd')}
                        </div>
                        <div className="space-y-0.5">
                          {dayTests.slice(0, 3).map(test => (
                            <div key={test.id} className={`text-[10px] rounded px-1 py-0.5 truncate ${
                              test.status === 'completed'
                                ? 'bg-green-900/50 text-green-300'
                                : 'bg-yellow-900/40 text-yellow-300'
                            }`}>
                              {test.title}
                            </div>
                          ))}
                          {dayTests.length > 3 && <div className="text-[10px] text-gray-500">+{dayTests.length - 3}</div>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Day detail */}
          <div>
            <Card className="bg-gray-900 border-gray-800 sticky top-4">
              <CardHeader className="border-b border-gray-800 pb-3">
                <CardTitle className="text-white text-sm">
                  {selectedDay ? format(selectedDay, 'EEE, MMM d yyyy') : 'Select a day'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4">
                {!selectedDay && <p className="text-xs text-gray-500">Click a day to see rig tests.</p>}
                {selectedDay && selectedDayTests.length === 0 && (
                  <p className="text-xs text-gray-500">No rig tests on this day.</p>
                )}
                <div className="space-y-3">
                  {selectedDayTests.map(test => (
                    <div key={test.id} className={`rounded-xl border p-3 ${test.status === 'completed' ? 'border-green-800/50 bg-green-950/10' : 'border-gray-800 bg-gray-800/40'}`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-sm font-semibold text-white">{test.title}</p>
                          {test.assigned_name && <p className="text-xs text-gray-500">{test.assigned_name}</p>}
                        </div>
                        {test.status === 'completed'
                          ? <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-xs flex-shrink-0">Done</Badge>
                          : <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-xs flex-shrink-0">Pending</Badge>
                        }
                      </div>

                      {/* Checklist summary */}
                      {test.checklist && (
                        <div className="space-y-1 mb-2">
                          {test.checklist.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-1.5">
                              {item.checked
                                ? <CheckCircle2 className="h-3 w-3 text-green-400 flex-shrink-0" />
                                : <Circle className="h-3 w-3 text-gray-600 flex-shrink-0" />
                              }
                              <span className={`text-xs ${item.checked ? 'line-through text-gray-600' : 'text-gray-400'}`}>
                                {item.item}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Comments */}
                      {test.comments && (
                        <div className="flex items-start gap-1.5 mt-2 bg-gray-900/60 rounded-lg p-2">
                          <MessageSquare className="h-3.5 w-3.5 text-gray-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-gray-400 italic">{test.comments}</p>
                        </div>
                      )}

                      {test.completed_at && (
                        <p className="text-[10px] text-gray-600 mt-1.5 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Completed {format(new Date(test.completed_at), 'MMM d, HH:mm')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}