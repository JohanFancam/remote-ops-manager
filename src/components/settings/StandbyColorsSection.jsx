import React, { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, Save } from 'lucide-react';
import { STANDBY_COLORS, getStandbyColorMap, colorByName } from '../utils/standbyColors';
import { getDisplayName } from '../utils/nameUtils';

const ROLE_DEFAULT = { operator_standby: 'purple', admin: 'blue', standby: 'green' };

// Admin-only: assign each standby-capable user one of 6 standby colours.
// Stored in AppSettings key `standby_colors` as a JSON { email: colorName } map.
export default function StandbyColorsSection({ appSettings, allUsers }) {
  const queryClient = useQueryClient();
  const initial = useMemo(() => getStandbyColorMap(appSettings), [appSettings]);
  const [colors, setColors] = useState(initial);
  const [saved, setSaved] = useState(false);

  React.useEffect(() => { setColors(initial); }, [initial]);

  const candidates = (allUsers || []).filter(u =>
    ['admin', 'standby', 'operator_standby'].includes(u.role) && !u.inactive
  );

  // Effective colour for a user: explicit override, else role default, else green.
  const effective = (u) => colors[u.email] || ROLE_DEFAULT[u.role] || 'green';

  const setFor = (email, name) => setColors(prev => {
    const next = { ...prev };
    if (name) next[email] = name; else delete next[email];
    return next;
  });

  const handleSave = async () => {
    const value = JSON.stringify(colors);
    const existing = appSettings.find(s => s.key === 'standby_colors');
    if (existing) {
      await base44.entities.AppSettings.update(existing.id, { value });
    } else {
      await base44.entities.AppSettings.create({
        key: 'standby_colors', value,
        description: 'Per-user standby calendar colors (email -> color name)',
      });
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    queryClient.invalidateQueries({ queryKey: ['appSettings'] });
  };

  return (
    <Card className="bg-gray-900 border-gray-800 mb-6">
      <CardHeader className="border-b border-gray-800 pb-4">
        <CardTitle className="text-white flex items-center gap-2">
          <Phone className="h-5 w-5 text-yellow-400" /> Standby Colours
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <p className="text-xs text-gray-500">
          Assign each standby person a colour — it shows on the calendar for their standby coverage.
          Defaults: Operator/Standby = purple, your own coverage = blue, others = green.
        </p>

        <div className="space-y-2">
          {candidates.map(u => {
            const current = effective(u);
            return (
              <div key={u.email} className="flex items-center justify-between gap-3 bg-gray-800/40 rounded-lg px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm text-white truncate">{getDisplayName(u, u.email)}</p>
                  <p className="text-[11px] text-gray-500 truncate">{u.email} · {u.role}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap justify-end">
                  {STANDBY_COLORS.map(c => {
                    const active = current === c.name;
                    const overridden = !!colors[u.email];
                    return (
                      <button
                        key={c.name}
                        type="button"
                        title={c.label + (overridden && active ? ' (custom)' : '')}
                        onClick={() => setFor(u.email, c.name)}
                        className={`h-6 w-6 rounded-full ${c.swatch} border-2 transition-transform ${active ? 'border-white scale-110 ring-2 ring-white/30' : 'border-gray-700 hover:scale-105'}`}
                      />
                    );
                  })}
                  {colors[u.email] && (
                    <button type="button" onClick={() => setFor(u.email, '')} className="text-[10px] text-gray-500 hover:text-gray-300 ml-1 underline">reset</button>
                  )}
                </div>
              </div>
            );
          })}
          {candidates.length === 0 && (
            <p className="text-xs text-gray-500">No standby-capable users found.</p>
          )}
        </div>

        <Button onClick={handleSave} className="bg-blue-700 hover:bg-blue-600 gap-2">
          <Save className="h-4 w-4" /> {saved ? '✓ Saved!' : 'Save Colours'}
        </Button>
      </CardContent>
    </Card>
  );
}