import React, { useState } from 'react';
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wrench, Copy, Check, ChevronDown, ChevronUp, Archive, RotateCcw } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { shortenTitle } from '../utils/scheduleUtils';

const ARCHIVE_KEY = 'rigscheck_archived';
function getArchived() {
  try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]'); } catch { return []; }
}
function saveArchived(ids) { localStorage.setItem(ARCHIVE_KEY, JSON.stringify(ids)); }

function getRigTypeLabel(rig) {
  if (!rig) return null;
  const parts = [];
  if (rig.rig_type) parts.push(rig.rig_type);
  if (rig.sound) parts.push('Sound');
  return parts.length > 0 ? parts.join('/') : null;
}

export default function RigsCheckPanel({ shoots = [], rigSettings = [], appSettings = [] }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [checked, setChecked] = useState({});
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [archived, setArchived] = useState(() => getArchived());
  const [showArchived, setShowArchived] = useState(false);

  const template = appSettings.find(s => s.key === 'rigscheck_template')?.value
    || 'Rigs ready for today: {list}';

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(new Date(), i);
    return format(d, 'yyyy-MM-dd');
  });

  const allUpcoming = shoots.filter(s =>
    s.date >= days[0] && s.date <= days[days.length - 1] && s.status !== 'cancelled'
  );

  const activeShoots = allUpcoming.filter(s => !archived.includes(s.id));
  const archivedShoots = allUpcoming.filter(s => archived.includes(s.id));

  const toggle = (id) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));
  const checkedShoots = activeShoots.filter(s => checked[s.id]);

  const generateMessage = () => {
    if (checkedShoots.length === 0) return '';
    const items = checkedShoots.map(s => {
      const rig = rigSettings.find(r => r.team?.toLowerCase().trim() === s.client?.toLowerCase().trim());
      const label = getRigTypeLabel(rig);
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

  return (
    <Card className="bg-gray-900 border-gray-800 mt-6">
      <CardHeader className="border-b border-gray-800 pb-3">
        <div className="flex items-center justify-between">
          <button onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-white font-semibold text-base hover:text-blue-400 transition-colors">
            <Wrench className="h-4 w-4 text-blue-400" />
            Rigs Check — Next 7 Days
            {expanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
            {activeShoots.length > 0 && !expanded && (
              <span className="text-xs bg-blue-600/30 text-blue-400 border border-blue-700/50 px-2 py-0.5 rounded-full ml-1">
                {activeShoots.length}
              </span>
            )}
          </button>
          {expanded && (
            <div className="flex gap-2">
              {checkedShoots.length > 0 && (
                <Button size="sm" variant="ghost" onClick={handleArchiveChecked}
                  className="gap-1.5 text-xs h-7 text-gray-400 hover:text-yellow-400 hover:bg-gray-800">
                  <Archive className="h-3 w-3" /> Archive
                </Button>
              )}
              <Button size="sm" onClick={handleCopy} disabled={checkedShoots.length === 0}
                className="bg-blue-700 hover:bg-blue-600 gap-1.5 text-xs h-7">
                {copied ? <><Check className="h-3 w-3" /> Copied!</> : <><Copy className="h-3 w-3" /> Copy Message</>}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-4">
          {/* Day-by-day tile grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-2 mb-4">
            {days.map(dateStr => {
              const isToday = dateStr === todayStr;
              const dayShoots = activeShoots
                .filter(s => s.date === dateStr)
                .sort((a, b) => (a.game_time || '').localeCompare(b.game_time || ''));

              return (
                <div key={dateStr} className={`rounded-xl border p-2.5 min-h-[80px] ${
                  isToday ? 'border-blue-600/50 bg-blue-950/20' :
                  dayShoots.length > 0 ? 'border-gray-700/50 bg-gray-800/30' :
                  'border-gray-800/40 bg-gray-900/20'
                }`}>
                  <div className="mb-2">
                    <p className={`text-xs font-semibold ${isToday ? 'text-blue-400' : 'text-gray-400'}`}>
                      {isToday ? 'Today' : format(new Date(dateStr + 'T12:00:00'), 'EEE')}
                    </p>
                    <p className={`text-base font-bold leading-tight ${isToday ? 'text-blue-300' : 'text-gray-300'}`}>
                      {format(new Date(dateStr + 'T12:00:00'), 'd MMM')}
                    </p>
                  </div>

                  {dayShoots.length === 0 ? (
                    <p className="text-xs text-gray-700 italic">No shoots</p>
                  ) : (
                    <div className="space-y-1.5">
                      {dayShoots.map(s => {
                        const rig = rigSettings.find(r => r.team?.toLowerCase().trim() === s.client?.toLowerCase().trim());
                        const label = getRigTypeLabel(rig);
                        return (
                          <label key={s.id} className="flex items-start gap-1.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={!!checked[s.id]}
                              onChange={() => toggle(s.id)}
                              className="w-3.5 h-3.5 rounded accent-blue-500 flex-shrink-0 mt-0.5"
                            />
                            <div className={`text-xs ${checked[s.id] ? 'line-through text-gray-600' : 'text-gray-200 group-hover:text-white'}`}>
                              <div className="font-medium truncate">{shortenTitle(s.title)}</div>
                              {s.game_time && <div className="text-gray-500 font-mono">{s.game_time}</div>}
                              {label
                                ? <span className="text-blue-400 font-mono">{label}</span>
                                : <span className="text-gray-600 italic">no rig</span>
                              }
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Preview */}
          {checkedShoots.length > 0 && (
            <div className="bg-gray-800/60 rounded-lg p-3 border border-gray-700 mb-3">
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Preview</p>
              <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">{generateMessage()}</pre>
              <p className="text-xs text-gray-500 mt-2">After copying, click <strong className="text-yellow-400">Archive</strong> to remove from list.</p>
            </div>
          )}

          {activeShoots.length === 0 && (
            <p className="text-gray-500 text-sm text-center py-4">No upcoming shoots to check.</p>
          )}

          {/* Archived */}
          {archivedShoots.length > 0 && (
            <div className="border-t border-gray-800 pt-3">
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
        </CardContent>
      )}
    </Card>
  );
}