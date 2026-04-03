import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, ChevronDown, ChevronUp, X, Sun, Moon, Building2, Database } from 'lucide-react';

const SPORTS = ['NBA', 'NHL', 'NFL', 'Soccer', 'MLB', 'MLS', 'Rugby', 'Cricket', 'Tennis', 'Other'];
const RIG_TYPES = ['Data', 'Fancam', 'Data/Fancam'];

// Canon 5DS based options
const SHUTTER_OPTIONS = ['1/100', '1/125', '1/160', '1/200', '1/250', '1/320', '1/400', '1/500', '1/640', '1/800'];
const APERTURE_OPTIONS = ['F5.6', 'F6.3', 'F7.1', 'F8', 'F9', 'F10', 'F11'];
const ISO_OPTIONS = ['100', '200', '400', '800', '1000', '1600', '3200', '6400', '12800'];

const CONDITION_SECTIONS = [
  { key: 'day', label: 'Day Settings', Icon: Sun, color: 'text-yellow-400', border: 'border-yellow-700', bg: 'bg-yellow-950/20', rangeable: true },
  { key: 'night', label: 'Night Settings', Icon: Moon, color: 'text-blue-400', border: 'border-blue-700', bg: 'bg-blue-950/20', rangeable: false },
  { key: 'arena', label: 'Arena Settings', Icon: Building2, color: 'text-purple-400', border: 'border-purple-700', bg: 'bg-purple-950/20', rangeable: false },
  { key: 'data', label: 'Data Settings', Icon: Database, color: 'text-green-400', border: 'border-green-700', bg: 'bg-green-950/20', rangeable: false },
];

const CAMERAS = [
  { key: 'hd', label: 'HD Camera' },
  { key: 'wide', label: 'Wide Camera' },
  { key: 'attention', label: 'Attention Camera' },
];

