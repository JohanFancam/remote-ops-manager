import React, { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Image, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  normalizeTeamKey,
  readTileLogoSettings,
  serializeTileLogoOverrides,
  TILE_LOGO_TONE_FILTER,
} from '@/utils/teamLogos';

async function upsertSetting(appSettings, key, value, description) {
  const existing = appSettings.find((item) => item.key === key);
  if (existing) {
    await base44.entities.AppSettings.update(existing.id, { value });
  } else {
    await base44.entities.AppSettings.create({ key, value, description });
  }
}

function TonePreview({ url, label }) {
  return (
    <div className="h-12 w-12 shrink-0 rounded-md bg-slate-950 border border-slate-800 p-1">
      <img
        src={url}
        alt={label || ''}
        className="h-full w-full object-contain"
        style={{ filter: TILE_LOGO_TONE_FILTER, opacity: 0.85 }}
      />
    </div>
  );
}

export default function TileLogoSettings({ appSettings = [] }) {
  const queryClient = useQueryClient();
  const stored = readTileLogoSettings(appSettings);
  const fileRef = useRef(null);
  const [enabled, setEnabled] = useState(stored.enabled);
  const [mobileEnabled, setMobileEnabled] = useState(stored.mobileEnabled);
  const [size, setSize] = useState(stored.sizePercent);
  const [opacity, setOpacity] = useState(stored.opacityPercent);
  const [mobileSize, setMobileSize] = useState(stored.mobileSizePercent);
  const [mobileOpacity, setMobileOpacity] = useState(stored.mobileOpacityPercent);
  const [overrides, setOverrides] = useState(stored.overrides);
  const [teamName, setTeamName] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const overridesRaw = appSettings.find((item) => item.key === 'tile_logo_overrides')?.value || '';

  useEffect(() => {
    setEnabled(stored.enabled);
    setMobileEnabled(stored.mobileEnabled);
    setSize(stored.sizePercent);
    setOpacity(stored.opacityPercent);
    setMobileSize(stored.mobileSizePercent);
    setMobileOpacity(stored.mobileOpacityPercent);
  }, [stored.enabled, stored.mobileEnabled, stored.sizePercent, stored.opacityPercent, stored.mobileSizePercent, stored.mobileOpacityPercent]);

  useEffect(() => {
    setOverrides(stored.overrides);
  }, [overridesRaw]);

  const persistLook = async (next) => {
    const look = {
      enabled,
      mobileEnabled,
      size,
      opacity,
      mobileSize,
      mobileOpacity,
      ...next,
    };
    setSaving(true);
    try {
      await upsertSetting(appSettings, 'tile_logos_enabled', look.enabled ? 'true' : 'false', 'Show team marks on dashboard tiles');
      await upsertSetting(appSettings, 'tile_logos_mobile', look.mobileEnabled ? 'true' : 'false', 'Show team marks on mobile dashboard tiles');
      await upsertSetting(appSettings, 'tile_logos_size', String(look.size), 'Dashboard tile logo size percent');
      await upsertSetting(appSettings, 'tile_logos_opacity', String(look.opacity), 'Dashboard tile logo opacity percent');
      await upsertSetting(appSettings, 'tile_logos_mobile_size', String(look.mobileSize), 'Mobile dashboard tile logo size percent');
      await upsertSetting(appSettings, 'tile_logos_mobile_opacity', String(look.mobileOpacity), 'Mobile dashboard tile logo opacity percent');
      queryClient.invalidateQueries({ queryKey: ['appSettings'] });
    } finally {
      setSaving(false);
    }
  };

  const persistOverrides = async (nextOverrides) => {
    setOverrides(nextOverrides);
    await upsertSetting(
      appSettings,
      'tile_logo_overrides',
      serializeTileLogoOverrides(nextOverrides),
      'Custom home-team logos for dashboard tiles'
    );
    queryClient.invalidateQueries({ queryKey: ['appSettings'] });
  };

  const handleUpload = async (event) => {
    const file = event.target.files?.[0];
    const label = teamName.trim();
    if (event.target) event.target.value = '';
    if (!file) return;
    if (!label) {
      toast.error('Type the home team name as it appears on the shoot first');
      return;
    }
    const key = normalizeTeamKey(label);
    if (!key) {
      toast.error('That team name is not usable');
      return;
    }
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      if (!file_url) throw new Error('Upload did not return a file');
      const next = {
        ...overrides,
        [key]: { url: file_url, label },
      };
      await persistOverrides(next);
      setTeamName('');
      toast.success(`Saved a one-tone mark for ${label}`);
    } catch (err) {
      toast.error(err.message || 'Could not upload that logo');
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (key) => {
    const next = { ...overrides };
    delete next[key];
    await persistOverrides(next);
  };

  const overrideList = Object.entries(overrides);

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
            <p className="text-xs text-slate-500 mt-0.5">
              White one-tone logos stay in the bottom corners of the main tile. They do not move when rig settings expand.
            </p>
          </div>
          <Switch
            checked={enabled}
            disabled={saving}
            onCheckedChange={(next) => {
              setEnabled(next);
              persistLook({ enabled: next });
            }}
            className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-slate-700"
          />
        </div>

        <div className={enabled ? '' : 'opacity-40 pointer-events-none'}>
          <div className="flex items-center justify-between gap-3 mb-2">
            <label htmlFor="tile-logo-size" className="text-sm text-slate-200">Desktop size</label>
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
            onMouseUp={(e) => persistLook({ size: Number(e.currentTarget.value) })}
            onTouchEnd={(e) => persistLook({ size: Number(e.currentTarget.value) })}
            onKeyUp={(e) => persistLook({ size: Number(e.currentTarget.value) })}
            className="w-full accent-blue-500"
          />
          <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wider text-slate-600">
            <span>Small</span>
            <span>Large</span>
          </div>
        </div>

        <div className={enabled ? '' : 'opacity-40 pointer-events-none'}>
          <div className="flex items-center justify-between gap-3 mb-2">
            <label htmlFor="tile-logo-opacity" className="text-sm text-slate-200">Desktop opacity</label>
            <span className="text-xs font-mono text-slate-400">{opacity}%</span>
          </div>
          <input
            id="tile-logo-opacity"
            type="range"
            min="10"
            max="100"
            step="5"
            value={opacity}
            disabled={!enabled || saving}
            onChange={(e) => setOpacity(Number(e.target.value))}
            onMouseUp={(e) => persistLook({ opacity: Number(e.currentTarget.value) })}
            onTouchEnd={(e) => persistLook({ opacity: Number(e.currentTarget.value) })}
            onKeyUp={(e) => persistLook({ opacity: Number(e.currentTarget.value) })}
            className="w-full accent-blue-500"
          />
          <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wider text-slate-600">
            <span>Soft</span>
            <span>Solid</span>
          </div>
        </div>

        <div className={enabled ? 'pt-2 border-t border-slate-800 space-y-4' : 'pt-2 border-t border-slate-800 space-y-4 opacity-40 pointer-events-none'}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-slate-200">Show on mobile</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Off by default so phone tiles stay compact. Turn on to pin the same corner marks on small screens.
              </p>
            </div>
            <Switch
              checked={mobileEnabled}
              disabled={!enabled || saving}
              onCheckedChange={(next) => {
                setMobileEnabled(next);
                persistLook({ mobileEnabled: next });
              }}
              className="data-[state=checked]:bg-blue-600 data-[state=unchecked]:bg-slate-700"
            />
          </div>
          <div className={mobileEnabled ? '' : 'opacity-40 pointer-events-none'}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <label htmlFor="tile-logo-mobile-size" className="text-sm text-slate-200">Mobile size</label>
              <span className="text-xs font-mono text-slate-400">{mobileSize}%</span>
            </div>
            <input
              id="tile-logo-mobile-size"
              type="range"
              min="40"
              max="140"
              step="5"
              value={mobileSize}
              disabled={!enabled || !mobileEnabled || saving}
              onChange={(e) => setMobileSize(Number(e.target.value))}
              onMouseUp={(e) => persistLook({ mobileSize: Number(e.currentTarget.value) })}
              onTouchEnd={(e) => persistLook({ mobileSize: Number(e.currentTarget.value) })}
              onKeyUp={(e) => persistLook({ mobileSize: Number(e.currentTarget.value) })}
              className="w-full accent-blue-500"
            />
          </div>
          <div className={mobileEnabled ? '' : 'opacity-40 pointer-events-none'}>
            <div className="flex items-center justify-between gap-3 mb-2">
              <label htmlFor="tile-logo-mobile-opacity" className="text-sm text-slate-200">Mobile opacity</label>
              <span className="text-xs font-mono text-slate-400">{mobileOpacity}%</span>
            </div>
            <input
              id="tile-logo-mobile-opacity"
              type="range"
              min="10"
              max="100"
              step="5"
              value={mobileOpacity}
              disabled={!enabled || !mobileEnabled || saving}
              onChange={(e) => setMobileOpacity(Number(e.target.value))}
              onMouseUp={(e) => persistLook({ mobileOpacity: Number(e.currentTarget.value) })}
              onTouchEnd={(e) => persistLook({ mobileOpacity: Number(e.currentTarget.value) })}
              onKeyUp={(e) => persistLook({ mobileOpacity: Number(e.currentTarget.value) })}
              className="w-full accent-blue-500"
            />
          </div>
        </div>

        <div className={enabled ? 'pt-2 border-t border-slate-800' : 'pt-2 border-t border-slate-800 opacity-40 pointer-events-none'}>
          <p className="text-sm text-slate-200">Custom home-team logo</p>
          <p className="text-xs text-slate-500 mt-0.5 mb-3">
            If a team is not detected, type the home team name exactly as it appears on the shoot and upload its logo.
            It is flattened to the same white one-tone mark automatically.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Home team name, e.g. Stellenbosch"
              disabled={!enabled || uploading}
              className="bg-slate-800 border-slate-800 text-slate-100"
            />
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUpload} />
            <Button
              size="sm"
              type="button"
              disabled={!enabled || uploading}
              onClick={() => fileRef.current?.click()}
              className="bg-blue-600 hover:bg-blue-500 gap-2 shrink-0"
            >
              <Upload className="h-4 w-4" />
              {uploading ? 'Uploading…' : 'Upload logo'}
            </Button>
          </div>
          {overrideList.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {overrideList.map(([key, item]) => (
                <li key={key} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/40 px-3 py-2">
                  <TonePreview url={item.url} label={item.label} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-slate-200 truncate">{item.label}</p>
                    <p className="text-[11px] text-slate-500">Matches “{key}” on shoot titles</p>
                  </div>
                  <Button
                    size="sm"
                    type="button"
                    variant="outline"
                    onClick={() => handleRemove(key)}
                    className="border-slate-700 text-slate-300 hover:bg-slate-800 gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-600 mt-3">No custom team logos yet.</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
