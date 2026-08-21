import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Wrench, Copy, Check, Archive, RotateCcw, ChevronLeft, ChevronRight, X, Calendar, Plus, Pencil } from 'lucide-react';
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth } from 'date-fns';
import { shortenTitle } from '../utils/scheduleUtils';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';

const ARCHIVE_KEY = 'rigscheck_archived';
function getArchived() {
  try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]'); } catch { return []; }
}
function saveArchived(ids) { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(ids)); }

function getRigTypeLabel(shoot, rig) {
  if (shoot?.rig_type_override) {
    const parts = [shoot.rig_type_override];
    if (rig?.sound) parts.push('Sound');
    return parts.join('/');
  }
  if (!rig) return null;
  const parts = [];
  if (rig.rig_type) parts.push(rig.rig_type);
  if (rig.sound) parts.push('Sound');
  return parts.length > 0 ? parts.join('/') : null;
}

function getShootsForOperationalDay(shoots, dateStr) {
  const nextDateStr = format(addDays(new Date(dateStr + 'T12:00:00'), 1), 'yyyy-MM-dd');
  const sameDay = shoots.filter(s =>
    s.date === dateStr &&
    s.status !== 'cancelled' &&
    (!s.game_time || s.game_time >= '06:00')
  ).sort((a, b) => (a.game_time || '06:00').localeCompare(b.game_time || '06:00'));

  const nextDayEarly = shoots.filter(s =>
    s.date === nextDateStr &&
    s.status !== 'cancelled' &&
    s.game_time && s.game_time < '06:00'
  ).sort((a, b) => a.game_time.localeCompare(b.game_time));

  return [...sameDay, ...nextDayEarly];
}

function get7Days(startDateStr) {
  const days = [];
  for (let i = 0; i < 7; i++) {
    days.push(format(addDays(new Date(startDateStr + 'T12:00:00'), i), 'yyyy-MM-dd'));
  }
  return days;
}

