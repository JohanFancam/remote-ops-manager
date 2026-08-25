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

const DEFAULT_OFFSETS = { setup_offset: -150, pre_shoot_offset: -120, attention_offset: -30, sound_offset: -30 };

const emptyForm = {
  team: '', venue_type: 'Indoor', sport: 'NBA', rig_type: 'Data', shoot_plan: '',
  remote_rigs: [],
  ...DEFAULT_OFFSETS,
  data_enabled: true, data_hd: { ...DEFAULT_DATA_HD }, data_wide_enabled: true, data_wide: { ...DEFAULT_DATA_WIDE },
  fancam_day_enabled: false, fancam_day_hd: { ...DEFAULT_FANCAM_DAY_HD }, fancam_day_wide_enabled: true, fancam_day_wide: { ...DEFAULT_FANCAM_DAY_WIDE },
  fancam_night_enabled: false, fancam_night_hd: { ...DEFAULT_FANCAM_NIGHT_HD }, fancam_night_wide_enabled: true, fancam_night_wide: { ...DEFAULT_FANCAM_NIGHT_WIDE },
  attention_enabled: false, attention_hd: { ...DEFAULT_ATTENTION_HD },
  sound_enabled: false, notes: '',
};

function Toggle({ enabled, onChange, readOnly }) {
  return (
    <button type="button" onClick={onChange} disabled={readOnly}
      className={`relative inline-flex w-12 h-6 rounded-full transition-colors flex-shrink-0 ${enabled ? 'bg-blue-600' : 'bg-gray-700'} ${readOnly ? 'cursor-default opacity-60' : ''}`}>
      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0'}`} />
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
          <label className="text-xs text-gray-500 block mb-1">{f.label}</label>
          {freeTextFields.includes(f.field) ? (
            <input type="text" value={cam?.[f.field] || ''} onChange={e => set(f.field, e.target.value)} disabled={readOnly}
              className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded px-2 py-1.5 disabled:opacity-60 placeholder:text-gray-500"
              placeholder={f.options[0]} />
          ) : (
            <select value={cam?.[f.field] || ''} onChange={e => set(f.field, e.target.value)} disabled={readOnly}
              className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded px-2 py-1.5 disabled:opacity-60">
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
    <div className={`rounded-lg border p-4 transition-colors ${enabled ? 'border-gray-600 bg-gray-800/60' : 'border-gray-800 bg-gray-900/40'}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <span className="text-sm font-semibold text-white">{title}</span>
          {note && <p className="text-[10px] text-gray-500 mt-0.5">{note}</p>}
        </div>
        <Toggle enabled={enabled} onChange={onToggle} readOnly={readOnly} />
      </div>
      {enabled && (
        <div className="space-y-3 mt-3">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-400 font-medium">HD Camera</span>
            </div>
            <CamSelect cam={camHd} onChange={val => onCamChange(camKeyHd, val)} readOnly={readOnly} freeTextFields={freeTextFields} />
          </div>
          {camKeyWide && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 font-medium">Wide Camera</span>
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
      <SheetContent side="right" className="w-full sm:max-w-lg bg-gray-900 border-l border-gray-800 p-0 [&_button[type='button']]:text-white overflow-y-auto">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-white">
              {readOnly ? `Viewing: ${rig?.team || '…'}` : isNew ? 'New Rig Setting' : `Editing: ${rig?.team || '…'}`}
            </h2>
          </div>

          {/* Form */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Basic fields */}
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Team Name *" value={form.team} onChange={e => setForm({ ...form, team: e.target.value })} disabled={readOnly}
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 disabled:opacity-60" />
              <Select value={form.sport} onValueChange={v => setForm({ ...form, sport: v })} disabled={readOnly}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white disabled:opacity-60"><SelectValue placeholder="Sport" /></SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  {SPORTS.map(s => <SelectItem key={s} value={s} className="text-white">{s}</SelectItem>)}
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
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white disabled:opacity-60"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  <SelectItem value="Indoor" className="text-white">Indoor</SelectItem>
                  <SelectItem value="Outdoor" className="text-white">Outdoor</SelectItem>
                  <SelectItem value="Arena" className="text-white">Arena</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.rig_type || 'Data'} onValueChange={v => setForm({ ...form, rig_type: v })} disabled={readOnly}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white disabled:opacity-60"><SelectValue placeholder="Rig Type" /></SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  {RIG_TYPES.map(t => <SelectItem key={t} value={t} className="text-white">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Shoot Plan */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block uppercase tracking-wider">Shoot Plan</label>
              <textarea value={form.shoot_plan} onChange={e => setForm({ ...form, shoot_plan: e.target.value })} disabled={readOnly}
                placeholder="Describe the shoot plan..." rows={3}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2 text-sm placeholder:text-gray-500 resize-none disabled:opacity-60" />
            </div>

            {/* Remote Rigs */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block uppercase tracking-wider">Remote Rigs</label>
              <div className="flex gap-2 mb-2">
                {!readOnly && (
                  <>
                    <Input placeholder="e.g. RemotePC-01" value={rigInput} onChange={e => setRigInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addRig()}
                      className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
                    <Button type="button" onClick={addRig} size="sm" className="bg-blue-600 hover:bg-blue-700">Add</Button>
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {form.remote_rigs?.map((r, i) => (
                  <span key={i} className="flex items-center gap-1 bg-blue-900/40 text-blue-300 border border-blue-700/40 text-sm px-2 py-1 rounded-full">
                    {r}
                    <button type="button" onClick={() => removeRig(i)} className="hover:text-red-400 ml-1"><X className="h-3 w-3" /></button>
                  </span>
                ))}
              </div>
            </div>

            {/* Schedule Offsets */}
            <div className="bg-gray-800/60 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-3">
                <Timer className="h-4 w-4 text-blue-400" />
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">Schedule Offsets (minutes before game time)</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { key: 'setup_offset', label: 'Setup' },
                  { key: 'pre_shoot_offset', label: 'Pre-Shoot' },
                  { key: 'attention_offset', label: 'Attention' },
                  { key: 'sound_offset', label: 'Sound' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="text-xs text-gray-500 block mb-1">{label}</label>
                    <Input
                      type="number"
                      value={form[key] ?? DEFAULT_OFFSETS[key]}
                      onChange={e => setForm({ ...form, [key]: Number(e.target.value) })}
                      disabled={readOnly}
                      className="bg-gray-700 border-gray-600 text-white h-8 text-sm disabled:opacity-60"
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Camera Settings — 5 Sections */}
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-3 block">Camera Settings</label>
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
                <div className={`rounded-lg border p-3 flex items-center justify-between transition-colors ${form.sound_enabled ? 'border-green-700 bg-green-950/20' : 'border-gray-800 bg-gray-900/40'}`}>
                  <div>
                    <div className="flex items-center gap-2">
                      <Volume2 className={`h-4 w-4 ${form.sound_enabled ? 'text-green-400' : 'text-gray-600'}`} />
                      <span className="text-sm font-semibold text-white">Sound Recording</span>
                    </div>
                    <p className="text-[10px] text-gray-500 mt-0.5 ml-6">Sound enabled for this rig</p>
                  </div>
                  <Toggle enabled={form.sound_enabled} onChange={() => setForm({ ...form, sound_enabled: !form.sound_enabled })} readOnly={readOnly} />
                </div>
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block uppercase tracking-wider">Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} disabled={readOnly}
                placeholder="Any additional notes..." rows={2}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2 text-sm placeholder:text-gray-500 resize-none disabled:opacity-60" />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-gray-800 flex gap-2">
            {readOnly ? (
              <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300 hover:bg-gray-800 flex-1">
                Close
              </Button>
            ) : (
              <>
                <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 flex-1">
                  {isNew ? 'Create Rig Setting' : 'Save Changes'}
                </Button>
                {!isNew && (
                  <Button onClick={() => { onDelete(rig.id); onClose(); }} variant="outline" className="border-red-700/60 text-red-300 hover:bg-red-950/30">
                    Delete
                  </Button>
                )}
                <Button variant="outline" onClick={onClose} className="border-gray-700 text-gray-300 hover:bg-gray-800">
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