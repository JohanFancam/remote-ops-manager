import React, { useState, useMemo } from 'react';
import { Button } from "@/components/ui/button";
import { Wrench, Copy, Check, Archive, RotateCcw, ChevronLeft, ChevronRight, X, Calendar, Plus, Trash2, Pencil } from 'lucide-react';
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

// Returns shoots for a "6am → 6am" operational day window
// e.g. dateStr = "2026-04-13" returns shoots from Apr 13 06:00 to Apr 14 05:59
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

  // Start week from today's Sunday
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

  // Checklist
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

  const template = appSettings.find(s => s.key === 'rigscheck_template')?.value || 'Rigs ready for today: {list}';

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
      return label ? `${name} (${label})` : name;
    });
    return template.replace('{list}', items.join(', '));
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

  // Calendar for jumping to a week
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

  // Archived shoots within the visible window (any operational day in week)
  const allWeekShoots = days7.flatMap(d => getShootsForOperationalDay(shoots, d));
  const archivedWeekShoots = [...new Map(allWeekShoots.filter(s => archived.includes(s.id)).map(s => [s.id, s])).values()];

  return (
    <div>
      {/* Header controls */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-orange-400" />
          <span className="text-white font-semibold text-sm">{weekLabel}</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {checkedShoots.length > 0 && (
            <>
              <Button size="sm" variant="ghost" onClick={handleArchiveChecked}
                className="gap-1.5 text-xs h-7 text-gray-400 hover:text-yellow-400 hover:bg-gray-800">
                <Archive className="h-3 w-3" /> Archive ({checkedShoots.length})
              </Button>
              <Button size="sm" onClick={handleCopy}
                className="bg-blue-700 hover:bg-blue-600 gap-1.5 text-xs h-7">
                {copied ? <><Check className="h-3 w-3" /> Copied!</> : <><Copy className="h-3 w-3" /> Copy Message</>}
              </Button>
            </>
          )}
          <Button variant="ghost" size="sm" className="h-7 text-xs text-gray-400 hover:text-white gap-1"
            onClick={() => setShowCalendar(!showCalendar)}>
            <Calendar className="h-3.5 w-3.5" /> Calendar
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white" onClick={prevWeek}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white" onClick={nextWeek}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Mini calendar jumper */}
      {showCalendar && (
        <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400"
              onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-semibold text-white">{format(calMonth, 'MMMM yyyy')}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400"
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
                  className={`rounded p-1 min-h-[36px] transition-all ${inMonth ? 'hover:bg-gray-700' : 'opacity-30'} ${isToday ? 'ring-1 ring-blue-500' : ''} ${inCurrentWeek ? 'bg-orange-900/30 ring-1 ring-orange-600/50' : ''}`}>
                  <span className={`text-xs block ${isToday ? 'text-blue-400 font-bold' : inMonth ? 'text-gray-300' : 'text-gray-600'}`}>{format(day, 'd')}</span>
                  {dayOpsCount > 0 && <span className="text-xs text-orange-400 font-bold">{dayOpsCount}</span>}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-gray-500 mt-2 text-center">Click any date to jump to that week</p>
        </div>
      )}

      {/* Message Preview */}
      {checkedShoots.length > 0 && (
        <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700 mb-4">
          <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Message Preview</p>
          <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">{generateMessage()}</pre>
        </div>
      )}

      {/* 7-Day Tile Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
        {days7.map(dateStr => {
          const dayShoots = getShootsForOperationalDay(shoots, dateStr).filter(s => !archived.includes(s.id));
          const isToday = dateStr === todayStr;
          const isPast = dateStr < todayStr;
          const dayChecked = dayShoots.filter(s => checked[s.id]);

          // Label the "6am → 6am" window
          const nextDateStr = format(addDays(new Date(dateStr + 'T12:00:00'), 1), 'yyyy-MM-dd');
          const hasEarlyNext = dayShoots.some(s => s.date === nextDateStr);

          return (
            <div key={dateStr} className={`rounded-xl border flex flex-col ${
              isToday ? 'border-blue-600/60 bg-blue-950/10' :
              isPast ? 'border-gray-800 bg-gray-900/40 opacity-70' :
              dayShoots.length > 0 ? 'border-orange-800/50 bg-orange-950/10' :
              'border-gray-800 bg-gray-900/30'
            }`}>
              {/* Day header */}
              <div className={`flex items-center justify-between px-3 py-2.5 rounded-t-xl border-b ${
                isToday ? 'border-blue-700/40 bg-blue-950/20' : 'border-gray-800'
              }`}>
                <div>
                  <p className={`text-sm font-bold ${isToday ? 'text-blue-300' : isPast ? 'text-gray-600' : 'text-white'}`}>
                    {format(new Date(dateStr + 'T12:00:00'), 'EEE, MMM d')}
                    {isToday && <span className="ml-1.5 text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded-full">Today</span>}
                  </p>
                  {hasEarlyNext && (
                    <p className="text-xs text-orange-400/70 mt-0.5">incl. early AM {format(new Date(nextDateStr + 'T12:00:00'), 'MMM d')}</p>
                  )}
                </div>
                {dayShoots.length > 0 && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                    dayChecked.length === dayShoots.length ? 'bg-green-700/30 text-green-400' : 'bg-orange-700/30 text-orange-400'
                  }`}>
                    {dayChecked.length}/{dayShoots.length}
                  </span>
                )}
              </div>

              {/* Shoots list */}
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
                          ? 'bg-green-950/30 border-green-800/40'
                          : 'bg-gray-800/50 border-gray-700/40 hover:border-orange-700/40'
                      }`}>
                        <input
                          type="checkbox"
                          checked={!!checked[s.id]}
                          onChange={() => toggle(s.id)}
                          className="w-3.5 h-3.5 rounded accent-orange-500 flex-shrink-0 mt-0.5"
                        />
                        <div className={`flex-1 min-w-0 ${checked[s.id] ? 'opacity-50' : ''}`}>
                          <p className={`text-xs font-semibold truncate ${checked[s.id] ? 'line-through text-gray-500' : 'text-white'}`}>
                            {shortenTitle(s.title)}
                          </p>
                          {s.location && (
                            <p className={`text-xs truncate mt-0.5 ${checked[s.id] ? 'text-gray-600' : 'text-gray-500'}`}>{s.location}</p>
                          )}
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {s.game_time && (
                              <span className={`text-xs font-mono ${isEarly ? 'text-orange-400' : 'text-gray-500'}`}>
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
      <div className="border border-gray-800 rounded-xl overflow-hidden mb-4">
        <div className="flex items-center justify-between px-4 py-3 bg-gray-800/40 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-green-400" />
            <span className="text-sm font-semibold text-white">Rig Check Reference List</span>
            <span className="text-xs text-gray-500">({checklistItems.length} items)</span>
          </div>
          {isAdmin && (
            <Button size="sm" variant="ghost" className="h-7 text-xs text-gray-400 hover:text-white gap-1"
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
              <span className={`text-sm flex-1 ${checklistChecked[idx] ? 'line-through text-gray-600' : 'text-gray-300'}`}>{item}</span>
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
            <div className="flex gap-2 mt-2 pt-2 border-t border-gray-800">
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
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-1.5 text-sm text-white placeholder:text-gray-600 focus:border-green-600 outline-none"
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

      {/* Archived */}
      {archivedWeekShoots.length > 0 && (
        <div className="border-t border-gray-800 pt-3">
          <button onClick={() => setShowArchived(!showArchived)}
            className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1.5">
            <Archive className="h-3 w-3" />
            {showArchived ? 'Hide' : 'Show'} archived this week ({archivedWeekShoots.length})
          </button>
          {showArchived && (
            <div className="mt-2 space-y-1">
              {archivedWeekShoots.map(s => (
                <div key={s.id} className="flex items-center gap-3 opacity-50">
                  <span className="text-sm text-gray-500 line-through flex-1">{shortenTitle(s.title)}</span>
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