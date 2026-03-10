import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wrench, Copy, Check, ChevronDown, ChevronUp, Archive, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { shortenTitle } from '../utils/scheduleUtils';

const ARCHIVE_KEY = 'rigscheck_archived';

function getArchived() {
  try { return JSON.parse(localStorage.getItem(ARCHIVE_KEY) || '[]'); } catch { return []; }
}
function saveArchived(ids) {
  localStorage.setItem(ARCHIVE_KEY, JSON.stringify(ids));
}

function getRigTypeLabel(rig) {
  if (!rig) return null;
  const parts = [];
  if (rig.rig_type) parts.push(rig.rig_type);
  if (rig.sound) parts.push('Sound');
  return parts.length > 0 ? parts.join('/') : null;
}

export default function RigsCheckPanel({ shoots = [], rigSettings = [] }) {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const [checked, setChecked] = useState({});
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [archived, setArchived] = useState(() => getArchived());
  const [showArchived, setShowArchived] = useState(false);

  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 7);
  const endStr = format(endDate, 'yyyy-MM-dd');

  const allUpcoming = shoots.filter(s =>
    s.date >= todayStr && s.date <= endStr && s.status !== 'cancelled'
  ).sort((a, b) => a.date.localeCompare(b.date));

  const activeShoots = allUpcoming.filter(s => !archived.includes(s.id));
  const archivedShoots = allUpcoming.filter(s => archived.includes(s.id));

  const toggle = (id) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));

  const checkedShoots = activeShoots.filter(s => checked[s.id]);

  const generateMessage = () => {
    if (checkedShoots.length === 0) return '';
    const lines = checkedShoots.map(s => {
      const rig = rigSettings.find(r => r.team?.toLowerCase().trim() === s.client?.toLowerCase().trim());
      const label = getRigTypeLabel(rig);
      return `${shortenTitle(s.title)}${label ? ` (${label})` : ''}`;
    });
    return `Rigs ready:\n\n${lines.join('\n')}`;
  };

  const handleCopy = () => {
    const msg = generateMessage();
    if (!msg) return;
    navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleArchiveChecked = () => {
    const newArchived = [...new Set([...archived, ...checkedShoots.map(s => s.id)])];
    setArchived(newArchived);
    saveArchived(newArchived);
    setChecked({});
  };

  const handleUnarchive = (id) => {
    const newArchived = archived.filter(a => a !== id);
    setArchived(newArchived);
    saveArchived(newArchived);
  };

  return (
    <Card className="bg-gray-900 border-gray-800 mt-6">
      <CardHeader className="border-b border-gray-800 pb-3">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-white font-semibold text-base hover:text-blue-400 transition-colors"
          >
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
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleArchiveChecked}
                  className="gap-1.5 text-xs h-7 text-gray-400 hover:text-yellow-400 hover:bg-gray-800"
                  title="Archive checked shoots"
                >
                  <Archive className="h-3 w-3" /> Archive
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleCopy}
                disabled={checkedShoots.length === 0}
                className="bg-blue-700 hover:bg-blue-600 gap-1.5 text-xs h-7"
              >
                {copied ? <><Check className="h-3 w-3" /> Copied!</> : <><Copy className="h-3 w-3" /> Copy Message</>}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-4">
          {activeShoots.length === 0 ? (
            <p className="text-gray-500 text-sm text-center py-4">No upcoming shoots to check.</p>
          ) : (
            <div className="space-y-2.5">
              {activeShoots.map(s => {
                const rig = rigSettings.find(r => r.team?.toLowerCase().trim() === s.client?.toLowerCase().trim());
                const label = getRigTypeLabel(rig);
                return (
                  <label key={s.id} className="flex items-center gap-3 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={!!checked[s.id]}
                      onChange={() => toggle(s.id)}
                      className="w-4 h-4 rounded accent-blue-500 flex-shrink-0"
                    />
                    <span className={`text-sm transition-colors flex-1 ${checked[s.id] ? 'line-through text-gray-500' : 'text-gray-200 group-hover:text-white'}`}>
                      {shortenTitle(s.title)}
                      <span className="text-xs text-gray-500 ml-2 font-mono">
                        {s.date === todayStr ? 'Today' : s.date}{s.game_time ? ` · ${s.game_time}` : ''}
                      </span>
                    </span>
                    {label
                      ? <span className="text-xs text-blue-400 font-mono bg-blue-950/40 border border-blue-800/50 px-2 py-0.5 rounded">({label})</span>
                      : <span className="text-xs text-gray-600 italic">no rig config</span>
                    }
                  </label>
                );
              })}
            </div>
          )}

          {checkedShoots.length > 0 && (
            <div className="mt-4 bg-gray-800/60 rounded-lg p-3 border border-gray-700">
              <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Preview</p>
              <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">{generateMessage()}</pre>
              <p className="text-xs text-gray-500 mt-2">After copying, click <strong className="text-yellow-400">Archive</strong> to remove these from the list.</p>
            </div>
          )}

          {archivedShoots.length > 0 && (
            <div className="mt-4 border-t border-gray-800 pt-3">
              <button
                onClick={() => setShowArchived(!showArchived)}
                className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1.5"
              >
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