// Toggle switch component
function Toggle({ enabled, onChange, color = 'bg-blue-600' }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`relative inline-flex w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none flex-shrink-0 ${enabled ? color : 'bg-gray-700'}`}
    >
      <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${enabled ? 'translate-x-6' : 'translate-x-0'}`} />
    </button>
  );
}

// Single camera setting (for night/arena — fixed values)
function CameraFixed({ label, enabled, onToggle, form, setForm, prefix, condKey }) {
  const fKey = `${condKey}_${prefix}`;
  const cam = form[fKey] || { shutter: '1/250', aperture: 'F8', iso: '800' };
  const set = (field, val) => setForm({ ...form, [fKey]: { ...cam, [field]: val } });
  return (
    <div className={`rounded-lg border p-3 transition-colors ${enabled ? 'border-gray-600 bg-gray-800/60' : 'border-gray-800 bg-gray-900/40'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-300">{label}</span>
        <Toggle enabled={enabled} onChange={onToggle} color="bg-blue-600" />
      </div>
      {enabled && (
        <div className="grid grid-cols-3 gap-2 mt-2">
          {[
            { label: 'Shutter', field: 'shutter', options: SHUTTER_OPTIONS },
            { label: 'Aperture', field: 'aperture', options: APERTURE_OPTIONS },
            { label: 'ISO', field: 'iso', options: ISO_OPTIONS },
          ].map(f => (
            <div key={f.field}>
              <label className="text-xs text-gray-500 block mb-1">{f.label}</label>
              <select value={cam[f.field] || ''} onChange={e => set(f.field, e.target.value)}
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

// Range camera setting (for day — min/max values)
function CameraRange({ label, enabled, onToggle, form, setForm, prefix, condKey }) {
  const fKey = `${condKey}_${prefix}`;
  const cam = form[fKey] || { shutter_min: '1/100', shutter_max: '1/400', aperture_min: 'F5.6', aperture_max: 'F10', iso_min: '200', iso_max: '1000' };
  const set = (field, val) => setForm({ ...form, [fKey]: { ...cam, [field]: val } });
  return (
    <div className={`rounded-lg border p-3 transition-colors ${enabled ? 'border-gray-600 bg-gray-800/60' : 'border-gray-800 bg-gray-900/40'}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-300">{label}</span>
        <Toggle enabled={enabled} onChange={onToggle} color="bg-blue-600" />
      </div>
      {enabled && (
        <div className="space-y-2 mt-2">
          {[
            { label: 'Shutter Speed', minField: 'shutter_min', maxField: 'shutter_max', options: SHUTTER_OPTIONS },
            { label: 'Aperture', minField: 'aperture_min', maxField: 'aperture_max', options: APERTURE_OPTIONS },
            { label: 'ISO', minField: 'iso_min', maxField: 'iso_max', options: ISO_OPTIONS },
          ].map(f => (
            <div key={f.label}>
              <label className="text-xs text-gray-500 block mb-1">{f.label} range</label>
              <div className="flex items-center gap-2">
                <select value={cam[f.minField] || ''} onChange={e => set(f.minField, e.target.value)}
                  className="flex-1 bg-gray-700 border border-gray-600 text-white text-sm rounded px-2 py-1.5">
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
                <span className="text-gray-500 text-xs">–</span>
                <select value={cam[f.maxField] || ''} onChange={e => set(f.maxField, e.target.value)}
                  className="flex-1 bg-gray-700 border border-gray-600 text-white text-sm rounded px-2 py-1.5">
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const emptyForm = {
  team: '', venue_type: 'Indoor', sport: 'NBA', rig_type: 'Data', shoot_plan: '',
  remote_rigs: [],
  sound: false,
  // Day (range)
  day_enabled: true,
  day_hd: { shutter_min: '1/100', shutter_max: '1/400', aperture_min: 'F5.6', aperture_max: 'F10', iso_min: '200', iso_max: '1000' },
  day_wide: { shutter_min: '1/100', shutter_max: '1/400', aperture_min: 'F5.6', aperture_max: 'F10', iso_min: '200', iso_max: '1000' },
  day_attention: { shutter_min: '1/100', shutter_max: '1/400', aperture_min: 'F5.6', aperture_max: 'F10', iso_min: '200', iso_max: '1000' },
  day_hd_enabled: true, day_wide_enabled: true, day_attention_enabled: false,
  // Night (fixed)
  night_enabled: true,
  night_hd: { shutter: '1/250', aperture: 'F8', iso: '3200' },
  night_wide: { shutter: '1/250', aperture: 'F8', iso: '3200' },
  night_attention: { shutter: '1/250', aperture: 'F8', iso: '3200' },
  night_hd_enabled: true, night_wide_enabled: true, night_attention_enabled: false,
  // Arena (fixed)
  arena_enabled: false,
  arena_hd: { shutter: '1/250', aperture: 'F8', iso: '1600' },
  arena_wide: { shutter: '1/250', aperture: 'F8', iso: '1600' },
  arena_attention: { shutter: '1/250', aperture: 'F8', iso: '1600' },
  arena_hd_enabled: true, arena_wide_enabled: true, arena_attention_enabled: false,
  // Data (fixed)
  data_enabled: false,
  data_hd: { shutter: '1/250', aperture: 'F8', iso: '800' },
  data_wide: { shutter: '1/250', aperture: 'F8', iso: '800' },
  data_attention: { shutter: '1/250', aperture: 'F8', iso: '800' },
  data_hd_enabled: true, data_wide_enabled: true, data_attention_enabled: false,
  notes: '',
};

function CamDisplay({ label, enabled, cam, isRange }) {
  if (!enabled) return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded bg-gray-800/30">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs text-gray-700">OFF</span>
    </div>
  );
  return (
    <div className="flex flex-wrap items-start justify-between py-1.5 px-2 rounded bg-blue-950/20 gap-1">
      <span className="text-xs text-gray-300 font-medium">{label}</span>
      {cam && (
        <div className="flex gap-2 text-xs text-gray-400 flex-wrap">
          {isRange ? (
            <>
              <span>⏱ {cam.shutter_min}–{cam.shutter_max}</span>
              <span>🔲 {cam.aperture_min}–{cam.aperture_max}</span>
              <span>💡 {cam.iso_min}–{cam.iso_max}</span>
            </>
          ) : (
            <>
              <span>⏱ {cam.shutter}</span>
              <span>🔲 {cam.aperture}</span>
              <span>💡 {cam.iso}</span>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function Rigs() {
  const { isAdmin } = useApp();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [rigInput, setRigInput] = useState('');
  const [activeCondTab, setActiveCondTab] = useState('day');

  const { data: rigSettings = [] } = useQuery({
    queryKey: ['rigSettings'],
    queryFn: () => base44.entities.RigSetting.list(),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['rigSettings'] });

  const handleSave = async () => {
    if (!form.team) return;
    if (editingId) {
      await base44.entities.RigSetting.update(editingId, form);
    } else {
      await base44.entities.RigSetting.create(form);
    }
    setForm(emptyForm);
    setEditingId(null);
    setIsAdding(false);
    refresh();
  };

  const handleDelete = async (id) => {
    await base44.entities.RigSetting.delete(id);
    refresh();
  };

  const startEdit = (rig) => {
    setEditingId(rig.id);
    setForm({ ...emptyForm, ...rig });
    setIsAdding(true);
    setExpandedId(null);
  };

  const addRig = () => {
    if (!rigInput.trim()) return;
    setForm({ ...form, remote_rigs: [...(form.remote_rigs || []), rigInput.trim()] });
    setRigInput('');
  };

  const removeRig = (i) => {
    setForm({ ...form, remote_rigs: form.remote_rigs.filter((_, idx) => idx !== i) });
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Rig Settings</h1>
            <p className="text-gray-400 text-sm mt-1">Team-based camera and rig configurations (Canon 5DS)</p>
          </div>
          {isAdmin && !isAdding && (
            <Button onClick={() => { setIsAdding(true); setEditingId(null); setForm(emptyForm); }} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" /> New Rig Setting
            </Button>
          )}
        </div>

        {/* Form */}
        {isAdmin && isAdding && (
          <Card className="bg-gray-900 border-blue-700 mb-8">
            <CardHeader className="border-b border-gray-800 py-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-white text-base">{editingId ? 'Edit Rig Setting' : 'New Rig Setting'}</CardTitle>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-white" onClick={() => { setIsAdding(false); setEditingId(null); setForm(emptyForm); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-5 space-y-5">
              {/* Basic info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Input placeholder="Team Name *" value={form.team} onChange={e => setForm({ ...form, team: e.target.value })} className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
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

              {/* Shoot plan */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Shoot Plan</label>
                <textarea value={form.shoot_plan} onChange={e => setForm({ ...form, shoot_plan: e.target.value })}
                  placeholder="Describe the shoot plan..." rows={3}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2 text-sm placeholder:text-gray-500 resize-none" />
              </div>

              {/* Remote Rigs */}
              <div>
                <label className="text-xs text-gray-400 mb-2 block">Remote Rigs (Google Remote Names)</label>
                <div className="flex gap-2 mb-2">
                  <Input placeholder="e.g. RemotePC-01" value={rigInput} onChange={e => setRigInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addRig()}
                    className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500" />
                  <Button type="button" onClick={addRig} size="sm" className="bg-blue-600 hover:bg-blue-700">Add</Button>
                </div>
                {form.remote_rigs?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {form.remote_rigs.map((r, i) => (
                      <span key={i} className="flex items-center gap-1 bg-blue-900/40 text-blue-300 border border-blue-700/40 text-sm px-2 py-1 rounded-full">
                        {r}
                        <button type="button" onClick={() => removeRig(i)} className="hover:text-red-400 ml-1"><X className="h-3 w-3" /></button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Condition tabs */}
              <div>
                <label className="text-xs text-gray-400 uppercase tracking-wider mb-3 block">Camera Settings</label>
                <div className="flex gap-1 mb-4 bg-gray-800 rounded-lg p-1 w-fit">
                  {CONDITION_SECTIONS.map(cond => (
                    <button key={cond.key}
                      onClick={() => setActiveCondTab(cond.key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeCondTab === cond.key ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}>
                      <cond.Icon className={`h-3.5 w-3.5 ${activeCondTab === cond.key ? cond.color : ''}`} />
                      {cond.label.split(' ')[0]}
                    </button>
                  ))}
                </div>

                {CONDITION_SECTIONS.map(cond => activeCondTab === cond.key && (
                  <div key={cond.key} className={`rounded-xl border ${cond.border} p-4 space-y-3`}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <cond.Icon className={`h-4 w-4 ${cond.color}`} />
                        <span className="text-sm font-semibold text-white">{cond.label}</span>
                        {cond.rangeable && <span className="text-xs text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full">Range guide</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">{form[`${cond.key}_enabled`] !== false ? 'Active' : 'Inactive'}</span>
                        <Toggle
                          enabled={form[`${cond.key}_enabled`] !== false}
                          onChange={() => setForm({ ...form, [`${cond.key}_enabled`]: !(form[`${cond.key}_enabled`] !== false) })}
                          color={cond.key === 'day' ? 'bg-yellow-600' : cond.key === 'night' ? 'bg-blue-600' : cond.key === 'arena' ? 'bg-purple-600' : 'bg-green-600'}
                        />
                      </div>
                    </div>
                    {form[`${cond.key}_enabled`] !== false && CAMERAS.map(cam => {
                      const enabledKey = `${cond.key}_${cam.key}_enabled`;
                      const enabled = form[enabledKey] !== false;
                      const toggle = () => setForm({ ...form, [enabledKey]: !enabled });
                      return cond.rangeable
                        ? <CameraRange key={cam.key} label={cam.label} enabled={enabled} onToggle={toggle} form={form} setForm={setForm} prefix={cam.key} condKey={cond.key} />
                        : <CameraFixed key={cam.key} label={cam.label} enabled={enabled} onToggle={toggle} form={form} setForm={setForm} prefix={cam.key} condKey={cond.key} />;
                    })}
                    {form[`${cond.key}_enabled`] !== false && (
                      <div className={`rounded-lg border p-3 ${form.sound ? 'border-green-700 bg-green-950/20' : 'border-gray-800 bg-gray-900/40'}`}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-300">Sound</span>
                          <Toggle enabled={form.sound} onChange={() => setForm({ ...form, sound: !form.sound })} color="bg-green-600" />
                        </div>
                      </div>
                    )}
                    {form[`${cond.key}_enabled`] === false && (
                      <p className="text-xs text-gray-600 text-center py-2">This condition is disabled — toggle to activate</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Notes</label>
                <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                  placeholder="Any additional notes..." rows={2}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2 text-sm placeholder:text-gray-500 resize-none" />
              </div>

              <div className="flex gap-3">
                <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700">
                  {editingId ? 'Save Changes' : 'Create Rig Setting'}
                </Button>
                <Button variant="outline" onClick={() => { setIsAdding(false); setEditingId(null); setForm(emptyForm); }} className="border-gray-700 text-gray-300 hover:bg-gray-800">Cancel</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Settings list */}
        <div className="space-y-3">
          {rigSettings.map(rig => (
            <Card key={rig.id} className="bg-gray-900 border-gray-800">
              <div className="flex items-center justify-between p-4 cursor-pointer"
                onClick={() => setExpandedId(expandedId === rig.id ? null : rig.id)}>
                <div className="flex items-center gap-3">
                  {expandedId === rig.id ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
                  <div>
                    <p className="font-semibold text-white">{rig.team}</p>
                    <div className="flex gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">{rig.sport}</span>
                      <span className="text-xs text-gray-600">·</span>
                      <span className="text-xs text-gray-400">{rig.venue_type}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 flex-wrap">
                    {rig.rig_type && <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">{rig.rig_type}</Badge>}
                    {rig.sound && <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Sound</Badge>}
                    {rig.day_enabled !== false && <Badge className="bg-yellow-900/40 text-yellow-300 border-yellow-700/40 text-xs">Day</Badge>}
                    {rig.night_enabled !== false && <Badge className="bg-blue-900/40 text-blue-300 border-blue-700/40 text-xs">Night</Badge>}
                    {rig.arena_enabled !== false && <Badge className="bg-purple-900/40 text-purple-300 border-purple-700/40 text-xs">Arena</Badge>}
                    {rig.data_enabled && <Badge className="bg-green-900/40 text-green-300 border-green-700/40 text-xs">Data</Badge>}
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 ml-2" onClick={e => e.stopPropagation()}>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-white hover:bg-gray-800" onClick={() => startEdit(rig)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-500 hover:text-red-400 hover:bg-gray-800" onClick={() => handleDelete(rig.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              {expandedId === rig.id && (
                <div className="px-4 pb-4 border-t border-gray-800 pt-3 space-y-4">
                  {rig.remote_rigs?.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Remote Rigs</p>
                      <div className="flex flex-wrap gap-1.5">
                        {rig.remote_rigs.map((r, i) => (
                          <span key={i} className="text-xs bg-blue-900/40 text-blue-300 border border-blue-700/40 px-2 py-0.5 rounded-full">{r}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {rig.shoot_plan && (
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Shoot Plan</p>
                      <p className="text-sm text-gray-300">{rig.shoot_plan}</p>
                    </div>
                  )}

                  {/* Day / Night / Arena / Data display */}
                  {CONDITION_SECTIONS.map(cond => {
                    if (rig[`${cond.key}_enabled`] === false) return null;
                    const hasAny = CAMERAS.some(cam => rig[`${cond.key}_${cam.key}_enabled`] !== false);
                    if (!hasAny) return null;
                    return (
                      <div key={cond.key}>
                        <div className="flex items-center gap-1.5 mb-2">
                          <cond.Icon className={`h-3.5 w-3.5 ${cond.color}`} />
                          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{cond.label}</p>
                          {cond.rangeable && <span className="text-xs text-gray-600">(guide range)</span>}
                        </div>
                        <div className="space-y-1">
                          {CAMERAS.map(cam => (
                            <CamDisplay key={cam.key}
                              label={cam.label}
                              enabled={rig[`${cond.key}_${cam.key}_enabled`] !== false}
                              cam={rig[`${cond.key}_${cam.key}`]}
                              isRange={cond.rangeable} />
                          ))}
                        </div>
                      </div>
                    );
                  })}

                  <div className={`flex items-center gap-3 rounded p-2 ${rig.sound ? 'bg-green-950/20' : 'bg-gray-800/30'}`}>
                    <span className="text-xs font-medium text-gray-300 w-36">Sound</span>
                    <span className={`text-xs font-bold ${rig.sound ? 'text-green-400' : 'text-gray-600'}`}>{rig.sound ? 'YES' : 'NO'}</span>
                  </div>
                  {rig.notes && <p className="text-sm text-gray-400 italic">{rig.notes}</p>}
                </div>
              )}
            </Card>
          ))}
        </div>

        {rigSettings.length === 0 && (
          <div className="text-center py-20 text-gray-500">
            <p className="text-5xl mb-4">⚙️</p>
            <p>No rig settings yet. Add your first team configuration.</p>
          </div>
        )}
      </div>
    </div>
  );
}