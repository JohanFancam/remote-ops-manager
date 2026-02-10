import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Calendar as CalendarIcon, ShoppingCart, CreditCard, Bell, ChevronLeft, ChevronRight } from 'lucide-react';
import { useHousehold } from '../components/HouseholdContext';
import { useTheme } from '../components/ThemeProvider';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday } from 'date-fns';
import { Link } from 'react-router-dom';
import { createPageUrl } from '../utils';

export default function CalendarPage() {
  const { householdId, isLoading: loadingHousehold } = useHousehold();
  const theme = useTheme();
  const queryClient = useQueryClient();
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({ title: '', date: format(new Date(), 'yyyy-MM-dd'), type: 'general', notes: '' });
  
  const { data: reminders = [] } = useQuery({
    queryKey: ['calendarReminders', householdId],
    queryFn: () => base44.entities.CalendarReminder.filter({ household_id: householdId }),
    enabled: !!householdId,
  });
  
  const { data: expenses = [] } = useQuery({
    queryKey: ['expensesAll', householdId],
    queryFn: () => base44.entities.Expense.filter({ household_id: householdId }),
    enabled: !!householdId,
  });
  
  const { data: shoppingLists = [] } = useQuery({
    queryKey: ['shoppingLists', householdId],
    queryFn: () => base44.entities.ShoppingList.filter({ household_id: householdId }),
    enabled: !!householdId,
  });
  
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['calendarReminders'] });
  };
  
  const handleAddReminder = async () => {
    if (!form.title || !form.date) return;
    await base44.entities.CalendarReminder.create({
      ...form,
      household_id: householdId
    });
    setForm({ title: '', date: format(new Date(), 'yyyy-MM-dd'), type: 'general', notes: '' });
    setIsAdding(false);
    refresh();
  };
  
  const toggleReminder = async (reminder) => {
    await base44.entities.CalendarReminder.update(reminder.id, { is_completed: !reminder.is_completed });
    refresh();
  };
  
  const deleteReminder = async (id) => {
    await base44.entities.CalendarReminder.delete(id);
    refresh();
  };
  
  // Build calendar events
  const getEventsForDate = (date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const events = [];
    
    // Reminders
    reminders.filter(r => r.date === dateStr).forEach(r => {
      events.push({ ...r, eventType: 'reminder' });
    });
    
    // Bills/Expenses due
    expenses.filter(e => e.due_date === dateStr && !e.is_paid).forEach(e => {
      events.push({ id: `exp-${e.id}`, title: e.description || e.category, type: 'bill', eventType: 'expense', amount: e.amount });
    });
    
    // Shopping lists
    shoppingLists.filter(l => l.scheduled_date === dateStr && !l.is_completed).forEach(l => {
      events.push({ id: `shop-${l.id}`, title: l.name, type: 'shopping', eventType: 'shopping', listId: l.id });
    });
    
    return events;
  };
  
  // Calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
  
  // Pad with empty days at start
  const startPadding = monthStart.getDay();
  
  const selectedDateEvents = getEventsForDate(selectedDate);
  
  const getTypeIcon = (type) => {
    switch(type) {
      case 'shopping': return <ShoppingCart className="h-3 w-3" />;
      case 'bill': return <CreditCard className="h-3 w-3" />;
      default: return <Bell className="h-3 w-3" />;
    }
  };
  
  const getTypeColor = (type) => {
    switch(type) {
      case 'shopping': return 'bg-purple-100 text-purple-700';
      case 'bill': return 'bg-red-100 text-red-700';
      default: return 'bg-blue-100 text-blue-700';
    }
  };
  
  if (loadingHousehold) {
    return <div className={`min-h-screen ${theme.bg} flex items-center justify-center`}>Loading...</div>;
  }
  
  return (
    <div className={`min-h-screen ${theme.bg}`}>
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className={`text-2xl font-bold ${theme.text}`}>Calendar</h1>
          <Button onClick={() => setIsAdding(true)} className={theme.cardHeader}>
            <Plus className="h-4 w-4 mr-2" /> Add Reminder
          </Button>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <Card className={`border-0 shadow-md ${theme.cardBg}`}>
              <CardHeader className="flex flex-row items-center justify-between py-4">
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <CardTitle className={`text-lg ${theme.text}`}>
                  {format(currentMonth, 'MMMM yyyy')}
                </CardTitle>
                <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                  <ChevronRight className="h-5 w-5" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className={`text-center text-xs font-medium ${theme.textMuted} py-2`}>{day}</div>
                  ))}
                </div>
                
                <div className="grid grid-cols-7 gap-1">
                  {Array(startPadding).fill(null).map((_, i) => (
                    <div key={`pad-${i}`} className="h-16" />
                  ))}
                  
                  {calendarDays.map(day => {
                    const dayEvents = getEventsForDate(day);
                    const isSelected = isSameDay(day, selectedDate);
                    const today = isToday(day);
                    
                    return (
                      <div
                        key={day.toISOString()}
                        onClick={() => setSelectedDate(day)}
                        className={`h-16 p-1 border rounded cursor-pointer transition-colors
                          ${isSelected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}
                          ${today ? 'ring-2 ring-blue-400' : ''}
                        `}
                      >
                        <div className={`text-xs font-medium mb-1 ${today ? 'text-blue-600' : theme.text}`}>
                          {format(day, 'd')}
                        </div>
                        <div className="space-y-0.5">
                          {dayEvents.slice(0, 2).map(event => (
                            <div key={event.id} className={`text-xs truncate px-1 rounded ${getTypeColor(event.type)}`}>
                              {event.title}
                            </div>
                          ))}
                          {dayEvents.length > 2 && (
                            <div className="text-xs text-slate-500">+{dayEvents.length - 2} more</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Selected Day Events */}
          <div>
            <Card className={`border-0 shadow-md ${theme.cardBg}`}>
              <CardHeader className={`${theme.cardHeader} text-white rounded-t-lg py-3`}>
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  {format(selectedDate, 'EEEE, MMM d')}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {selectedDateEvents.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className={theme.textMuted}>No events for this day</p>
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {selectedDateEvents.map(event => (
                      <div key={event.id} className={`px-4 py-3 flex items-start justify-between ${event.is_completed ? 'opacity-50' : ''}`}>
                        <div className="flex items-start gap-3">
                          {event.eventType === 'reminder' && (
                            <Checkbox
                              checked={event.is_completed}
                              onCheckedChange={() => toggleReminder(event)}
                            />
                          )}
                          <div>
                            <div className={`flex items-center gap-2 ${event.is_completed ? 'line-through' : ''}`}>
                              <span className={`p-1 rounded ${getTypeColor(event.type)}`}>
                                {getTypeIcon(event.type)}
                              </span>
                              <span className={`text-sm font-medium ${theme.text}`}>{event.title}</span>
                            </div>
                            {event.amount && (
                              <p className="text-sm text-red-600 mt-1">R {event.amount.toLocaleString()} due</p>
                            )}
                            {event.notes && (
                              <p className="text-xs text-slate-500 mt-1">{event.notes}</p>
                            )}
                            {event.eventType === 'shopping' && (
                              <Link to={createPageUrl('ShoppingList')} className="text-xs text-blue-600 hover:underline mt-1 block">
                                View List →
                              </Link>
                            )}
                          </div>
                        </div>
                        {event.eventType === 'reminder' && (
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteReminder(event.id)}>
                            <Trash2 className="h-3 w-3 text-red-400" />
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            
            {/* Add Reminder Form */}
            {isAdding && (
              <Card className="mt-4 border-2 border-blue-200">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">New Reminder</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Input
                    placeholder="Reminder title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                  />
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="shopping">Shopping</SelectItem>
                      <SelectItem value="bill">Bill</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Notes (optional)"
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                  <div className="flex gap-2">
                    <Button onClick={handleAddReminder}>Add</Button>
                    <Button variant="outline" onClick={() => setIsAdding(false)}>Cancel</Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}