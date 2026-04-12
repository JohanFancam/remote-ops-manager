import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useApp } from '../components/AppContext';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Trash2, X, Volume2, Timer, Aperture, Sun, Settings2, StickyNote, Copy, Search } from 'lucide-react';

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

function CamRow({ label, enabled, cam }) {
  if (!enabled) return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded bg-gray-800/30">
      <span className="text-xs text-gray-500">{label}</span>
      <span className="text-xs text-gray-700">OFF</span>
    </div>
  );
  return (
    <div className="flex flex-wrap items-center justify-between py-1.5 px-2 rounded bg-blue-950/20 gap-1">
      <span className="text-xs text-gray-300 font-medium">{label}</span>
      {cam && (
        <div className="flex gap-2 text-xs text-gray-400 flex-wrap">
          <span className="flex items-center gap-1"><Timer className="h-3 w-3 text-gray-500" />{cam.shutter || '—'}</span>
          <span className="flex items-center gap-1"><Aperture className="h-3 w-3 text-gray-500" />{cam.aperture || '—'}</span>
          <span className="flex items-center gap-1"><Sun className="h-3 w-3 text-gray-500" />{cam.iso || '—'}</span>
        </div>
      )}
    </div>
  );
}

export default function Rigs() {
  const { isAdmin } = useApp();
  const queryClient = useQueryClient();
  const [activeEditId, setActiveEditId] = useState(null); // rig being edited at bottom
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [rigInput, setRigInput] = useState('');
  const [search, setSearch] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const { data: rigSettings = [] } = useQuery({
    queryKey: ['rigSettings'],
    queryFn: () => base44.entities.RigSetting.list(),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['rigSettings'] });

  const handleSave = async () => {
    if (!form.team) return;
    if (activeEditId && activeEditId !== 'new') {
      await base44.entities.RigSetting.update(activeEditId, form);
    } else {
      await base44.entities.RigSetting.create(form);
    }
    setForm(emptyForm);
    setActiveEditId(null);
    setIsAdding(false);
    refresh();
  };

  const handleDelete = async (id) => {
    await base44.entities.RigSetting.delete(id);
    setConfirmDeleteId(null);
    if (activeEditId === id) { setActiveEditId(null); setForm(emptyForm); }
    refresh();
  };

  const handleDuplicate = async (rig) => {
    const { id, created_date, updated_date, created_by, ...rest } = rig;
    await base44.entities.RigSetting.create({ ...rest, team: `${rest.team} (Copy)` });
    refresh();
  };

  const startEdit = (rig) => {
    setForm({ ...emptyForm, ...rig });
    setActiveEditId(rig.id);
    setIsAdding(false);
    // Scroll to bottom edit panel
    setTimeout(() => document.getElementById('rig-edit-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  const cancelEdit = () => {
    setActiveEditId(null);
    setIsAdding(false);
    setForm(emptyForm);
  };

  const addRig = () => {
    if (!rigInput.trim()) return;
    setForm({ ...form, remote_rigs: [...(form.remote_rigs || []), rigInput.trim()] });
    setRigInput('');
  };

  const removeRig = (i) => setForm({ ...form, remote_rigs: form.remote_rigs.filter((_, idx) => idx !== i) });

  const filtered = rigSettings.filter(r =>
    !search ||
    r.team?.toLowerCase().includes(search.toLowerCase()) ||
    r.sport?.toLowerCase().includes(search.toLowerCase()) ||
    r.rig_type?.toLowerCase().includes(search.toLowerCase())
  );

  const editingRig = activeEditId && activeEditId !== 'new' ? rigSettings.find(r => r.id === activeEditId) : null;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Rig Settings</h1>
            <p className="text-gray-400 text-sm mt-1">Team-based camera configurations</p>
          </div>
          {isAdmin && !isAdding && !activeEditId && (
            <Button onClick={() => { setIsAdding(true); setActiveEditId('new'); setForm(emptyForm); }}
              className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" /> New Rig Setting
            </Button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by team, sport, rig type…"
            className="w-full bg-gray-900 border border-gray-700 text-white rounded-lg pl-9 pr-4 py-2.5 text-sm placeholder:text-gray-600 focus:border-blue-600 outline-none" />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* 2x2 tile grid — scroll for more */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          {filtered.map(rig => {
            const isActive = activeEditId === rig.id;
            return (
              <div key={rig.id} className={`rounded-xl border flex flex-col transition-all ${
                isActive ? 'border-blue-500 ring-2 ring-blue-600/40 bg-gray-900' : 'border-gray-800 bg-gray-900 hover:border-gray-700'
              }`}>
                {/* Tile header */}
                <div className="p-4 border-b border-gray-800 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-white text-base leading-tight truncate">{rig.team}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{rig.sport} · {rig.venue_type}</p>
                  </div>
                  {rig.rig_type && (
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs flex-shrink-0">{rig.rig_type}</Badge>
                  )}
                </div>

                {/* Camera badges */}
                <div className="px-4 py-2 flex flex-wrap gap-1.5">
                  {rig.hd_enabled !== false && <Badge className="bg-gray-700/60 text-gray-300 border-gray-600 text-xs">HD</Badge>}
                  {rig.wide_enabled !== false && <Badge className="bg-gray-700/60 text-gray-300 border-gray-600 text-xs">Wide</Badge>}
                  {rig.attention_enabled && <Badge className="bg-orange-900/40 text-orange-300 border-orange-700/40 text-xs">Attention</Badge>}
                  {rig.sound && <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Sound</Badge>}
                </div>

                {/* Camera settings */}
                <div className="px-4 pb-3 space-y-1 flex-1">
                  {CAMERAS.map(cam => (
                    <CamRow key={cam.key} label={cam.label} enabled={rig[`${cam.key}_enabled`] !== false} cam={rig[cam.key]} />
                  ))}
                </div>

                {/* Remote rigs */}
                {rig.remote_rigs?.length > 0 && (
                  <div className="px-4 pb-3">
                    <p className="text-[10px] text-gray-500 mb-1 font-semibold uppercase tracking-tighter">Remote Rigs</p>
                    <div className="flex flex-wrap gap-1">
                      {rig.remote_rigs.map((r, i) => (
                        <span key={i} className="text-xs bg-blue-900/30 text-blue-300 border border-blue-700/30 px-2 py-0.5 rounded-full">{r}</span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes preview */}
                {rig.notes && (
                  <div className="px-4 pb-3">
                    <div className="flex items-center gap-1.5 text-blue-400/80 mb-1">
                      <StickyNote className="h-3 w-3" />
                      <span className="text-[10px] font-semibold uppercase tracking-wider">Notes</span>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-2 italic px-1">"{rig.notes}"</p>
                  </div>
                )}

                {/* Actions */}
                {isAdmin && (
                  <div className="px-4 py-3 border-t border-gray-800 flex items-center justify-between">
                    <button
                      onClick={() => isActive ? cancelEdit() : startEdit(rig)}
                      className={`flex items-center gap-1.5 text-xs font-medium transition-colors ${
                        isActive ? 'text-blue-400 hover:text-white' : 'text-gray-400 hover:text-white'
                      }`}>
                      <Edit2 className="h-3.5 w-3.5" />
                      {isActive ? 'Editing ↓' : 'Edit'}
                    </button>
                    <div className="flex gap-1 items-center">
                      <button onClick={() => handleDuplicate(rig)} title="Duplicate"
                        className="p-1.5 rounded text-gray-500 hover:text-blue-400 hover:bg-gray-800 transition-colors">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      {confirmDeleteId === rig.id ? (
                        <div className="flex items-center gap-1">
                          <button onClick={() => handleDelete(rig.id)} className="text-xs px-2 py-0.5 bg-red-700 hover:bg-red-600 text-white rounded">Yes</button>
                          <button onClick={() => setConfirmDeleteId(null)} className="text-xs px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-white rounded">No</button>
                        </div>
                      ) : (
                        <button onClick={() => setConfirmDeleteId(rig.id)}
                          className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-gray-800 transition-colors">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {filtered.length === 0 && search && (
            <div className="col-span-full text-center py-10 text-gray-500">
              <Search className="h-8 w-8 text-gray-700 mx-auto mb-2" />
              <p>No rig settings match "{search}"</p>
            </div>
          )}
        </div>

        {rigSettings.length === 0 && !isAdding && (
          <div className="text-center py-20 text-gray-500">
            <Settings2 className="h-12 w-12 text-gray-700 mx-auto mb-4" />
            <p>No rig settings yet. Add your first team configuration.</p>
          </div>
        )}

        {/* Bottom Edit / Add Panel */}
        {(activeEditId) && (
          <div id="rig-edit-panel" className="bg-gray-900 border border-blue-700/50 rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-white">
                {activeEditId === 'new' ? 'New Rig Setting' : `Editing: ${editingRig?.team || '…'}`}
              </h2>
              <button onClick={cancelEdit} className="text-gray-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Shoot Plan</label>
                <textarea value={form.shoot_plan} onChange={e => setForm({ ...form, shoot_plan: e.target.value })}
                  placeholder="Describe the shoot plan..." rows={3}
                  className="w-full bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2 text-sm placeholder:text-gray-500 resize-none" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Remote Rigs</label>
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
            </div>

            <div>
              <label className="text-xs text-gray-400 uppercase tracking-wider mb-2 block">Camera Settings</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {CAMERAS.map(cam => (
                  <CameraEditor key={cam.key} label={cam.label}
                    enabled={form[`${cam.key}_enabled`] !== false}
                    onToggle={() => setForm({ ...form, [`${cam.key}_enabled`]: !(form[`${cam.key}_enabled`] !== false) })}
                    cam={form[cam.key] || DEFAULT_CAM}
                    onChange={val => setForm({ ...form, [cam.key]: val })} />
                ))}
              </div>
              <div className={`mt-3 rounded-lg border p-3 flex items-center justify-between ${form.sound ? 'border-green-700 bg-green-950/20' : 'border-gray-800 bg-gray-900/40'}`}>
                <div className="flex items-center gap-2">
                  <Volume2 className={`h-4 w-4 ${form.sound ? 'text-green-400' : 'text-gray-600'}`} />
                  <span className="text-sm font-medium text-gray-300">Sound Recording</span>
                </div>
                <Toggle enabled={form.sound} onChange={() => setForm({ ...form, sound: !form.sound })} />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Notes</label>
              <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="Any additional notes..." rows={2}
                className="w-full bg-gray-800 border border-gray-700 text-white rounded-md px-3 py-2 text-sm placeholder:text-gray-500 resize-none" />
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} className="bg-blue-600 hover:bg-blue-700 px-6">
                {activeEditId === 'new' ? 'Create Rig Setting' : 'Save Changes'}
              </Button>
              <Button variant="outline" onClick={cancelEdit} className="border-gray-700 text-gray-300 hover:bg-gray-800">Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}