import React, { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Image } from 'lucide-react';
import { readTileLogoSettings } from '@/utils/teamLogos';

async function upsertSetting(appSettings, key, value, description) {
  const existing = appSettings.find((item) => item.key === key);
  if (existing) {
    await base44.entities.AppSettings.update(existing.id, { value });
  } else {
    await base44.entities.AppSettings.create({ key, value, description });
  }
}

export default function TileLogoSettings({ appSettings = [] }) {
  const queryClient = useQueryClient();
  const stored = readTileLogoSettings(appSettings);
  const [enabled, setEnabled] = useState(stored.enabled);
  const [size, setSize] = useState(stored.sizePercent);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEnabled(stored.enabled);
    setSize(stored.sizePercent);
  }, [stored.enabled, stored.sizePercent]);

  const persist = async (nextEnabled, nextSize) => {
    setSaving(true);
    try {
      await upsertSetting(appSettings, 'tile_logos_enabled', nextEnabled ? 'true' : 'false', 'Show team marks on dashboard tiles');
      await upsertSetting(appSettings, 'tile_logos_size', String(nextSize), 'Dashboard tile logo size percent');
      queryClient.invalidateQueries({ queryKey: ['appSettings'] });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="bg-slate-900 border-slate-800 mt-4">
      <CardHeader className="border-b border-slate-800 pb-4">
        <CardTitle className="text-slate-100 flex items-center gap-2">
          <Image className="h-5 w-5 text-blue-400" /> Tile logos
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-slate-200">Show team marks on dashboard tiles</p>
            <p className="text-xs text-slate-500 mt-0.5">Two-tone logos in the bottom corners of assigned and standby cards.</p>
          </div>
          <Switch
            checked={enabled}
            disabled={saving}
            onCheckedChange={(next) => {
              setEnabled(next);
              persist(next, size);
            }}
            className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-slate-700"
          />
        </div>
        <div className={enabled ? '' : 'opacity-40 pointer-events-none'}>
          <div className="flex items-center justify-between gap-3 mb-2">
            <label htmlFor="tile-logo-size" className="text-sm text-slate-200">Size</label>
            <span className="text-xs font-mono text-slate-400">{size}%</span>
          </div>
          <input
            id="tile-logo-size"
            type="range"
            min="60"
            max="160"
            step="5"
            value={size}
            disabled={!enabled || saving}
            onChange={(e) => setSize(Number(e.target.value))}
            onMouseUp={(e) => persist(enabled, Number(e.currentTarget.value))}
            onTouchEnd={(e) => persist(enabled, Number(e.currentTarget.value))}
            onKeyUp={(e) => persist(enabled, Number(e.currentTarget.value))}
            className="w-full accent-blue-500"
          />
          <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wider text-slate-600">
            <span>Small</span>
            <span>Large</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
