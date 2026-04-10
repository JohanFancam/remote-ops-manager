import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Wrench, Copy, Check, Archive, RotateCcw, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth } from 'date-fns';
import { shortenTitle } from '../utils/scheduleUtils';

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

function getCalendarGrid(month) {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
  return eachDayOfInterval({ start, end });
}

const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function RigsCheckPanel({ shoots = [], rigSettings = [], appSettings = [] }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [calMonth, setCalMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);
  const [checked, setChecked] = useState({});
  const [copied, setCopied] = useState(false);
  const [archived, setArchived] = useState(() => getArchived());
  const [showArchived, setShowArchived] = useState(false);

  const template = appSettings.find(s => s.key === 'rigscheck_template')?.value || 'Rigs ready for today: {list}';

  const calDays = getCalendarGrid(calMonth);
  const gridStart = format(calDays[0], 'yyyy-MM-dd');
  const gridEnd = format(calDays[calDays.length - 1], 'yyyy-MM-dd');

  const allVisible = shoots.filter(s =>
    s.date >= gridStart && s.date <= gridEnd && s.status !== 'cancelled'
  );

  const activeShoots = allVisible.filter(s => !archived.includes(s.id));
  const archivedShoots = allVisible.filter(s => archived.includes(s.id));

  const getShootsForDay = (dateStr) =>
    activeShoots.filter(s => s.date === dateStr)
      .sort((a, b) => (a.game_time || '').localeCompare(b.game_time || ''));

  const toggle = (id) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));

  const monthShootCount = activeShoots.filter(s => s.date?.startsWith(format(calMonth, 'yyyy-MM'))).length;
  const checkedShoots = activeShoots.filter(s => checked[s.id]);

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

  const selectedShoots = selectedDay ? getShootsForDay(selectedDay) : [];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-orange-400" />
          <span className="text-white font-semibold">{format(calMonth, 'MMMM yyyy')}</span>
          <span className="text-xs bg-orange-600/20 text-orange-400 border border-orange-700/40 px-2 py-0.5 rounded-full">
            {monthShootCount} shoots
          </span>
        </div>
        <div className="flex items-center gap-2">
          {checkedShoots.length > 0 && (
            <>
              <Button size="sm" variant="ghost" onClick={handleArchiveChecked}
                className="gap-1.5 text-xs h-7 text-gray-400 hover:text-yellow-400 hover:bg-gray-800">
                <Archive className="h-3 w-3" /> Archive
              </Button>
              <Button size="sm" onClick={handleCopy}
                className="bg-blue-700 hover:bg-blue-600 gap-1.5 text-xs h-7">
                {copied ? <><Check className="h-3 w-3" /> Copied!</> : <><Copy className="h-3 w-3" /> Copy Message</>}
              </Button>
            </>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white"
            onClick={() => { setCalMonth(subMonths(calMonth, 1)); setSelectedDay(null); }}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-gray-400 hover:text-white"
            onClick={() => { setCalMonth(addMonths(calMonth, 1)); setSelectedDay(null); }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
        {DOW.map(d => <div key={d} className="text-xs text-gray-500 py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5 mb-4">
        {calDays.map(day => {
          const dateStr = format(day, 'yyyy-MM-dd');
          const inMonth = isSameMonth(day, calMonth);
          const isToday = dateStr === todayStr;
          const dayShoots = getShootsForDay(dateStr);
          const hasChecked = dayShoots.some(s => checked[s.id]);
          const isSelected = selectedDay === dateStr;

          let bg = inMonth ? 'rgba(31,41,55,0.6)' : 'rgba(17,24,39,0.3)';
          if (dayShoots.length > 0) bg = 'rgba(124,45,18,0.25)';
          if (hasChecked) bg = 'rgba(124,45,18,0.5)';

          return (
            <button
              key={dateStr}
              onClick={() => inMonth && setSelectedDay(isSelected ? null : dateStr)}
              className={`rounded-md p-1 min-h-[52px] text-left transition-all
                ${!inMonth ? 'opacity-25 cursor-default' : 'cursor-pointer hover:ring-1 hover:ring-gray-500'}
                ${isSelected ? 'ring-2 ring-orange-400' : ''}
                ${isToday ? 'ring-1 ring-blue-500' : ''}`}
              style={{ background: bg }}
            >
              <span className={`text-xs font-medium block ${isToday ? 'text-blue-400 font-bold' : dayShoots.length > 0 ? 'text-orange-300' : 'text-gray-500'}`}>
                {format(day, 'd')}
              </span>
              {inMonth && dayShoots.length > 0 && (
                <div className="mt-0.5 space-y-0.5">
                  {dayShoots.slice(0, 2).map(s => (
                    <div key={s.id} className={`text-xs truncate leading-tight ${checked[s.id] ? 'line-through text-gray-600' : 'text-orange-200'}`}>
                      {shortenTitle(s.title)}
                    </div>
                  ))}
                  {dayShoots.length > 2 && <div className="text-xs text-gray-500">+{dayShoots.length - 2}</div>}
                </div>
              )}
              {isToday && <div className="w-1 h-1 rounded-full bg-blue-400 mt-0.5 mx-auto" />}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 flex-wrap">
        <span className="flex items-center gap-1.5 text-xs text-gray-400">
          <span className="w-3 h-3 rounded inline-block" style={{ background: 'rgba(124,45,18,0.4)' }} /> Has Shoots
        </span>
        <span className="flex items-center gap-1.5 text-xs text-gray-400 italic">Click a day to check off rigs</span>
      </div>

      {/* Preview */}
      {checkedShoots.length > 0 && (
        <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700 mb-4">
          <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Message Preview</p>
          <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">{generateMessage()}</pre>
          <p className="text-xs text-gray-500 mt-2">After copying, click <strong className="text-yellow-400">Archive</strong> to remove from list.</p>
        </div>
      )}

      {/* Day detail */}
      {selectedDay && (
        <div className="bg-gray-800/60 border border-orange-700/40 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-white">
              {format(new Date(selectedDay + 'T12:00:00'), 'EEEE, MMMM d yyyy')}
            </p>
            <button onClick={() => setSelectedDay(null)} className="text-gray-500 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          {selectedShoots.length === 0 ? (
            <p className="text-xs text-gray-500">No shoots scheduled for this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedShoots.map(s => {
                const rig = rigSettings.find(r => r.team?.toLowerCase().trim() === s.client?.toLowerCase().trim());
                const label = getRigTypeLabel(s, rig);
                return (
                  <label key={s.id} className="flex items-start gap-3 cursor-pointer group p-2.5 rounded-lg bg-gray-900/50 border border-gray-700/50 hover:border-orange-700/40 transition-colors">
                    <input
                      type="checkbox"
                      checked={!!checked[s.id]}
                      onChange={() => toggle(s.id)}
                      className="w-4 h-4 rounded accent-orange-500 flex-shrink-0 mt-0.5"
                    />
                    <div className={`flex-1 ${checked[s.id] ? 'line-through text-gray-600' : 'text-gray-200'}`}>
                      <div className="font-medium text-sm">{shortenTitle(s.title)}</div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {s.game_time && <span className="text-xs text-gray-500 font-mono">{s.game_time}</span>}
                        {label
                          ? <span className="text-xs text-blue-400 font-mono">{label}</span>
                          : <span className="text-xs text-gray-600 italic">no rig</span>
                        }
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Archived */}
      {archivedShoots.length > 0 && (
        <div className="border-t border-gray-800 pt-3 mt-4">
          <button onClick={() => setShowArchived(!showArchived)}
            className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1.5">
            <Archive className="h-3 w-3" />
            {showArchived ? 'Hide' : 'Show'} archived ({archivedShoots.length})
          </button>
          {showArchived && (
            <div className="mt-2 space-y-2">
              {archivedShoots.map(s => (
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