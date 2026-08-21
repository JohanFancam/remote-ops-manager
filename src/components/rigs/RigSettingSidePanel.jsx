import React, { useState, useEffect } from 'react';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Volume2, Timer, Aperture, Sun, X } from 'lucide-react';

const SPORTS = ['NBA', 'NHL', 'NFL', 'Soccer', 'MLB', 'MLS', 'Rugby', 'Cricket', 'Tennis', 'Other'];
const RIG_TYPES = ['Data', 'Fancam', 'Data/Fancam'];
const SHUTTER_OPTIONS = ['1/100', '1/125', '1/160', '1/200', '1/250', '1/320', '1/400'];
const APERTURE_OPTIONS = ['F5.6', 'F6.3', 'F7.1', 'F8', 'F9', 'F10', 'F11'];
const ISO_OPTIONS = ['Auto', '200', '400', '800', '1000', '1600', '3200', '5000', '6400'];

const DEFAULT_DATA_HD = { shutter: '1/400', aperture: 'F5.6', iso: 'Auto' };
const DEFAULT_DATA_WIDE = { shutter: '1/400', aperture: 'F5.6', iso: 'Auto' };
const DEFAULT_FANCAM_DAY_HD = { shutter: '1/400', aperture: 'F5.6', iso: '400' };
const DEFAULT_FANCAM_DAY_WIDE = { shutter: '1/400', aperture: 'F5.6', iso: '400' };
const DEFAULT_FANCAM_NIGHT_HD = { shutter: '1/400', aperture: 'F5.6', iso: '5000' };
const DEFAULT_FANCAM_NIGHT_WIDE = { shutter: '1/400', aperture: 'F5.6', iso: '3200' };
const DEFAULT_ATTENTION_HD = { shutter: '1/100', aperture: 'F11', iso: 'Auto' };

// Arena defaults — standard 1/200 | F5.6 | 3200 ISO for all cameras
const ARENA_HD = { shutter: '1/200', aperture: 'F5.6', iso: '3200' };
const ARENA_WIDE = { shutter: '1/200', aperture: 'F5.6', iso: '3200' };

const emptyForm = {
  team: '', venue_type: 'Indoor', sport: 'NBA', rig_type: 'Data', shoot_plan: '',
  remote_rigs: [],
  data_enabled: true, data_hd: { ...DEFAULT_DATA_HD }, data_wide_enabled: true, data_wide: { ...DEFAULT_DATA_WIDE },
  fancam_day_enabled: false, fancam_day_hd: { ...DEFAULT_FANCAM_DAY_HD }, fancam_day_wide_enabled: true, fancam_day_wide: { ...DEFAULT_FANCAM_DAY_WIDE },
  fancam_night_enabled: false, fancam_night_hd: { ...DEFAULT_FANCAM_NIGHT_HD }, fancam_night_wide_enabled: true, fancam_night_wide: { ...DEFAULT_FANCAM_NIGHT_WIDE },
  attention_enabled: false, attention_hd: { ...DEFAULT_ATTENTION_HD },
  sound_enabled: false, notes: '',
};

function Toggle({ enabled, onChange, readOnly }) {
  return (
    <button type="button" onClick={onChange} disabled={readOnly}
      className={`relative inline-flex w-12 h-6 rounded-full transition-colors flex-shrink-0 ${enabled ? 'bg-teal-600' : 'bg-zinc-700'} ${readOnly ? 'cursor-default opacity-60' : ''}`}>
      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-zinc-900 shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  );
}

