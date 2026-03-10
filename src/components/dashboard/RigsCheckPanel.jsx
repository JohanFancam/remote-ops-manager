import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Wrench, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import { shortenTitle } from '../utils/scheduleUtils';

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

  const todayShoots = shoots.filter(s => s.date === todayStr && s.status !== 'cancelled');

  // always render

  const toggle = (id) => setChecked(prev => ({ ...prev, [id]: !prev[id] }));

  const checkedShoots = todayShoots.filter(s => checked[s.id]);

  const generateMessage = () => {
    if (checkedShoots.length === 0) return '';
    const lines = checkedShoots.map(s => {
      const rig = rigSettings.find(r => r.team?.toLowerCase().trim() === s.client?.toLowerCase().trim());
      const label = getRigTypeLabel(rig);
      return `${shortenTitle(s.title)}${label ? ` (${label})` : ''}`;
    });
    return `Rigs ready for Today's shoots:\n\n${lines.join('\n')}`;
  };

  const handleCopy = () => {
    const msg = generateMessage();
    if (!msg) return;
    navigator.clipboard.writeText(msg);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="bg-gray-900 border-gray-800 mt-6">
      <CardHeader className="border-b border-gray-800 pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Wrench className="h-4 w-4 text-blue-400" />
            Rigs Check — Today
          </CardTitle>
          <Button
            size="sm"
            onClick={handleCopy}
            disabled={checkedShoots.length === 0}
            className="bg-blue-700 hover:bg-blue-600 gap-1.5 text-xs h-7"
          >
            {copied
              ? <><Check className="h-3 w-3" /> Copied!</>
              : <><Copy className="h-3 w-3" /> Copy Message</>
            }
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pt-4">
        {todayShoots.length === 0 && (
          <p className="text-gray-500 text-sm text-center py-4">No shoots scheduled for today.</p>
        )}
        <div className="space-y-2.5">
          {todayShoots.map(s => {
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
                <span className="text-sm text-gray-200 group-hover:text-white transition-colors flex-1">
                  {shortenTitle(s.title)}
                  {s.game_time && <span className="text-xs text-gray-500 ml-2 font-mono">{s.game_time}</span>}
                </span>
                {label
                  ? <span className="text-xs text-blue-400 font-mono bg-blue-950/40 border border-blue-800/50 px-2 py-0.5 rounded">({label})</span>
                  : <span className="text-xs text-gray-600 italic">no rig config</span>
                }
              </label>
            );
          })}
        </div>

        {checkedShoots.length > 0 && (
          <div className="mt-4 bg-gray-800/60 rounded-lg p-3 border border-gray-700">
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-wider">Preview</p>
            <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">{generateMessage()}</pre>
          </div>
        )}
      </CardContent>
    </Card>
  );
}