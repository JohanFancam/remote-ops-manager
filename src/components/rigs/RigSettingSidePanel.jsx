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
const ISO_OPTIONS = ['Auto', '200', '400', '800', '1000', '1600', '3200', '6400'];
const CAMERAS = [
  { key: 'hd', label: 'HD Camera' },
  { key: 'wide', label: 'Wide Camera' },
  { key: 'attention', label: 'Attention Camera' },
];
const DEFAULT_CAM = { shutter: '1/400', aperture: 'F5.6', iso: 'Auto' };
const emptyForm = {
  team: '', venue_type: 'Indoor', sport: 'NBA', rig_type: 'Data', shoot_plan: '',
  remote_rigs: [],
  hd_enabled: true, hd: { ...DEFAULT_CAM },
  wide_enabled: true, wide: { ...DEFAULT_CAM },
  attention_enabled: false, attention: { ...DEFAULT_CAM },
  sound: false, notes: '',
};

function Toggle({ enabled, onChange }) {
  return (
    <button type="button" onClick={onChange}
      className={`relative inline-flex w-12 h-6 rounded-full transition-colors flex-shrink-0 ${enabled ? 'bg-blue-600' : 'bg-gray-700'}`}>
      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  );
}

function CameraEditor({ label, enabled, onToggle, cam, onChange }) {
  const set = (field, val) => onChange({ ...cam, [field]: val });
  return (
    <div className={`rounded-lg border p-3 transition-colors ${enabled ? 'border-gray-600 bg-gray-800/60' : 'border-gray-800 bg-gray-900/40'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-300">{label}</span>
        <Toggle enabled={enabled} onChange={onToggle} />
      </div>
      {enabled && (
        <div className="grid grid-cols-3 gap-2 mt-2">
          {[
            { label: 'Shutter', field: 'shutter', options: SHUTTER_OPTIONS },
            { label: 'F-Stop', field: 'aperture', options: APERTURE_OPTIONS },
            { label: 'ISO', field: 'iso', options: ISO_OPTIONS },
          ].map(f => (
            <div key={f.field}>
              <label className="text-xs text-gray-500 block mb-1">{f.label}</label>
              <select value={cam?.[f.field] || ''} onChange={e => set(f.field, e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 text-white text-sm rounded px-2 py-1.5">
                {f.options.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RigSettingSidePanel({ isOpen, rig, onSave, onDelete, onClose }) {
  const [form, setForm] = useState(emptyForm);
  const [rigInput, setRigInput] = useState('');
  const isNew = !rig;

  // Init form when rig changes
  React.useEffect(() => {
    if (rig) {
      setForm({ ...emptyForm, ...rig });
    } else {
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

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-lg bg-gray-900 border-l border-gray-800 p-0 [&_button[type='button']]:text-white overflow-y-auto">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-800">
            <h2 className="text-lg font-semibold text-white">
              {isNew ? 'New Rig Setting' : `Editing: ${rig?.team || '…'}`}
            </h2>
            <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Form */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {/* Basic fields */}
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Team Name *" value={form.team} onChange={e => setForm({ ...form, team: e.target.value })}
                className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
              <Select value={form.sport} onValueChange={v => setForm({ ...form, sport: v })}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white"><SelectValue placeholder="Sport" /></SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  {SPORTS.map(s => <SelectItem key={s} value={s} className="text-white">{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={form.venue_type} onValueChange={v => setForm({ ...form, venue_type: v })}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  <SelectItem value="Indoor" className="text-white">Indoor</SelectItem>
                  <SelectItem value="Outdoor" className="text-white">Outdoor</SelectItem>
                </SelectContent>
              </Select>
              <Select value={form.rig_type || 'Data'} onValueChange={v => setForm({ ...form, rig_type: v })}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white"><SelectValue placeholder="Rig Type" /></SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  {RIG_TYPES.map(t => <SelectItem key={t} value={t} className="text-white">{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Shoot Plan */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block uppercase tracking-wider">Shoot Plan</label>
              <textarea value={form.shoot_plan} onChange={e => setForm({ ...form, shoot_plan: e.target.value })}
                placeholder="Describe the shoot plan..." rows={3}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2 text-sm placeholder:text-gray-500 resize-none" />
            </div>

            {/* Remote Rigs */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block uppercase tracking-wider">Remote Rigs</label>
              <div className="flex gap-2 mb-2">
                <Input placeholder="e.g. RemotePC-01" value={rigInput} onChange={e => setRigInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addRig()}
                  className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
                <Button type="button" onClick={addRig} size="sm" className="bg-blue-600 hover:bg-blue-700">Add</Button>
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

            {/* Camera Settings */}
            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">Camera Settings</label>
              <div className="space-y-3">
                {CAMERAS.map(cam => (
                  <CameraEditor key={cam.key} label={cam.label}
                    enabled={form[`${cam.key}_enabled`] !== false}
                    onToggle={() => setForm({ ...form, [`${cam.key}_enabled`]: !(form[`${cam.key}_enabled`] !== false) })}
                    cam={form[cam.key] || DEFAULT_CAM}
                    onChange={val => setForm({ ...form, [cam.key]: val })} />
                ))}
              </div>

              {/* Sound toggle */}
              <div className={`mt-3 rounded-lg border p-3 flex items-center justify-between ${form.sound ? 'border-green-700 bg-green-950/20' : 'border-gray-800 bg-gray-900/40'}`}>
                <div className="flex items-center gap-2">
                  <Volume2 className={`h-4 w-4 ${form.sound ? 'text-green-400' : 'text-gray-600'}`} />
                  <span className="text-sm font-medium text-gray-300">Sound Recording</span>
                </div>
                <Toggle enabled={form.sound} onChange={() => setForm({ ...form, sound: !form.sound })} />
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="text-xs text-gray-400 mb-1 block uppercase tracking-wider">Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Any additional notes..." rows={2}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2 text-sm placeholder:text-gray-500 resize-none" />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-gray-800 flex gap-2">
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
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}