function CamSelect({ cam, onChange, readOnly, freeTextFields = [] }) {
  const set = (field, val) => onChange({ ...cam, [field]: val });
  const fields = [
    { label: 'Shutter', field: 'shutter', options: SHUTTER_OPTIONS },
    { label: 'F-Stop', field: 'aperture', options: APERTURE_OPTIONS },
    { label: 'ISO', field: 'iso', options: ISO_OPTIONS },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {fields.map(f => (
        <div key={f.field}>
          <label className="text-xs text-zinc-500 block mb-1">{f.label}</label>
          {freeTextFields.includes(f.field) ? (
            <input type="text" value={cam?.[f.field] || ''} onChange={e => set(f.field, e.target.value)} disabled={readOnly}
              className="w-full bg-zinc-700 border border-zinc-700 text-zinc-100 text-sm rounded px-2 py-1.5 disabled:opacity-60 placeholder:text-zinc-500"
              placeholder={f.options[0]} />
          ) : (
            <select value={cam?.[f.field] || ''} onChange={e => set(f.field, e.target.value)} disabled={readOnly}
              className="w-full bg-zinc-700 border border-zinc-700 text-zinc-100 text-sm rounded px-2 py-1.5 disabled:opacity-60">
              {f.options.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          )}
        </div>
      ))}
    </div>
  );
}

function CameraSection({ title, note, enabled, onToggle, camKeyHd, camKeyWide, camHd, camWide, wideEnabled, onWideToggle, onCamChange, readOnly, freeTextFields }) {
  return (
    <div className={`rounded-lg border p-4 transition-colors ${enabled ? 'border-zinc-700 bg-zinc-800/60' : 'border-zinc-800 bg-zinc-900/40'}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-sm font-semibold text-zinc-100">{title}</span>
          {note && <p className="text-[10px] text-zinc-500 mt-0.5">{note}</p>}
        </div>
        <Toggle enabled={enabled} onChange={onToggle} readOnly={readOnly} />
      </div>
      {enabled && (
        <div className="space-y-3 mt-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-400 font-medium">HD Camera</span>
            </div>
            <CamSelect cam={camHd} onChange={val => onCamChange(camKeyHd, val)} readOnly={readOnly} freeTextFields={freeTextFields} />
          </div>
          {camKeyWide && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-zinc-400 font-medium">Wide Camera</span>
                {onWideToggle && <Toggle enabled={wideEnabled} onChange={onWideToggle} readOnly={readOnly} />}
              </div>
              {wideEnabled !== false && (
                <CamSelect cam={camWide} onChange={val => onCamChange(camKeyWide, val)} readOnly={readOnly} freeTextFields={freeTextFields} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RigSettingSidePanel({ isOpen, rig, onSave, onDelete, onClose, readOnly = false }) {
  const [form, setForm] = useState(emptyForm);
  const [rigInput, setRigInput] = useState('');
  const isNew = !rig;

  React.useEffect(() => {
    if (rig && isOpen) {
      setForm(prev => {
        const merged = { ...emptyForm };
        // Copy all known keys from rig, with defaults for missing ones
        for (const key of Object.keys(emptyForm)) {
          if (key in rig && rig[key] !== undefined && rig[key] !== null) {
            merged[key] = rig[key];
          }
        }
        return merged;
      });
    } else if (isOpen) {
      setForm(emptyForm);
    }
  }, [rig, isOpen]);

  const handleSave = () => {
    if (!form.team) return;
    onSave(form);
    setForm(emptyForm);
    onClose();
  };

  const addRig = () => {
    if (!rigInput.trim()) return;
    setForm({ ...form, remote_rigs: [...(form.remote_rigs || []), rigInput.trim()] });
    setRigInput('');
  };
  const removeRig = (i) => setForm({ ...form, remote_rigs: form.remote_rigs.filter((_, idx) => idx !== i) });

  const updateCam = (key, val) => setForm({ ...form, [key]: val });

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg bg-zinc-900 border-l border-zinc-800 p-0 [&_button[type='button']]:text-zinc-400 overflow-y-auto">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-100">
              {readOnly ? `Viewing: ${rig?.team || '…'}` : isNew ? 'New Rig Setting' : `Editing: ${rig?.team || '…'}`}
            </h2>
          </div>

          {/* Form */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Basic fields */}
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Team Name *" value={form.team} onChange={e => setForm({ ...form, team: e.target.value })} disabled={readOnly}
                className="bg-zinc-800 border-zinc-800 text-zinc-100 placeholder:text-zinc-500 disabled:opacity-60" />
              <Select value={form.sport} onValueChange={v => setForm({ ...form, sport: v })} disabled={readOnly}>
                <SelectTrigger className="bg-zinc-800 border-zinc-800 text-zinc-100 disabled:opacity-60"><SelectValue placeholder="Sport" /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  {SPORTS.map(s => <SelectItem key={s} value={s} className="text-zinc-100">{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={form.venue_type} onValueChange={v => {
                  if (v === 'Arena') {
                    setForm({ ...form, venue_type: v,
                      data_hd: { ...ARENA_HD }, data_wide: { ...ARENA_WIDE },
                      data_enabled: true, data_wide_enabled: true,
                      fancam_day_enabled: true,
                      fancam_day_hd: { ...ARENA_HD }, fancam_day_wide: { ...ARENA_WIDE },
                      fancam_day_wide_enabled: true,
                      fancam_night_enabled: false, fancam_night_wide_enabled: true,
                    });
                  } else {
                    setForm({ ...form, venue_type: v });
                  }
                }} disabled={readOnly}>
                <SelectTrigger className="bg-zinc-800 border-zinc-800 text-zinc-100 disabled:opacity-60"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  <SelectItem value="Indoor" className="text-zinc-100">Indoor</SelectItem>
                  <SelectItem value="Outdoor" className="text-zinc-100">Outdoor</SelectItem>
                  <SelectItem value="Arena" className="text-zinc-100">Arena</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.rig_type || 'Data'} onValueChange={v => setForm({ ...form, rig_type: v })} disabled={readOnly}>
                <SelectTrigger className="bg-zinc-800 border-zinc-800 text-zinc-100 disabled:opacity-60"><SelectValue placeholder="Rig Type" /></SelectTrigger>
                <SelectContent className="bg-zinc-900 border-zinc-800">
                  {RIG_TYPES.map(t => <SelectItem key={t} value={t} className="text-zinc-100">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Shoot Plan */}
            <div>
              <label className="text-xs text-zinc-400 mb-1 block uppercase tracking-wider">Shoot Plan</label>
              <textarea value={form.shoot_plan} onChange={e => setForm({ ...form, shoot_plan: e.target.value })} disabled={readOnly}
                placeholder="Describe the shoot plan..." rows={3}
                className="w-full bg-zinc-800 border border-zinc-800 text-zinc-100 rounded-md px-3 py-2 text-sm placeholder:text-zinc-500 resize-none disabled:opacity-60" />
            </div>

            {/* Remote Rigs */}
            <div>
              <label className="text-xs text-zinc-400 mb-1 block uppercase tracking-wider">Remote Rigs</label>
              <div className="flex gap-2 mb-2">
                {!readOnly && (
                  <>
                    <Input placeholder="e.g. RemotePC-01" value={rigInput} onChange={e => setRigInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addRig()}
                      className="bg-zinc-800 border-zinc-800 text-zinc-100 placeholder:text-zinc-500" />
                    <Button type="button" onClick={addRig} size="sm" className="bg-teal-600 hover:bg-teal-500">Add</Button>
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {form.remote_rigs?.map((r, i) => (
                  <span key={i} className="flex items-center gap-1 bg-teal-950/40 text-teal-400 border border-teal-800 text-sm px-2 py-1 rounded-full">
                    {r}
                    <button type="button" onClick={() => removeRig(i)} className="hover:text-red-400 ml-1"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            </div>

            {/* Camera Settings — 5 Sections */}
            <div>
              <label className="text-xs text-zinc-400 uppercase tracking-wider mb-3 block">Camera Settings</label>
              <div className="space-y-3">
                {/* 1. Data Settings */}
                <CameraSection
                  title="Data Settings"
                  note="Standard: HD 1/400 | F5.6 | AUTO ISO   ·   Wide 1/400 | F5.6 | AUTO ISO"
                  enabled={form.data_enabled}
                  onToggle={() => setForm({ ...form, data_enabled: !form.data_enabled })}
                  camKeyHd="data_hd" camKeyWide="data_wide"
                  camHd={form.data_hd || DEFAULT_DATA_HD}
                  camWide={form.data_wide || DEFAULT_DATA_WIDE}
                  wideEnabled={form.data_wide_enabled !== false}
                  onWideToggle={() => setForm({ ...form, data_wide_enabled: !form.data_wide_enabled })}
                  onCamChange={updateCam}
                  readOnly={readOnly}
                />

                {/* 2. Fancam Day Settings */}
                <CameraSection
                  title="Fancam Day Settings"
                  note="Standard: HD 1/400 | F5.6–F11 | 400–1000 ISO   ·   Wide 1/400 | F5.6–F11 | 400–1000 ISO"
                  enabled={form.fancam_day_enabled}
                  onToggle={() => setForm({ ...form, fancam_day_enabled: !form.fancam_day_enabled })}
                  camKeyHd="fancam_day_hd" camKeyWide="fancam_day_wide"
                  camHd={form.fancam_day_hd || DEFAULT_FANCAM_DAY_HD}
                  camWide={form.fancam_day_wide || DEFAULT_FANCAM_DAY_WIDE}
                  wideEnabled={form.fancam_day_wide_enabled !== false}
                  onWideToggle={() => setForm({ ...form, fancam_day_wide_enabled: !form.fancam_day_wide_enabled })}
                  onCamChange={updateCam}
                  readOnly={readOnly}
                  freeTextFields={['aperture', 'iso']}
                />

                {/* 3. Fancam Night Settings */}
                <CameraSection
                  title="Fancam Night Settings"
                  note="Standard: HD 1/400 | F5.6 | 5000 ISO   ·   Wide 1/400 | F5.6 | 3200 ISO"
                  enabled={form.fancam_night_enabled}
                  onToggle={() => setForm({ ...form, fancam_night_enabled: !form.fancam_night_enabled })}
                  camKeyHd="fancam_night_hd" camKeyWide="fancam_night_wide"
                  camHd={form.fancam_night_hd || DEFAULT_FANCAM_NIGHT_HD}
                  camWide={form.fancam_night_wide || DEFAULT_FANCAM_NIGHT_WIDE}
                  wideEnabled={form.fancam_night_wide_enabled !== false}
                  onWideToggle={() => setForm({ ...form, fancam_night_wide_enabled: !form.fancam_night_wide_enabled })}
                  onCamChange={updateCam}
                  readOnly={readOnly}
                />

                {/* 4. Attention Camera */}
                <CameraSection
                  title="Attention Camera"
                  note="Standard: HD 1/100 | F11 | AUTO ISO"
                  enabled={form.attention_enabled}
                  onToggle={() => setForm({ ...form, attention_enabled: !form.attention_enabled })}
                  camKeyHd="attention_hd" camKeyWide={null}
                  camHd={form.attention_hd || DEFAULT_ATTENTION_HD}
                  camWide={null}
                  onCamChange={updateCam}
                  readOnly={readOnly}
                />

                {/* 5. Sound Recording */}
                <div className={`rounded-lg border p-3 flex items-center justify-between transition-colors ${form.sound_enabled ? 'border-green-700 bg-emerald-950/40' : 'border-zinc-800 bg-zinc-900/40'}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <Volume2 className={`h-4 w-4 ${form.sound_enabled ? 'text-emerald-400' : 'text-gray-600'}`} />
                      <span className="text-sm font-semibold text-zinc-100">Sound Recording</span>
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-0.5 ml-6">Sound enabled for this rig</p>
                  </div>
                  <Toggle enabled={form.sound_enabled} onChange={() => setForm({ ...form, sound_enabled: !form.sound_enabled })} readOnly={readOnly} />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs text-zinc-400 mb-1 block uppercase tracking-wider">Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} disabled={readOnly}
                placeholder="Any additional notes..." rows={2}
                className="w-full bg-zinc-800 border border-zinc-800 text-zinc-100 rounded-md px-3 py-2 text-sm placeholder:text-zinc-500 resize-none disabled:opacity-60" />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-zinc-800 flex gap-2">
            {readOnly ? (
              <Button variant="outline" onClick={onClose} className="border-zinc-800 text-zinc-400 hover:bg-zinc-800 flex-1">
                Close
              </Button>
            ) : (
              <>
                <Button onClick={handleSave} className="bg-teal-600 hover:bg-teal-500 flex-1">
                  {isNew ? 'Create Rig Setting' : 'Save Changes'}
                </Button>
                {!isNew && (
                  <Button onClick={() => { onDelete(rig.id); onClose(); }} variant="outline" className="border-red-700/60 text-red-400 hover:bg-red-950/30">
                    Delete
                  </Button>
                )}
                <Button variant="outline" onClick={onClose} className="border-zinc-800 text-zinc-400 hover:bg-zinc-800">
                  Cancel
                </Button>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}