import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Clock, MessageSquare, Download } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function exportCSV(rigTests) {
  const headers = ['Date', 'Title', 'Assigned To', 'Status', 'Checklist Progress', 'Comments', 'Completed At'];
  const rows = rigTests.map(t => {
    const total = t.checklist?.length || 0;
    const done = t.checklist?.filter(i => i.checked).length || 0;
    return [
      t.scheduled_date || '',
      t.title || '',
      t.assigned_name || t.assigned_to || '',
      t.status || '',
      total > 0 ? `${done}/${total}` : '',
      (t.comments || '').replace(/,/g, ';'),
      t.completed_at ? format(new Date(t.completed_at), 'yyyy-MM-dd HH:mm') : '',
    ];
  });
  const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `rig-test-log-${format(new Date(), 'yyyy-MM')}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

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

  const monthTests = rigTests.filter(t =>
    t.scheduled_date >= format(monthStart, 'yyyy-MM-dd') &&
    t.scheduled_date <= format(monthEnd, 'yyyy-MM-dd')
  );
  const completedCount = monthTests.filter(t => t.status === 'completed').length;
  const pendingCount = monthTests.filter(t => t.status !== 'completed').length;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Rig Test Log</h1>
            <p className="text-gray-400 text-sm mt-1">Calendar view of all scheduled and completed rig tests.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
            onClick={() => exportCSV(rigTests)}
          >
            <Download className="h-4 w-4 mr-1.5" /> Export CSV
          </Button>
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

        {/* Full-width calendar */}
        <Card className="bg-gray-900 border-gray-800 mb-6">
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
            <div className="grid grid-cols-7 mb-3">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                <div key={d} className="text-center text-xs font-medium text-gray-500 py-2">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {Array(startPadding).fill(null).map((_, i) => <div key={`p${i}`} />)}
              {calendarDays.map(day => {
                const dayTests = testsForDay(day);
                const isSelected = selectedDay && isSameDay(day, selectedDay);
                const today = isToday(day);

                return (
                  <div
                    key={day.toISOString()}
                    onClick={() => setSelectedDay(isSameDay(day, selectedDay) ? null : day)}
                    className={`min-h-[90px] p-2 rounded-xl cursor-pointer border transition-all
                      ${isSelected ? 'border-blue-500 bg-blue-950/40' : 'border-gray-800 hover:border-gray-600 hover:bg-gray-800/40'}
                      ${today ? 'ring-2 ring-blue-500' : ''}
                    `}
                  >
                    <div className={`text-sm font-semibold mb-1 ${today ? 'text-blue-400' : 'text-gray-400'}`}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-1">
                      {dayTests.slice(0, 3).map(test => (
                        <div key={test.id} className={`text-[11px] rounded-md px-1.5 py-0.5 truncate ${
                          test.status === 'completed'
                            ? 'bg-green-900/50 text-green-300'
                            : 'bg-yellow-900/40 text-yellow-300'
                        }`}>
                          {test.assigned_name?.split(' ')[0] || test.title}
                        </div>
                      ))}
                      {dayTests.length > 3 && <div className="text-[10px] text-gray-500">+{dayTests.length - 3} more</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Day detail panel */}
        {selectedDay && (
          <Card className="bg-gray-900 border-gray-800">
            <CardHeader className="border-b border-gray-800 pb-3">
              <CardTitle className="text-white text-sm">
                {format(selectedDay, 'EEE, MMM d yyyy')} — {selectedDayTests.length} test{selectedDayTests.length !== 1 ? 's' : ''}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {selectedDayTests.length === 0 ? (
                <p className="text-xs text-gray-500">No rig tests on this day.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedDayTests.map(test => (
                    <div key={test.id} className={`rounded-xl border p-4 ${test.status === 'completed' ? 'border-green-800/50 bg-green-950/10' : 'border-gray-800 bg-gray-800/40'}`}>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div>
                          <p className="text-sm font-semibold text-white">{test.title}</p>
                          {test.assigned_name && <p className="text-xs text-gray-400 mt-0.5">{test.assigned_name}</p>}
                        </div>
                        {test.status === 'completed'
                          ? <Badge className="bg-green-500/15 text-green-400 border-green-500/30 text-xs flex-shrink-0">Done</Badge>
                          : <Badge className="bg-yellow-500/15 text-yellow-400 border-yellow-500/30 text-xs flex-shrink-0">Pending</Badge>
                        }
                      </div>

                      {test.checklist && test.checklist.length > 0 && (
                        <div className="space-y-1 mb-3">
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
                          <p className="text-[10px] text-gray-600 mt-1">
                            {test.checklist.filter(i => i.checked).length}/{test.checklist.length} complete
                          </p>
                        </div>
                      )}

                      {test.comments && (
                        <div className="flex items-start gap-1.5 bg-gray-900/60 rounded-lg p-2 mb-2">
                          <MessageSquare className="h-3.5 w-3.5 text-gray-500 flex-shrink-0 mt-0.5" />
                          <p className="text-xs text-gray-400 italic">{test.comments}</p>
                        </div>
                      )}

                      {test.completed_at && (
                        <p className="text-[10px] text-gray-600 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Completed {format(new Date(test.completed_at), 'MMM d, HH:mm')}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}