const DOW_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function RigsCheckPanel({ shoots = [], rigSettings = [], appSettings = [], isAdmin = false }) {
  const queryClient = useQueryClient();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const getWeekStart = (dateStr) => {
    const d = new Date(dateStr + 'T12:00:00');
    const dow = d.getDay();
    return format(addDays(d, -dow), 'yyyy-MM-dd');
  };

  const [weekStart, setWeekStart] = useState(() => getWeekStart(todayStr));
  const [showCalendar, setShowCalendar] = useState(false);
  const [calMonth, setCalMonth] = useState(new Date());
  const [checked, setChecked] = useState({});
  const [copied, setCopied] = useState(false);
  const [archived, setArchived] = useState(() => getArchived());
  const [showArchived, setShowArchived] = useState(false);
  const [messageHeading, setMessageHeading] = useState('Shoots ready for today:');
  const [editingHeading, setEditingHeading] = useState(false);

  const checklistSetting = appSettings.find(s => s.key === 'rigscheck_checklist');
  const [checklistItems, setChecklistItems] = useState(() => {
    try { return JSON.parse(checklistSetting?.value || '[]'); } catch { return []; }
  });
  const [editingChecklist, setEditingChecklist] = useState(false);
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const [checklistChecked, setChecklistChecked] = useState({});

  const saveChecklistItems = async (items) => {
    if (checklistSetting?.id) {
      await base44.entities.AppSettings.update(checklistSetting.id, { value: JSON.stringify(items) });
    } else {
      await base44.entities.AppSettings.create({ key: 'rigscheck_checklist', value: JSON.stringify(items), description: 'Rig check reference checklist items' });
    }
    queryClient.invalidateQueries({ queryKey: ['appSettings'] });
  };

  const days7 = get7Days(weekStart);
  const prevWeek = () => setWeekStart(format(addDays(new Date(weekStart + 'T12:00:00'), -7), 'yyyy-MM-dd'));
  const nextWeek = () => setWeekStart(format(addDays(new Date(weekStart + 'T12:00:00'), 7), 'yyyy-MM-dd'));
  const toggle = (id) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));

  const checkedShoots = useMemo(() => {
    return shoots.filter(s => checked[s.id] && !archived.includes(s.id));
  }, [shoots, checked, archived]);

  const generateMessage = () => {
    if (checkedShoots.length === 0) return '';
    const items = checkedShoots.map(s => {
      const rig = rigSettings.find(r => r.team?.toLowerCase().trim() === s.client?.toLowerCase().trim());
      const label = getRigTypeLabel(s, rig);
      const name = shortenTitle(s.title);
      return `• ${name}${label ? ` (${label})` : ''}`;
    });
    return `${messageHeading}\n\n${items.join('\n')}`;
  };

  const handleCopy = () => {
    const msg = generateMessage();
    if (!msg) return;
    navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleArchiveChecked = () => {
    const next = [...new Set([...archived, ...checkedShoots.map(s => s.id)])];
    setArchived(next); saveArchived(next); setChecked({});
  };

  const handleUnarchive = (id) => {
    const next = archived.filter(a => a !== id);
    setArchived(next); saveArchived(next);
  };

  const calDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(calMonth), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(calMonth), { weekStartsOn: 0 })
  });

  const jumpToWeek = (dateStr) => {
    setWeekStart(getWeekStart(dateStr));
    setShowCalendar(false);
    setCalMonth(new Date(dateStr + 'T12:00:00'));
  };

  const weekEndStr = days7[6];
  const weekLabel = (() => {
    const s = new Date(weekStart + 'T12:00:00');
    const e = new Date(weekEndStr + 'T12:00:00');
    if (format(s, 'MMM') === format(e, 'MMM')) {
      return `${format(s, 'MMM d')} – ${format(e, 'd, yyyy')}`;
    }
    return `${format(s, 'MMM d')} – ${format(e, 'MMM d, yyyy')}`;
  })();

  const allWeekShoots = days7.flatMap(d => getShootsForOperationalDay(shoots, d));
  const archivedWeekShoots = [...new Map(allWeekShoots.filter(s => archived.includes(s.id)).map(s => [s.id, s])).values()];

  return (
    <div>
      {/* Header controls */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-orange-400" />
          <span className="text-slate-100 font-semibold text-sm">{weekLabel}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {checkedShoots.length > 0 && (
            <Button size="sm" variant="ghost" onClick={handleArchiveChecked}
              className="gap-1.5 text-xs h-7 text-slate-400 hover:text-amber-400 hover:bg-slate-800">
              <Archive className="h-3 w-3" /> Archive ({checkedShoots.length})
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-400 hover:text-slate-100 gap-1"
            onClick={() => setShowCalendar(!showCalendar)}>
            <Calendar className="h-3.5 w-3.5" /> Calendar
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-100" onClick={prevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-100" onClick={nextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mini calendar jumper */}
      {showCalendar && (
        <div className="bg-slate-800 border border-slate-800 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400"
              onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold text-slate-100">{format(calMonth, 'MMMM yyyy')}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400"
              onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
            {DOW_SHORT.map(d => <div key={d} className="text-xs text-gray-600 py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {calDays.map(day => {
              const ds = format(day, 'yyyy-MM-dd');
              const inMonth = isSameMonth(day, calMonth);
              const isToday = ds === todayStr;
              const inCurrentWeek = ds >= weekStart && ds <= weekEndStr;
              const dayOpsCount = getShootsForOperationalDay(shoots, ds).filter(s => !archived.includes(s.id)).length;
              return (
                <button key={ds} onClick={() => jumpToWeek(ds)}
                  className={`rounded p-1 min-h-[36px] transition-all ${inMonth ? 'hover:bg-slate-700' : 'opacity-30'} ${isToday ? 'ring-1 ring-blue-500' : ''} ${inCurrentWeek ? 'bg-orange-900/30 ring-1 ring-orange-600/50' : ''}`}>
                  <span className={`text-xs block ${isToday ? 'text-blue-400 font-bold' : inMonth ? 'text-slate-400' : 'text-gray-600'}`}>{format(day, 'd')}</span>
                  {dayOpsCount > 0 && <span className="text-xs text-orange-400 font-bold">{dayOpsCount}</span>}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-slate-500 mt-2 text-center">Click any date to jump to that week</p>
        </div>
      )}

      {/* 7-Day Tile Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
        {days7.map(dateStr => {
          const dayShoots = getShootsForOperationalDay(shoots, dateStr).filter(s => !archived.includes(s.id));
          const isToday = dateStr === todayStr;
          const isPast = dateStr < todayStr;
          const dayChecked = dayShoots.filter(s => checked[s.id]);
          const nextDateStr = format(addDays(new Date(dateStr + 'T12:00:00'), 1), 'yyyy-MM-dd');
          const hasEarlyNext = dayShoots.some(s => s.date === nextDateStr);

          return (
            <div key={dateStr} className={`rounded-xl border flex flex-col ${
              isToday ? 'border-blue-500/60 bg-blue-950/40' :
              isPast ? 'border-slate-800 bg-slate-900/40 opacity-70' :
              dayShoots.length > 0 ? 'border-orange-800/50 bg-orange-950/10' :
              'border-slate-800 bg-slate-900/30'
            }`}>
              <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl border-b ${
                isToday ? 'border-blue-800 bg-blue-950/40' : 'border-slate-800'
              }`}>
                <div>
                  <p className={`text-sm font-bold ${isToday ? 'text-blue-400' : isPast ? 'text-gray-600' : 'text-slate-100'}`}>
                    {format(new Date(dateStr + 'T12:00:00'), 'EEE, MMM d')}
                    {isToday && <span className="ml-1.5 text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full">Today</span>}
                  </p>
                  {hasEarlyNext && (
                    <p className="text-xs text-orange-400/70 mt-0.5">incl. early AM {format(new Date(nextDateStr + 'T12:00:00'), 'MMM d')}</p>
                  )}
                </div>
                {dayShoots.length > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    dayChecked.length === dayShoots.length ? 'bg-green-700/30 text-emerald-400' : 'bg-orange-700/30 text-orange-400'
                  }`}>
                    {dayChecked.length}/{dayShoots.length}
                  </span>
                )}
              </div>

              <div className="flex-1 p-2 space-y-1.5">
                {dayShoots.length === 0 ? (
                  <p className="text-xs text-gray-700 italic text-center py-3">No shoots</p>
                ) : (
                  dayShoots.map(s => {
                    const rig = rigSettings.find(r => r.team?.toLowerCase().trim() === s.client?.toLowerCase().trim());
                    const label = getRigTypeLabel(s, rig);
                    const isEarly = s.date === nextDateStr;
                    return (
                      <label key={s.id} className={`flex items-start gap-2 cursor-pointer p-2 rounded-lg border transition-colors ${
                        checked[s.id]
                          ? 'bg-emerald-950/40 border-green-800/40'
                          : 'bg-slate-50 border-slate-800/40 hover:border-orange-700/40'
                      }`}>
                        <input
                          type="checkbox"
                          checked={!!checked[s.id]}
                          onChange={() => toggle(s.id)}
                          className="w-3.5 h-3.5 rounded accent-orange-500 flex-shrink-0 mt-0.5"
                        />
                        <div className={`flex-1 min-w-0 ${checked[s.id] ? 'opacity-50' : ''}`}>
                          <p className={`text-xs font-semibold truncate ${checked[s.id] ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                            {shortenTitle(s.title)}
                          </p>
                          {s.location && (
                            <p className={`text-xs truncate mt-0.5 ${checked[s.id] ? 'text-gray-600' : 'text-slate-500'}`}>{s.location}</p>
                          )}
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {s.game_time && (
                              <span className={`text-xs font-mono ${isEarly ? 'text-orange-400' : 'text-slate-500'}`}>
                                {isEarly ? `▸ ${s.game_time}` : s.game_time}
                              </span>
                            )}
                            {label && <span className="text-xs text-blue-400 font-mono">{label}</span>}
                          </div>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Reference Checklist */}
      <div className="border border-slate-800 rounded-xl overflow-hidden mb-4">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800/40 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-emerald-400" />
            <span className="text-sm font-semibold text-slate-100">Rig Check Reference List</span>
            <span className="text-xs text-slate-500">({checklistItems.length} items)</span>
          </div>
          {isAdmin && (
            <Button size="sm" variant="ghost" className="h-7 text-xs text-slate-400 hover:text-slate-100 gap-1"
              onClick={() => setEditingChecklist(!editingChecklist)}>
              <Pencil className="h-3 w-3" /> {editingChecklist ? 'Done' : 'Edit'}
            </Button>
          )}
        </div>
        <div className="p-3 space-y-1.5">
          {checklistItems.length === 0 && !editingChecklist && (
            <p className="text-xs text-gray-600 italic text-center py-2">
              {isAdmin ? 'No items yet — click Edit to add check items.' : 'No checklist items configured.'}
            </p>
          )}
          {checklistItems.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2 group">
              <input
                type="checkbox"
                checked={!!checklistChecked[idx]}
                onChange={() => setChecklistChecked(prev => ({ ...prev, [idx]: !prev[idx] }))}
                className="w-3.5 h-3.5 rounded accent-green-500 flex-shrink-0"
              />
              <span className={`text-sm flex-1 ${checklistChecked[idx] ? 'line-through text-gray-600' : 'text-slate-400'}`}>{item}</span>
              {editingChecklist && isAdmin && (
                <button
                  onClick={async () => {
                    const next = checklistItems.filter((_, i) => i !== idx);
                    setChecklistItems(next);
                    await saveChecklistItems(next);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 transition-all">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          {editingChecklist && isAdmin && (
            <div className="flex gap-2 mt-2 pt-2 border-t border-slate-800">
              <input
                type="text"
                value={newChecklistItem}
                onChange={e => setNewChecklistItem(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Enter' && newChecklistItem.trim()) {
                    const next = [...checklistItems, newChecklistItem.trim()];
                    setChecklistItems(next);
                    setNewChecklistItem('');
                    await saveChecklistItems(next);
                  }
                }}
                placeholder="Add check item... (Enter to save)"
                className="flex-1 bg-slate-800 border border-slate-800 rounded px-3 py-1.5 text-sm text-slate-100 placeholder:text-gray-600 focus:border-green-600 outline-none"
              />
              <Button size="sm" className="h-8 text-xs bg-green-700 hover:bg-green-600"
                onClick={async () => {
                  if (!newChecklistItem.trim()) return;
                  const next = [...checklistItems, newChecklistItem.trim()];
                  setChecklistItems(next);
                  setNewChecklistItem('');
                  await saveChecklistItems(next);
                }}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Message / Copy section */}
      <div className="border border-slate-800 rounded-xl overflow-hidden mb-4">
        <div className="flex items-center justify-between px-4 py-3 bg-slate-800/40 border-b border-slate-800">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Copy className="h-4 w-4 text-blue-400 flex-shrink-0" />
            {editingHeading ? (
              <input autoFocus type="text" value={messageHeading} onChange={e => setMessageHeading(e.target.value)}
                onBlur={() => setEditingHeading(false)} onKeyDown={e => e.key === 'Enter' && setEditingHeading(false)}
                className="flex-1 bg-slate-700 border border-slate-700 rounded px-2 py-0.5 text-sm text-slate-100 outline-none focus:border-blue-500" />
            ) : (
              <button onClick={() => setEditingHeading(true)} className="text-sm font-semibold text-slate-100 hover:text-blue-400 text-left truncate">
                {messageHeading} <span className="text-gray-600 text-xs">(click to edit)</span>
              </button>
            )}
          </div>
          {checkedShoots.length > 0 && (
            <Button size="sm" onClick={handleCopy} className="bg-blue-600 hover:bg-blue-600 gap-1.5 text-xs h-7 ml-2">
              {copied ? <><Check className="h-3 w-3" /> Copied!</> : <><Copy className="h-3 w-3" /> Copy</>}
            </Button>
          )}
        </div>
        <div className="p-4">
          {checkedShoots.length === 0 ? (
            <p className="text-xs text-gray-600 italic">Tick shoots above to build your message here.</p>
          ) : (
            <div className="space-y-1.5">
              {checkedShoots.map(s => {
                const rig = rigSettings.find(r => r.team?.toLowerCase().trim() === s.client?.toLowerCase().trim());
                const label = getRigTypeLabel(s, rig);
                return (
                  <div key={s.id} className="flex items-start gap-2 text-sm text-slate-400">
                    <span className="text-blue-400 mt-0.5 flex-shrink-0">•</span>
                    <span>
                      <span className="font-medium text-slate-100">{shortenTitle(s.title)}</span>
                      {label && <span className="text-blue-400 ml-1">({label})</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Archived */}
      {archivedWeekShoots.length > 0 && (
        <div className="border-t border-slate-800 pt-3">
          <button onClick={() => setShowArchived(!showArchived)}
            className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1.5">
            <Archive className="h-3 w-3" />
            {showArchived ? 'Hide' : 'Show'} archived this week ({archivedWeekShoots.length})
          </button>
          {showArchived && (
            <div className="mt-2 space-y-1">
              {archivedWeekShoots.map(s => (
                <div key={s.id} className="flex items-center gap-3 opacity-50">
                  <span className="text-sm text-slate-500 line-through flex-1">{shortenTitle(s.title)}</span>
                  <button onClick={() => handleUnarchive(s.id)} className="text-gray-600 hover:text-blue-400" title="Restore">
                    <RotateCcw className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}