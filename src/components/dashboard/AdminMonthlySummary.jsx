import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Camera, Phone, Clock, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Plus, Trash2, X } from 'lucide-react';
import { format, eachDayOfInterval, parseISO } from 'date-fns';

export default function AdminMonthlySummary({ shoots, user, appSettings = [] }) {
  const [expanded, setExpanded] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [addingDay, setAddingDay] = useState(false);
  const [newDayInput, setNewDayInput] = useState('');
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  const monthStr = format(currentMonth, 'yyyy-MM');
  const adminDayHours = parseFloat(appSettings.find(s => s.key === 'admin_day_hours')?.value) || 9.5;

  const goMonth = (delta) => {
    const d = new Date(currentMonth);
    d.setMonth(d.getMonth() + delta);
    setCurrentMonth(d);
  };

  const myMonthShoots = shoots.filter(s =>
    s.date?.startsWith(monthStr) &&
    s.assigned_operators?.includes(user?.email) &&
    s.status !== 'cancelled'
  );

  const { data: standbyDays = [] } = useQuery({
    queryKey: ['standbyDays'],
    queryFn: () => base44.entities.StandbyDay.list('date', 500),
    enabled: !!user?.email,
  });

  // Load overrides for this admin + month from AppSettings
  const overrideKey = `admin_hours_override_${(user?.email || '').replace(/[@.]/g, '_')}_${monthStr}`;
  const overrideSetting = appSettings.find(s => s.key === overrideKey);
  const overrides = useMemo(() => {
    try { return JSON.parse(overrideSetting?.value || '{}'); }
    catch { return {}; }
  }, [overrideSetting?.value]);
  const exclusions = new Set(overrides.exclusions || []);
  const additions = overrides.additions || [];

  const saveOverrides = async (newOverrides) => {
    setSaving(true);
    const val = JSON.stringify(newOverrides);
    if (overrideSetting) {
      await base44.entities.AppSettings.update(overrideSetting.id, { value: val });
    } else {
      await base44.entities.AppSettings.create({ key: overrideKey, value: val, description: `Hours overrides for ${user?.email} ${monthStr}` });
    }
    queryClient.invalidateQueries({ queryKey: ['appSettings'] });
    setSaving(false);
  };

  const handleExclude = async (dateStr) => {
    const newExclusions = [...new Set([...exclusions, dateStr])];
    await saveOverrides({ ...overrides, exclusions: newExclusions });
  };

  const handleInclude = async (dateStr) => {
    const newExclusions = [...exclusions].filter(d => d !== dateStr);
    await saveOverrides({ ...overrides, exclusions: newExclusions });
  };

  const handleRemoveAddition = async (dateStr) => {
    const newAdditions = additions.filter(d => d !== dateStr);
    await saveOverrides({ ...overrides, additions: newAdditions });
  };

  const handleAddDay = async () => {
    if (!newDayInput) return;
    const newAdditions = [...new Set([...additions, newDayInput])];
    await saveOverrides({ ...overrides, additions: newAdditions });
    setNewDayInput('');
    setAddingDay(false);
  };

  const myMonthStandby = standbyDays.filter(s => {
    if (s.admin_email !== user?.email) return false;
    const startDate = s.start_date || s.date;
    const endDate = s.end_date || startDate;
    if (!startDate) return false;
    const monthStart = monthStr + '-01';
    const monthEnd = monthStr + '-31';
    return startDate <= monthEnd && endDate >= monthStart;
  });

  // Build all active days with their reasons
  const allDayMap = useMemo(() => {
    const map = {};

    myMonthShoots.forEach(s => {
      if (!s.date) return;
      if (!map[s.date]) map[s.date] = { date: s.date, shoots: [], standby: false };
      map[s.date].shoots.push(s.title);
    });

    myMonthStandby.forEach(s => {
      const startDate = s.start_date || s.date;
      const endDate = s.end_date || startDate;
      if (!startDate) return;
      try {
        const days = eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) });
        days.forEach(d => {
          const ds = format(d, 'yyyy-MM-dd');
          if (!ds.startsWith(monthStr)) return;
          if (!map[ds]) map[ds] = { date: ds, shoots: [], standby: false };
          map[ds].standby = true;
        });
      } catch { /* ignore */ }
    });

    // Manual additions
    additions.forEach(ds => {
      if (!ds.startsWith(monthStr)) return;
      if (!map[ds]) map[ds] = { date: ds, shoots: [], standby: false, manual: true };
      else map[ds].manual = true;
    });

    return map;
  }, [myMonthShoots, myMonthStandby, additions, monthStr]);

  // Active days = all days in map minus exclusions
  const activeDayEntries = Object.values(allDayMap)
    .filter(d => !exclusions.has(d.date))
    .sort((a, b) => a.date.localeCompare(b.date));

  const excludedEntries = [...exclusions]
    .filter(d => d.startsWith(monthStr) && allDayMap[d])
    .sort();

  const totalHours = activeDayEntries.length * adminDayHours;

  const getReason = (entry) => {
    const parts = [];
    if (entry.shoots.length > 0) parts.push('Shoot');
    if (entry.standby) parts.push('Standby');
    if (entry.manual && parts.length === 0) parts.push('Manual');
    return parts.join(' + ');
  };

  return (
    <Card className="mb-8 border-0 bg-slate-900 shadow-none">
      <CardHeader className="border-0 pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-slate-100 text-base">My Monthly Summary</CardTitle>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-slate-100" onClick={() => goMonth(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium text-slate-400 w-24 text-center">{format(currentMonth, 'MMM yyyy')}</span>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-slate-400 hover:text-slate-100" onClick={() => goMonth(1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="ghost" className="text-slate-400 hover:text-slate-100 gap-1.5 text-xs ml-1"
              onClick={() => setExpanded(!expanded)}>
              {expanded ? 'Less' : 'Details'}
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-4 mb-3">
          <div className="rounded-lg border border-slate-800 bg-slate-800/50 p-3 text-center">
            <Camera className="h-5 w-5 text-orange-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-slate-100">{myMonthShoots.length}</p>
            <p className="text-xs text-slate-400">Shoots</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-800/50 p-3 text-center">
            <Phone className="h-5 w-5 text-amber-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-slate-100">{myMonthStandby.length}</p>
            <p className="text-xs text-slate-400">Standby</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-800/50 p-3 text-center">
            <Clock className="h-5 w-5 text-emerald-400 mx-auto mb-1" />
            <p className="text-2xl font-bold text-slate-100">{totalHours % 1 === 0 ? totalHours : totalHours.toFixed(1)}</p>
            <p className="text-xs text-slate-400">Est. Hours</p>
          </div>
        </div>

        <p className="text-xs text-slate-500 mb-3">
          {activeDayEntries.length} active day{activeDayEntries.length !== 1 ? 's' : ''} × {adminDayHours}h = {totalHours % 1 === 0 ? totalHours : totalHours.toFixed(1)}h
          <span className="italic ml-1 text-slate-600">(deduplicated — shoots & standby on same day count once)</span>
        </p>

        {expanded && (
          <div className="space-y-4">
            {/* Active days breakdown */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Active Days ({activeDayEntries.length})</p>
                <Button size="sm" variant="ghost" className="h-6 text-xs text-orange-400 hover:text-orange-300 gap-1"
                  onClick={() => setAddingDay(!addingDay)}>
                  <Plus className="h-3 w-3" /> Add Day
                </Button>
              </div>

              {addingDay && (
                <div className="flex gap-2 mb-2">
                  <Input type="date" value={newDayInput} onChange={e => setNewDayInput(e.target.value)}
                    className="bg-slate-800 border-slate-800 text-slate-100 h-7 text-xs flex-1" />
                  <Button size="sm" className="h-7 text-xs bg-orange-500 hover:bg-orange-400 px-2" onClick={handleAddDay} disabled={saving}>Add</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-400" onClick={() => setAddingDay(false)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}

              {activeDayEntries.length === 0 && (
                <p className="text-xs text-gray-600 italic py-2">No active days this month.</p>
              )}

              <div className="space-y-1">
                {activeDayEntries.map(entry => (
                  <div key={entry.date} className="flex items-center justify-between bg-slate-800/40 rounded-lg px-3 py-2 gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm text-slate-100 font-medium">
                          {format(new Date(entry.date + 'T12:00:00'), 'EEE, MMM d')}
                        </span>
                        <Badge className={`text-xs px-1.5 py-0 ${
                          entry.shoots.length > 0 && entry.standby ? 'bg-purple-500/20 text-purple-300 border-purple-500/30' :
                          entry.shoots.length > 0 ? 'bg-blue-600/20 text-blue-400 border-blue-800' :
                          entry.standby ? 'bg-yellow-500/20 text-amber-400 border-yellow-500/30' :
                          'bg-gray-600/40 text-slate-400 border-slate-700/40'
                        }`}>
                          {getReason(entry)}
                        </Badge>
                      </div>
                      {entry.shoots.length > 0 && (
                        <p className="text-xs text-slate-500 mt-0.5 truncate">{entry.shoots.join(', ')}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-mono text-emerald-400">{adminDayHours}h</span>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-gray-600 hover:text-red-400"
                        title="Exclude this day from hours count"
                        onClick={() => handleExclude(entry.date)} disabled={saving}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Excluded days */}
            {excludedEntries.length > 0 && (
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Excluded Days ({excludedEntries.length})</p>
                <div className="space-y-1">
                  {excludedEntries.map(dateStr => (
                    <div key={dateStr} className="flex items-center justify-between bg-slate-800/20 rounded-lg px-3 py-2 opacity-50">
                      <span className="text-sm text-slate-400">
                        {format(new Date(dateStr + 'T12:00:00'), 'EEE, MMM d')}
                      </span>
                      <Button size="sm" variant="ghost" className="h-6 text-xs text-orange-400 hover:text-orange-300 px-2"
                        onClick={() => handleInclude(dateStr)} disabled={saving}>
                        Restore
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeDayEntries.length === 0 && excludedEntries.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">Nothing logged for {format(currentMonth, 'MMMM yyyy')}.</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}