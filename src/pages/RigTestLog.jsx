import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, CheckCircle2, Circle, Clock, MessageSquare, Download, ChevronRight as ChevronRightIcon } from 'lucide-react';
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
  const [expandedTestId, setExpandedTestId] = useState(null);

  const { data: rigTests = [] } = useQuery({
    queryKey: ['rigTests'],
    queryFn: () => base44.entities.RigTest.list('-scheduled_date', 500),
  });

  if (!isAdmin && !isStandby) {
    return (
      <div className="min-h-screen bg-zinc-800 flex items-center justify-center">
        <p className="text-zinc-500">Access restricted.</p>
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
    <div className="min-h-screen bg-zinc-800 text-zinc-100 p-3 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Rig Test Log</h1>
            <p className="text-zinc-400 text-sm mt-1">Calendar view of all scheduled and completed rig tests.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="border-zinc-800 text-zinc-400 hover:bg-zinc-800"
            onClick={() => exportCSV(rigTests)}
          >
            <Download className="h-4 w-4 mr-1.5" /> Export CSV
          </Button>
        </div>

        {/* Month stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <p className="text-zinc-400 text-xs">This Month</p>
              <p className="text-2xl font-bold text-zinc-100 mt-1">{monthTests.length}</p>
              <p className="text-xs text-zinc-500">tests scheduled</p>
            </CardContent>
          </Card>
          <Card className="bg-zinc-900 border-zinc-800">
            <CardContent className="p-4">
              <p className="text-zinc-400 text-xs">Completed</p>
              <p className="text-2xl font-bold text-emerald-400 mt-1">{completedCount}</p>
            </CardContent>
          </Card>
          <Card className={`border-zinc-800 ${pendingCount > 0 ? 'bg-yellow-950/15 border-amber-800' : 'bg-zinc-900'}`}>
            <CardContent className="p-4">
              <p className={`text-xs ${pendingCount > 0 ? 'text-amber-400' : 'text-zinc-400'}`}>Pending</p>
              <p className={`text-2xl font-bold mt-1 ${pendingCount > 0 ? 'text-amber-400' : 'text-zinc-100'}`}>{pendingCount}</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex gap-4 h-[calc(100vh-200px)]">
          {/* Calendar - left side, larger */}
          <Card className="bg-zinc-900 border-zinc-800 flex-1 flex flex-col overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-zinc-800 flex-shrink-0">
              <Button variant="ghost" size="icon" onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))} className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <CardTitle className="text-zinc-100">{format(currentDate, 'MMMM yyyy')}</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))} className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800">
                <ChevronRight className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-7 mb-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                  <div key={d} className="text-center text-xs font-medium text-zinc-500 py-2">{d}</div>
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
                      onClick={() => setSelectedDay(day)}
                      className={`min-h-[120px] p-2.5 rounded-lg cursor-pointer border transition-all
                        ${isSelected ? 'border-blue-500 bg-teal-950/40' : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800/40'}
                        ${today ? 'ring-2 ring-blue-500' : ''}
                      `}
                    >
                      <div className={`text-sm font-semibold mb-2 ${today ? 'text-teal-400' : 'text-zinc-400'}`}>
                        {format(day, 'd')}
                      </div>
                      <div className="space-y-1">
                        {dayTests.slice(0, 4).map(test => (
                          <div key={test.id} className={`text-[10px] rounded px-1.5 py-0.5 truncate ${
                            test.status === 'completed'
                              ? 'bg-green-900/50 text-green-300'
                              : 'bg-yellow-900/40 text-amber-400'
                          }`}>
                            {test.title?.substring(0, 15)}
                          </div>
                        ))}
                        {dayTests.length > 4 && <div className="text-[9px] text-zinc-500">+{dayTests.length - 4}</div>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Side panel - right side */}
          {selectedDay && (
            <div className="w-80 flex flex-col bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden">
              <div className="p-4 border-b border-zinc-800 flex-shrink-0">
                <p className="text-sm font-semibold text-zinc-100">{format(selectedDay, 'EEE, MMM d yyyy')}</p>
                <p className="text-xs text-zinc-500 mt-1">{selectedDayTests.length} test{selectedDayTests.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="overflow-y-auto flex-1">
                {selectedDayTests.length === 0 ? (
                  <div className="p-4">
                    <p className="text-xs text-zinc-500">No rig tests on this day.</p>
                  </div>
                ) : (
                  <div className="p-3 space-y-2">
                    {selectedDayTests.map(test => {
                      const isExpanded = expandedTestId === test.id;
                      return (
                        <div key={test.id} className={`rounded-lg border transition-all ${test.status === 'completed' ? 'border-green-800/50 bg-emerald-950/40' : 'border-zinc-800 bg-zinc-800/40'}`}>
                          <button
                            onClick={() => setExpandedTestId(isExpanded ? null : test.id)}
                            className="w-full p-3 flex items-start justify-between gap-2 text-left"
                          >
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-zinc-100 truncate">{test.title}</p>
                              {test.assigned_name && <p className="text-xs text-zinc-400 mt-0.5 truncate">{test.assigned_name}</p>}
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              <Badge className={`text-xs ${test.status === 'completed' ? 'bg-green-500/15 text-emerald-400 border-green-500/30' : 'bg-yellow-500/15 text-amber-400 border-yellow-500/30'}`}>
                                {test.status === 'completed' ? 'Done' : 'Pending'}
                              </Badge>
                              <ChevronRight className={`h-4 w-4 text-zinc-500 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="border-t border-zinc-800 p-3 space-y-3 text-sm">
                              {test.checklist && test.checklist.length > 0 && (
                                <div>
                                  <p className="text-xs text-zinc-500 uppercase mb-2">Checklist</p>
                                  <div className="space-y-1">
                                    {test.checklist.map((item, idx) => (
                                      <div key={idx} className="flex items-center gap-1.5">
                                        {item.checked
                                          ? <CheckCircle2 className="h-3 w-3 text-emerald-400 flex-shrink-0" />
                                          : <Circle className="h-3 w-3 text-gray-600 flex-shrink-0" />
                                        }
                                        <span className={`text-xs ${item.checked ? 'line-through text-gray-600' : 'text-zinc-400'}`}>
                                          {item.item}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                  <p className="text-[10px] text-gray-600 mt-2">
                                    {test.checklist.filter(i => i.checked).length}/{test.checklist.length} complete
                                  </p>
                                </div>
                              )}

                              {test.comments && (
                                <div>
                                  <p className="text-xs text-zinc-500 uppercase mb-1">Comments</p>
                                  <p className="text-xs text-zinc-400 italic">{test.comments}</p>
                                </div>
                              )}

                              {test.completed_at && (
                                <div>
                                  <p className="text-xs text-zinc-500 uppercase">Completed</p>
                                  <p className="text-xs text-zinc-400 mt-0.5">{format(new Date(test.completed_at), 'MMM d, HH:mm')}</p>
                                </div>
                              )}

                              {test.rig_ids && test.rig_ids.length > 0 && (
                                <div>
                                  <p className="text-xs text-zinc-500 uppercase mb-1">Rigs</p>
                                  <div className="flex flex-wrap gap-1">
                                    {test.rig_ids.map((id, idx) => (
                                      <Badge key={idx} variant="outline" className="text-xs border-zinc-800">{id}</Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
          </div>
          </div>
          </div>
          );
          }